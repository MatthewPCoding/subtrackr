"""
services/email_service.py

Direct OAuth email scanning — Google (Gmail) and Microsoft (Outlook).
No third-party email middleware.

Required .env keys:
  GOOGLE_CLIENT_ID      = your Google OAuth client ID
  GOOGLE_CLIENT_SECRET  = your Google OAuth client secret
  GOOGLE_REDIRECT_URI   = http://localhost:8000/email/callback/google

  MICROSOFT_CLIENT_ID     = your Azure app client ID
  MICROSOFT_CLIENT_SECRET = your Azure app client secret
  MICROSOFT_REDIRECT_URI  = http://localhost:8000/email/callback/microsoft

  FRONTEND_URL = http://localhost:8081
"""

import os
import re
import json
import urllib.parse
from dotenv import load_dotenv

load_dotenv()

GOOGLE_CLIENT_ID      = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET  = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI   = os.getenv("GOOGLE_REDIRECT_URI",   "http://localhost:8000/email/callback/google")

MICROSOFT_CLIENT_ID     = os.getenv("MICROSOFT_CLIENT_ID")
MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET")
MICROSOFT_REDIRECT_URI  = os.getenv("MICROSOFT_REDIRECT_URI", "http://localhost:8000/email/callback/microsoft")

GOOGLE_SCOPES    = ["openid", "email", "profile", "https://www.googleapis.com/auth/gmail.readonly"]
MICROSOFT_SCOPES = ["openid", "email", "profile", "Mail.Read"]

BILLING_KEYWORDS = [
    "receipt", "invoice", "billing", "subscription", "payment",
    "charged", "order confirmation", "your subscription",
]

PRICE_RE  = re.compile(r'\$\s*([\d,]+(?:\.\d{1,2})?)')
ANNUAL_RE = re.compile(r'\b(annual|annually|yearly|per year|/year|/yr)\b', re.IGNORECASE)

CATEGORY_MAP = {
    "netflix": "streaming", "hulu": "streaming", "disney": "streaming",
    "peacock": "streaming", "paramount": "streaming", "hbo": "streaming",
    "spotify": "music",     "tidal": "music",
    "adobe":   "software",  "figma": "software",    "notion": "software",
    "github":  "software",  "jetbrains": "software",
    "microsoft": "software", "office": "software",
    "dropbox": "cloud",     "icloud": "cloud",       "backblaze": "cloud",
    "aws":     "cloud",     "google": "cloud",
    "slack":   "productivity", "zoom": "productivity", "asana": "productivity",
    "amazon":  "other",
}


# ── Google ────────────────────────────────────────────────────────────────────

def _make_google_flow():
    from google_auth_oauthlib.flow import Flow
    return Flow.from_client_config(
        {
            "web": {
                "client_id":     GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri":      "https://accounts.google.com/o/oauth2/auth",
                "token_uri":     "https://oauth2.googleapis.com/token",
                "redirect_uris": [GOOGLE_REDIRECT_URI],
            }
        },
        scopes=GOOGLE_SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI,
        # Disable PKCE — we're a confidential client (server-side with client_secret),
        # so PKCE is optional and would require storing the verifier across requests.
        autogenerate_code_verifier=False,
    )


def get_google_auth_url() -> str:
    flow = _make_google_flow()
    url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return url


async def fetch_gmail_subscriptions(code: str) -> tuple[dict, list[dict]]:
    from googleapiclient.discovery import build

    flow = _make_google_flow()
    flow.fetch_token(code=code)

    # Fetch Google profile (email + display name)
    oauth2_service = build("oauth2", "v2", credentials=flow.credentials)
    profile_raw = oauth2_service.userinfo().get().execute()
    profile = {
        "email": profile_raw.get("email", ""),
        "name":  profile_raw.get("name", ""),
    }

    service = build("gmail", "v1", credentials=flow.credentials)

    query = " OR ".join(f'"{kw}"' for kw in BILLING_KEYWORDS)
    resp = service.users().messages().list(
        userId="me", q=query, maxResults=50
    ).execute()

    subs = _parse_gmail_messages(service, resp.get("messages", []))
    return profile, subs


def _parse_gmail_messages(service, messages: list) -> list[dict]:
    seen, results = set(), []
    for msg in messages[:30]:
        try:
            full = service.users().messages().get(
                userId="me", id=msg["id"], format="metadata",
                metadataHeaders=["Subject", "From"],
            ).execute()
            headers = {h["name"]: h["value"] for h in full["payload"]["headers"]}
            sub = _parse_subscription(headers.get("Subject", ""), headers.get("From", ""))
            if sub and sub["name"] not in seen:
                seen.add(sub["name"])
                results.append(sub)
        except Exception:
            continue
    return results


# ── Microsoft ─────────────────────────────────────────────────────────────────

def get_microsoft_auth_url() -> str:
    import msal
    app = msal.ConfidentialClientApplication(
        client_id=MICROSOFT_CLIENT_ID,
        client_credential=MICROSOFT_CLIENT_SECRET,
        authority="https://login.microsoftonline.com/common",
    )
    return app.get_authorization_request_url(
        scopes=MICROSOFT_SCOPES,
        redirect_uri=MICROSOFT_REDIRECT_URI,
    )


async def fetch_outlook_subscriptions(code: str) -> list[dict]:
    import msal
    import httpx

    app = msal.ConfidentialClientApplication(
        client_id=MICROSOFT_CLIENT_ID,
        client_credential=MICROSOFT_CLIENT_SECRET,
        authority="https://login.microsoftonline.com/common",
    )
    result = app.acquire_token_by_authorization_code(
        code=code,
        scopes=MICROSOFT_SCOPES,
        redirect_uri=MICROSOFT_REDIRECT_URI,
    )
    if "access_token" not in result:
        raise Exception(result.get("error_description", "Microsoft auth failed"))

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://graph.microsoft.com/v1.0/me/messages",
            headers={"Authorization": f"Bearer {result['access_token']}"},
            params={
                "$top": 50,
                "$select": "subject,from",
                "$orderby": "receivedDateTime desc",
            },
            timeout=30.0,
        )
        messages = resp.json().get("value", [])

    billing = [
        m for m in messages
        if any(kw in (m.get("subject") or "").lower() for kw in BILLING_KEYWORDS)
    ]
    return _parse_outlook_messages(billing)


def _parse_outlook_messages(messages: list) -> list[dict]:
    seen, results = set(), []
    for msg in messages[:30]:
        try:
            subject = msg.get("subject", "")
            sender  = msg.get("from", {}).get("emailAddress", {}).get("address", "")
            sub = _parse_subscription(subject, sender)
            if sub and sub["name"] not in seen:
                seen.add(sub["name"])
                results.append(sub)
        except Exception:
            continue
    return results


# ── Shared parser ─────────────────────────────────────────────────────────────

def _parse_subscription(subject: str, sender: str) -> dict | None:
    price_match = PRICE_RE.search(subject)
    if not price_match:
        return None
    try:
        price = float(price_match.group(1).replace(",", ""))
    except ValueError:
        return None
    if price <= 0 or price > 9999:
        return None

    name, website = _extract_name_and_domain(sender)
    billing_cycle = "annually" if ANNUAL_RE.search(subject) else "monthly"
    name_key      = name.lower()
    category      = next((cat for key, cat in CATEGORY_MAP.items() if key in name_key), "other")

    return {
        "name":          name,
        "price":         round(price, 2),
        "billing_cycle": billing_cycle,
        "category":      category,
        "website":       website,
    }


def _extract_name_and_domain(sender: str) -> tuple[str, str]:
    display_match = re.match(r'^(.+?)\s*<([^>]+)>', sender.strip())
    if display_match:
        display = display_match.group(1).strip().strip('"').strip("'")
        email   = display_match.group(2).strip()
    else:
        display = ""
        email   = sender.strip()

    domain     = email.split("@")[-1] if "@" in email else ""
    parts      = domain.split(".")
    from_domain = parts[-2].title() if len(parts) >= 2 else ""

    # Prefer display name when it looks like a real company name
    junk = {"noreply", "no-reply", "donotreply", "do-not-reply", "info", "hello", "support"}
    name = (
        display
        if display and len(display) > 1 and display.lower().split("@")[0] not in junk
        else from_domain or "Unknown"
    )
    return name, domain


def build_success_redirect(profile: dict, subscriptions: list[dict]) -> str:
    """Deep-link URL the app uses to receive scan results + Google profile."""
    encoded_subs    = urllib.parse.quote(json.dumps(subscriptions[:20]))
    encoded_profile = urllib.parse.quote(json.dumps(profile))
    return f"subtrackr://email-success?subs={encoded_subs}&profile={encoded_profile}"


# ── Google login (identity only, no Gmail scan) ───────────────────────────────

GOOGLE_LOGIN_REDIRECT_URI = os.getenv(
    "GOOGLE_LOGIN_REDIRECT_URI", "http://localhost:8000/auth/callback/google"
)
GOOGLE_LOGIN_SCOPES = ["openid", "email", "profile"]


def _make_google_login_flow():
    from google_auth_oauthlib.flow import Flow
    return Flow.from_client_config(
        {
            "web": {
                "client_id":     GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri":      "https://accounts.google.com/o/oauth2/auth",
                "token_uri":     "https://oauth2.googleapis.com/token",
                "redirect_uris": [GOOGLE_LOGIN_REDIRECT_URI],
            }
        },
        scopes=GOOGLE_LOGIN_SCOPES,
        redirect_uri=GOOGLE_LOGIN_REDIRECT_URI,
        autogenerate_code_verifier=False,
    )


def get_google_login_url() -> str:
    flow = _make_google_login_flow()
    url, _ = flow.authorization_url(access_type="offline", prompt="select_account")
    return url


async def fetch_google_login_profile(code: str) -> dict:
    from googleapiclient.discovery import build
    flow = _make_google_login_flow()
    flow.fetch_token(code=code)
    oauth2_service = build("oauth2", "v2", credentials=flow.credentials)
    info = oauth2_service.userinfo().get().execute()
    return {"email": info.get("email", ""), "name": info.get("name", "")}
