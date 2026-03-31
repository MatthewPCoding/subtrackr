from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.subscription import Subscription
from app.schemas.subscription import SubscriptionCreate, SubscriptionResponse, SubscriptionUpdate
from app.auth import decode_access_token
from fastapi.security import OAuth2PasswordBearer
from app.models.user import User
import httpx

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    username = decode_access_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

def fetch_logo(website: str) -> str | None:
    if not website:
        return None
    try:
        domain = website.replace("https://", "").replace("http://", "").split("/")[0]
        return f"https://www.google.com/s2/favicons?domain={domain}&sz=128"
    except:
        return None

@router.post("/", response_model=SubscriptionResponse)
def create_subscription(
    subscription: SubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    logo_url = fetch_logo(subscription.website)
    new_subscription = Subscription(
        **subscription.model_dump(),
        user_id=current_user.id,
        logo_url=logo_url
    )
    db.add(new_subscription)
    db.commit()
    db.refresh(new_subscription)
    return new_subscription

@router.get("/", response_model=List[SubscriptionResponse])
def get_subscriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Subscription).filter(
        Subscription.user_id == current_user.id,
        Subscription.is_active == True
    ).all()

@router.put("/{subscription_id}", response_model=SubscriptionResponse)
def update_subscription(
    subscription_id: int,
    updates: SubscriptionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    subscription = db.query(Subscription).filter(
        Subscription.id == subscription_id,
        Subscription.user_id == current_user.id
    ).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    for key, value in updates.model_dump(exclude_unset=True).items():
        setattr(subscription, key, value)
    db.commit()
    db.refresh(subscription)
    return subscription

@router.delete("/{subscription_id}")
def delete_subscription(
    subscription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    subscription = db.query(Subscription).filter(
        Subscription.id == subscription_id,
        Subscription.user_id == current_user.id
    ).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    subscription.is_active = False
    db.commit()
    return {"message": "Subscription deleted"}