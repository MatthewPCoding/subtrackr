"""
routes/ai.py

API endpoints for all AI-powered features.
Requires ANTHROPIC_API_KEY in your .env file.

Endpoints:
  POST /ai/chat          - Customer support chatbot
  GET  /ai/suggestions   - Personalized subscription suggestions
  GET  /ai/report        - Monthly AI spending report
  GET  /ai/deals/{id}    - Find deals for a specific subscription
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from app.database import get_db
from app.models.subscription import Subscription
from app.models.user import User
from app.routes.subscriptions import get_current_user
from app.services.ai_service import (
    ask_support_chatbot,
    get_subscription_suggestions,
    generate_monthly_report,
    find_deals_for_subscription
)

router = APIRouter(prefix="/ai", tags=["AI"])


# ── Request/Response schemas ──────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []  # pass previous messages for multi-turn chat

class AIResponse(BaseModel):
    response: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=AIResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Customer support chatbot.
    Send a message and optionally include conversation history for multi-turn chat.

    Example request body:
    {
        "message": "How do I add a subscription?",
        "history": []
    }
    """
    history = [{"role": m.role, "content": m.content} for m in request.history]
    response = await ask_support_chatbot(request.message, history)
    return {"response": response}


@router.get("/suggestions", response_model=AIResponse)
async def suggestions(
    monthly_income: float,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns personalized AI suggestions based on the user's subscription list.
    Pass monthly_income as a query parameter.

    Example: GET /ai/suggestions?monthly_income=3500
    """
    subscriptions = db.query(Subscription).filter(
        Subscription.user_id == current_user.id,
        Subscription.is_active == True
    ).all()

    if not subscriptions:
        raise HTTPException(status_code=400, detail="No active subscriptions found")

    response = await get_subscription_suggestions(subscriptions, monthly_income)
    return {"response": response}


@router.get("/report", response_model=AIResponse)
async def monthly_report(
    monthly_income: float,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generates a natural language monthly spending report.
    Pass monthly_income as a query parameter.

    Example: GET /ai/report?monthly_income=3500
    """
    subscriptions = db.query(Subscription).filter(
        Subscription.user_id == current_user.id,
        Subscription.is_active == True
    ).all()

    if not subscriptions:
        raise HTTPException(status_code=400, detail="No active subscriptions found")

    response = await generate_monthly_report(subscriptions, monthly_income)
    return {"response": response}


@router.get("/deals/{subscription_id}", response_model=AIResponse)
async def find_deals(
    subscription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns AI-powered deal suggestions for a specific subscription.
    Uses the subscription's name and price to find cheaper alternatives or tiers.
    """
    subscription = db.query(Subscription).filter(
        Subscription.id == subscription_id,
        Subscription.user_id == current_user.id,
        Subscription.is_active == True
    ).first()

    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    response = await find_deals_for_subscription(subscription.name, subscription.price)
    return {"response": response}
