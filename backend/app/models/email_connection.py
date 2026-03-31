from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime
from app.database import Base


class EmailConnection(Base):
    __tablename__ = "email_connections"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    grant_id     = Column(String, nullable=False)
    email        = Column(String, nullable=True)
    provider     = Column(String, nullable=True)
    connected_at = Column(DateTime, default=datetime.utcnow)
