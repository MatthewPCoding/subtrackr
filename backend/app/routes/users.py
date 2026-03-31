import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, Token
from app.auth import hash_password, verify_password, create_access_token
from app.services.email_service import get_google_login_url, fetch_google_login_profile

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(
        (User.email == user.email) | (User.username == user.username)
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email or username already exists")
    
    new_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hash_password(user.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(data={"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}


# ── Google OAuth login ────────────────────────────────────────────────────────

AUTH_ERROR_REDIRECT = "subtrackr://auth-error"


@router.get("/connect/google")
async def google_login_connect():
    """Return Google OAuth URL for sign-in (identity only, no Gmail scan)."""
    return {"url": get_google_login_url()}


@router.get("/callback/google")
async def google_login_callback(
    code:  str = Query(None),
    error: str = Query(None),
    db:    Session = Depends(get_db),
):
    """Exchange Google code for profile, find user by email, issue JWT."""
    if error or not code:
        return RedirectResponse(AUTH_ERROR_REDIRECT)
    try:
        profile = await fetch_google_login_profile(code)
        user = db.query(User).filter(User.email == profile["email"]).first()
        if not user:
            return RedirectResponse("subtrackr://auth-error?reason=no_account")
        token = create_access_token(data={"sub": user.username})
        return RedirectResponse(f"subtrackr://auth-success?token={urllib.parse.quote(token)}")
    except Exception:
        return RedirectResponse(AUTH_ERROR_REDIRECT)