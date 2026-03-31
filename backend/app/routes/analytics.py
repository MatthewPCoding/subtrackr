from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.subscription import Subscription
from app.models.user import User
from app.routes.subscriptions import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/summary")
def get_summary(
    monthly_income: float,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    subscriptions = db.query(Subscription).filter(
        Subscription.user_id == current_user.id,
        Subscription.is_active == True
    ).all()

    total_monthly = 0
    category_breakdown = {}

    for sub in subscriptions:
        if sub.billing_cycle == "monthly":
            monthly_cost = sub.price
        else:
            monthly_cost = sub.price / 12

        total_monthly += monthly_cost

        if sub.category not in category_breakdown:
            category_breakdown[sub.category] = 0
        category_breakdown[sub.category] += monthly_cost

    spending_percentage = (total_monthly / monthly_income * 100) if monthly_income > 0 else 0

    return {
        "total_monthly_spending": round(total_monthly, 2),
        "total_annual_spending": round(total_monthly * 12, 2),
        "monthly_income": monthly_income,
        "spending_percentage": round(spending_percentage, 2),
        "category_breakdown": {k: round(v, 2) for k, v in category_breakdown.items()},
        "subscription_count": len(subscriptions)
    }