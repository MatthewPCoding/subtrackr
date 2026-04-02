"""
main.py

Entry point for the Subtrackr FastAPI backend.
All routers and startup/shutdown events are registered here.

Phases wired up:
  Phase 1 - Core: users, subscriptions, analytics
  Phase 2 - Alerts: alerts routes + APScheduler background jobs
  Phase 3 - AI: chatbot, suggestions, monthly report, deal finder
  Phase 4 - Savings: subscription audit, overlap detection, alternatives
"""
import os
import logging
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.database import engine, Base

# Models — import all so SQLAlchemy registers them before create_all
import app.models.user
import app.models.subscription
import app.models.alert

# Routers
from app.routes import users, subscriptions, analytics, alerts, ai, savings, email

# Scheduler
from app.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()


app = FastAPI(
    title="Subtrackr API",
    description="Track subscriptions, get AI-powered insights, and save money.",
    version="1.0.0",
    lifespan=lifespan
)

# Build CORS origin list from env — add production URLs via ALLOWED_ORIGINS
# e.g. ALLOWED_ORIGINS=https://xyz.cloudfront.net,https://subtrackr.com
_extra = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
CORS_ORIGINS = [
    "http://localhost:8081",
    "http://127.0.0.1:8081",
] + _extra

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create all database tables
Base.metadata.create_all(bind=engine)

# Register all routers
app.include_router(users.router)
app.include_router(subscriptions.router)
app.include_router(analytics.router)
app.include_router(alerts.router)
app.include_router(ai.router)
app.include_router(savings.router)
app.include_router(email.router)


@app.get("/")
def root():
    return {"message": "Subtrackr API is running"}
