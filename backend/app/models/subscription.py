"""
models/subscription.py

Subscription database model.
Relationships:
  - user: belongs to one user
  - alerts: one subscription can have many alerts
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    billing_cycle = Column(String, nullable=False)         # "monthly" or "annually"
    next_billing_date = Column(DateTime(timezone=True), nullable=True)
    is_trial = Column(Boolean, default=False)
    trial_end_date = Column(DateTime(timezone=True), nullable=True)
    logo_url = Column(String, nullable=True)
    website = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    last_used = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="subscriptions")
    alerts = relationship("Alert", back_populates="subscription")
