"""
services/savings_service.py

Handles subscription audit logic and alternative suggestions.
This is the non-AI savings layer — rule-based overlap detection,
audit summaries, and alternative pricing lookups.

For AI-powered deal hunting, see services/ai_service.py.
"""

from app.models.subscription import Subscription


# Known overlapping service groups
# Add more as needed — these are just starting examples
OVERLAP_GROUPS = [
    {
        "category": "streaming",
        "services": ["netflix", "hulu", "disney+", "hbo max", "max", "paramount+", "peacock", "apple tv+"],
        "message": "You have multiple streaming services. Consider rotating them monthly instead of paying for all simultaneously."
    },
    {
        "category": "music",
        "services": ["spotify", "apple music", "tidal", "amazon music", "youtube music", "deezer"],
        "message": "You're paying for multiple music streaming services. You only need one — pick your favorite and cancel the rest."
    },
    {
        "category": "cloud storage",
        "services": ["google one", "icloud", "dropbox", "onedrive", "box"],
        "message": "You have multiple cloud storage subscriptions. Consolidating to one could save you money."
    },
    {
        "category": "productivity",
        "services": ["notion", "evernote", "obsidian", "roam research", "craft"],
        "message": "You're paying for multiple note-taking/productivity apps. These often overlap significantly."
    },
]

# Known bundle opportunities
BUNDLE_OPPORTUNITIES = [
    {
        "services": ["disney+", "hulu", "espn+"],
        "bundle_name": "Disney Bundle",
        "message": "Disney+, Hulu, and ESPN+ can be bundled together for less than paying separately."
    },
    {
        "services": ["apple tv+", "apple music", "icloud"],
        "bundle_name": "Apple One",
        "message": "Apple TV+, Apple Music, and iCloud can be bundled under Apple One for a lower combined price."
    },
]


def detect_overlaps(subscriptions: list[Subscription]) -> list[dict]:
    """
    Finds subscriptions that overlap in functionality.
    Returns a list of overlap warnings with actionable messages.
    """
    user_service_names = [sub.name.lower() for sub in subscriptions]
    warnings = []

    for group in OVERLAP_GROUPS:
        matches = [name for name in user_service_names if name in group["services"]]
        if len(matches) >= 2:
            warnings.append({
                "type": "overlap",
                "services": matches,
                "message": group["message"]
            })

    return warnings


def detect_bundle_opportunities(subscriptions: list[Subscription]) -> list[dict]:
    """
    Checks if the user has services that could be bundled together for savings.
    """
    user_service_names = [sub.name.lower() for sub in subscriptions]
    opportunities = []

    for bundle in BUNDLE_OPPORTUNITIES:
        matches = [s for s in bundle["services"] if s in user_service_names]
        # If they have at least 2 of the bundled services but not all, suggest the bundle
        if len(matches) >= 2 and len(matches) < len(bundle["services"]):
            opportunities.append({
                "type": "bundle",
                "bundle_name": bundle["bundle_name"],
                "services_you_have": matches,
                "message": bundle["message"]
            })

    return opportunities


def run_subscription_audit(subscriptions: list[Subscription], monthly_income: float) -> dict:
    """
    Master audit function. Runs all rule-based checks and returns a full audit report.
    This powers the "Subscription Audit" feature on the frontend.
    """
    total_monthly = sum(
        sub.price if sub.billing_cycle == "monthly" else sub.price / 12
        for sub in subscriptions
    )

    overlaps = detect_overlaps(subscriptions)
    bundles = detect_bundle_opportunities(subscriptions)

    # Estimate potential savings from cutting overlaps
    # Conservative estimate: user could save the cost of 1 subscription per overlap group
    potential_savings = 0.0
    for overlap in overlaps:
        # Find the cheapest service in the overlap and suggest cutting it
        overlap_subs = [
            sub for sub in subscriptions
            if sub.name.lower() in overlap["services"]
        ]
        if overlap_subs:
            cheapest = min(overlap_subs, key=lambda s: s.price)
            monthly_cost = cheapest.price if cheapest.billing_cycle == "monthly" else cheapest.price / 12
            potential_savings += monthly_cost

    spending_pct = (total_monthly / monthly_income * 100) if monthly_income > 0 else 0

    # Health rating: simple rule-based assessment
    if spending_pct < 5:
        health = "Excellent"
        health_message = "Your subscription spending is very healthy."
    elif spending_pct < 10:
        health = "Good"
        health_message = "Your subscription spending is reasonable."
    elif spending_pct < 15:
        health = "Fair"
        health_message = "Your subscriptions are taking a noticeable chunk of your income."
    else:
        health = "High"
        health_message = "Your subscription spending is high relative to your income. Consider auditing your list."

    return {
        "total_monthly_spending": round(total_monthly, 2),
        "spending_percentage": round(spending_pct, 2),
        "health_rating": health,
        "health_message": health_message,
        "potential_monthly_savings": round(potential_savings, 2),
        "potential_annual_savings": round(potential_savings * 12, 2),
        "overlaps": overlaps,
        "bundle_opportunities": bundles,
        "subscription_count": len(subscriptions),
    }
