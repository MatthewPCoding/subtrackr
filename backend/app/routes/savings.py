"""
routes/savings.py

Endpoints for the savings, audit, and recommendations features.

Endpoints:
  GET /savings/audit          - Full subscription audit with overlap + bundle detection
  GET /savings/alternatives   - Suggested alternatives for a specific subscription
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.subscription import Subscription
from app.models.user import User
from app.routes.subscriptions import get_current_user
from app.services.savings_service import run_subscription_audit
from app.services.ai_service import find_deals_for_subscription

router = APIRouter(prefix="/savings", tags=["Savings"])


@router.get("/audit")
async def subscription_audit(
    monthly_income: float,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Runs a full subscription audit for the current user.
    Returns overlap warnings, bundle opportunities, health rating,
    and estimated potential savings.

    Example: GET /savings/audit?monthly_income=3500
    """
    subscriptions = db.query(Subscription).filter(
        Subscription.user_id == current_user.id,
        Subscription.is_active == True
    ).all()

    if not subscriptions:
        raise HTTPException(status_code=400, detail="No active subscriptions found")

    return run_subscription_audit(subscriptions, monthly_income)


@router.get("/alternatives/{subscription_id}")
async def get_alternatives(
    subscription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns AI-powered alternative suggestions for a specific subscription.
    Finds cheaper tiers, promotional offers, and competing services.

    Example: GET /savings/alternatives/3
    """
    subscription = db.query(Subscription).filter(
        Subscription.id == subscription_id,
        Subscription.user_id == current_user.id,
        Subscription.is_active == True
    ).first()

    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    suggestions = await find_deals_for_subscription(subscription.name, subscription.price)

    return {
        "subscription": subscription.name,
        "current_price": subscription.price,
        "billing_cycle": subscription.billing_cycle,
        "suggestions": suggestions
    }
