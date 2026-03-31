"""
scheduler.py

Sets up APScheduler to run daily background jobs.
Place this file in the app/ directory.

The scheduler runs:
  - Daily alert checks (renewals, trials, forgotten subs)

To add more scheduled jobs, import your service function and add a new
`scheduler.add_job(...)` call below.
"""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from app.services.alerts_service import run_all_checks

scheduler = BackgroundScheduler()


def start_scheduler():
    """
    Call this in main.py on app startup.
    Runs all alert checks every day at 8:00 AM server time.
    You can adjust the hour/minute to whatever makes sense.
    """
    scheduler.add_job(
        run_all_checks,
        trigger=CronTrigger(hour=8, minute=0),
        id="daily_alerts",
        replace_existing=True
    )
    scheduler.start()


def stop_scheduler():
    """
    Call this in main.py on app shutdown.
    Cleanly shuts down the scheduler.
    """
    scheduler.shutdown()
