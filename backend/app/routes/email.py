"""
routes/email.py

Direct OAuth email scanning — Google and Microsoft only.
All other providers return { coming_soon: true }.

Public (no auth):
  GET  /email/connect/google       → { url }
  GET  /email/connect/microsoft    → { url }
  GET  /email/connect/{provider}   → { coming_soon: true }
  GET  /email/callback/google      → exchanges code, parses Gmail, deep-links back to app
  GET  /email/callback/microsoft   → exchanges code, parses Outlook, deep-links back to app

Auth-required:
  GET  /email/scan                 → { subscriptions: [], total_found: 0 }  (placeholder)
  GET  /email/status               → { connected: false }  (placeholder)
  POST /email/import               → saves confirmed subscriptions to DB
  DELETE /email/disconnect         → no-op placeholder
"""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.subscription import Subscription
from app.routes.subscriptions import get_current_user
from app.services.email_service import (
    get_google_auth_url,
    get_microsoft_auth_url,
    fetch_gmail_subscriptions,
    fetch_outlook_subscriptions,
    build_success_redirect,
)

router = APIRouter(prefix="/email", tags=["Email"])

ERROR_REDIRECT = "subtrackr://email-error"


# ── Public: OAuth connect ─────────────────────────────────────────────────────

@router.get("/connect/google")
async def connect_google():
    return {"url": get_google_auth_url()}


@router.get("/connect/microsoft")
async def connect_microsoft():
    return {"url": get_microsoft_auth_url()}


@router.get("/connect/{provider}")
async def connect_other(provider: str):
    name = provider.replace("-", " ").title()
    return {"coming_soon": True, "message": f"{name} support is coming soon."}


# ── Public: OAuth callbacks ───────────────────────────────────────────────────

@router.get("/callback/google")
async def callback_google(
    code:  str = Query(None),
    error: str = Query(None),
):
    if error or not code:
        return RedirectResponse(ERROR_REDIRECT)
    try:
        profile, subs = await fetch_gmail_subscriptions(code)
        return RedirectResponse(build_success_redirect(profile, subs))
    except Exception:
        return RedirectResponse(ERROR_REDIRECT)


@router.get("/callback/microsoft")
async def callback_microsoft(
    code:  str = Query(None),
    error: str = Query(None),
):
    if error or not code:
        return RedirectResponse(ERROR_REDIRECT)
    try:
        profile, subs = await fetch_outlook_subscriptions(code)
        return RedirectResponse(build_success_redirect(profile, subs))
    except Exception:
        return RedirectResponse(ERROR_REDIRECT)


# ── Auth-required ─────────────────────────────────────────────────────────────

@router.get("/scan")
async def scan(_: User = Depends(get_current_user)):
    """Results are delivered via deep link after OAuth; no server-side cache."""
    return {"subscriptions": [], "total_found": 0}


@router.get("/status")
async def status(_: User = Depends(get_current_user)):
    return {"connected": False}


class SubscriptionImport(BaseModel):
    name:          str
    price:         float
    billing_cycle: str = "monthly"
    category:      str = "other"
    website:       str = ""


class ImportBody(BaseModel):
    subscriptions: List[SubscriptionImport]


@router.post("/import")
async def import_subscriptions(
    body: ImportBody,
    db:   Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for item in body.subscriptions:
        db.add(Subscription(
            user_id=current_user.id,
            name=item.name,
            price=item.price,
            billing_cycle=item.billing_cycle,
            category=item.category,
            website=item.website,
        ))
    db.commit()
    return {"imported": len(body.subscriptions)}


@router.delete("/disconnect")
async def disconnect(_: User = Depends(get_current_user)):
    return {"success": True}
