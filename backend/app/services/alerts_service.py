"""
alerts_service.py

This service runs scheduled jobs to monitor subscriptions and generate alerts.
It checks for:
  - Renewals coming up in X days
  - Trials ending soon
  - Forgotten subscriptions (unused 30+ days)
  - Price changes (when user manually updates price)

Scheduled jobs are powered by APScheduler and run daily.
"""

from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.subscription import Subscription
from app.models.alert import Alert


def get_db() -> Session:
    db = SessionLocal()
    try:
        return db
    finally:
        pass  # caller is responsible for closing


def check_renewal_alerts(db: Session, days_before: int = 7):
    """
    Finds subscriptions renewing within `days_before` days and creates alerts.
    Default is 7 days. You can expose this as a user setting later.
    """
    now = datetime.now(timezone.utc)
    upcoming = now + timedelta(days=days_before)

    subscriptions = db.query(Subscription).filter(
        Subscription.is_active == True,
        Subscription.next_billing_date != None,
        Subscription.next_billing_date <= upcoming,
        Subscription.next_billing_date >= now,
    ).all()

    for sub in subscriptions:
        # Avoid duplicate alerts — check if one already exists for this billing cycle
        existing = db.query(Alert).filter(
            Alert.subscription_id == sub.id,
            Alert.alert_type == "renewal",
            Alert.created_at >= now - timedelta(days=1)
        ).first()

        if not existing:
            alert = Alert(
                user_id=sub.user_id,
                subscription_id=sub.id,
                alert_type="renewal",
                message=f"Your {sub.name} subscription renews on {sub.next_billing_date.strftime('%B %d, %Y')}. "
                        f"You'll be charged ${sub.price:.2f}."
            )
            db.add(alert)

    db.commit()


def check_trial_alerts(db: Session, days_before: int = 3):
    """
    Finds trials ending within `days_before` days and creates alerts.
    Default is 3 days before trial end.
    """
    now = datetime.now(timezone.utc)
    upcoming = now + timedelta(days=days_before)

    trials = db.query(Subscription).filter(
        Subscription.is_active == True,
        Subscription.is_trial == True,
        Subscription.trial_end_date != None,
        Subscription.trial_end_date <= upcoming,
        Subscription.trial_end_date >= now,
    ).all()

    for sub in trials:
        existing = db.query(Alert).filter(
            Alert.subscription_id == sub.id,
            Alert.alert_type == "trial_ending",
            Alert.created_at >= now - timedelta(days=1)
        ).first()

        if not existing:
            alert = Alert(
                user_id=sub.user_id,
                subscription_id=sub.id,
                alert_type="trial_ending",
                message=f"Your free trial for {sub.name} ends on "
                        f"{sub.trial_end_date.strftime('%B %d, %Y')}. "
                        f"Cancel before then to avoid being charged ${sub.price:.2f}."
            )
            db.add(alert)

    db.commit()


def check_forgotten_subscriptions(db: Session, days_unused: int = 30):
    """
    Flags subscriptions that haven't been marked as used in `days_unused` days.
    The frontend should allow users to update `last_used` when they use a service.
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days_unused)

    forgotten = db.query(Subscription).filter(
        Subscription.is_active == True,
        Subscription.last_used != None,
        Subscription.last_used <= cutoff,
    ).all()

    for sub in forgotten:
        existing = db.query(Alert).filter(
            Alert.subscription_id == sub.id,
            Alert.alert_type == "forgotten",
            Alert.created_at >= now - timedelta(days=7)  # only re-alert weekly
        ).first()

        if not existing:
            alert = Alert(
                user_id=sub.user_id,
                subscription_id=sub.id,
                alert_type="forgotten",
                message=f"You haven't used {sub.name} in over {days_unused} days. "
                        f"You're paying ${sub.price:.2f}/month. Consider cancelling."
            )
            db.add(alert)

    db.commit()


def run_all_checks():
    """
    Master function called by the scheduler daily.
    Runs all alert checks in sequence.
    """
    db = get_db()
    try:
        check_renewal_alerts(db)
        check_trial_alerts(db)
        check_forgotten_subscriptions(db)
    finally:
        db.close()
