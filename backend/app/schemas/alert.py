from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class AlertResponse(BaseModel):
    id: int
    user_id: int
    subscription_id: int
    alert_type: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AlertUpdate(BaseModel):
    is_read: Optional[bool] = None
