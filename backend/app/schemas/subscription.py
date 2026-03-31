from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class SubscriptionCreate(BaseModel):
    name: str
    category: str
    price: float
    billing_cycle: str
    next_billing_date: Optional[datetime] = None
    is_trial: bool = False
    trial_end_date: Optional[datetime] = None
    website: Optional[str] = None
    last_used: Optional[datetime] = None

class SubscriptionResponse(BaseModel):
    id: int
    user_id: int
    name: str
    category: str
    price: float
    billing_cycle: str
    next_billing_date: Optional[datetime] = None
    is_trial: bool
    trial_end_date: Optional[datetime] = None
    logo_url: Optional[str] = None
    website: Optional[str] = None
    is_active: bool
    last_used: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class SubscriptionUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    billing_cycle: Optional[str] = None
    next_billing_date: Optional[datetime] = None
    is_trial: Optional[bool] = None
    trial_end_date: Optional[datetime] = None
    website: Optional[str] = None
    is_active: Optional[bool] = None
    last_used: Optional[datetime] = None