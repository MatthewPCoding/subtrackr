# Subtrackr

A mobile app for tracking, analyzing, and optimizing your recurring subscriptions. Connect your Gmail or Outlook inbox to automatically detect subscriptions, get AI-powered spending insights, and stay on top of renewals before they hit your card.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile app | React Native (Expo SDK 54) |
| Backend API | FastAPI (Python 3.11+) |
| Database | PostgreSQL |
| AI features | Anthropic Claude API |
| Email scanning | Google OAuth 2.0 + Gmail API, Microsoft OAuth 2.0 + Microsoft Graph API |
| Auth | JWT (python-jose), bcrypt |
| Background jobs | APScheduler |

---

## Features

- **Subscription tracking** — add, edit, and delete subscriptions with name, price, billing cycle, and category
- **Dashboard** — monthly spend overview, upcoming renewals, and spending breakdown by category
- **Email import** — connect Gmail or Outlook to automatically detect subscriptions from billing emails (OAuth 2.0, read-only access)
- **Analytics** — spending trends over time, category breakdowns, and income-to-subscription ratio
- **Smart alerts** — renewal reminders, price change detection, and free trial expiry warnings
- **AI chat** — Claude-powered assistant for subscription advice and spending questions
- **AI suggestions** — personalized recommendations based on your subscription portfolio and income
- **Monthly reports** — AI-generated summaries of spending patterns and savings opportunities
- **Deal finder** — AI identifies cheaper alternatives or promotions for existing subscriptions
- **Savings audit** — flags overlapping services, unused subscriptions, and potential cuts

---

## Project Structure

```
subtrackr/
├── backend/          # FastAPI application
│   ├── app/
│   │   ├── models/   # SQLAlchemy models
│   │   ├── routes/   # API endpoints
│   │   ├── schemas/  # Pydantic schemas
│   │   ├── services/ # Business logic (email scanning, AI)
│   │   ├── auth.py   # JWT + password hashing
│   │   └── main.py   # App entry point
│   ├── alembic/      # Database migrations
│   └── requirements.txt
└── frontend/         # Expo React Native app
    ├── src/
    │   ├── screens/  # App screens
    │   ├── navigation/
    │   ├── hooks/
    │   ├── services/ # API client
    │   └── theme.js
    └── App.js
```

---

## Running Locally

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Expo CLI (`npm install -g expo-cli`)

---

### Backend

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate          # macOS/Linux
# venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Create the database
createdb subtrackr                 # or use psql

# Copy and fill in environment variables
cp .env.example .env               # then edit .env

# Run migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

---

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start Expo dev server
npx expo start
```

Scan the QR code with Expo Go, or press `i` for iOS simulator / `a` for Android emulator.

For OAuth deep links to work (email connect, OAuth login), you need a **development build** rather than Expo Go:

```bash
npx expo run:ios     # or run:android
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
# Database
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/subtrackr

# JWT
SECRET_KEY=<random-secret-at-least-32-chars>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Anthropic (AI features)
ANTHROPIC_API_KEY=sk-ant-...

# Google OAuth — signup (Gmail scan) + login
# Create credentials at https://console.cloud.google.com
# OAuth client type: Web application
# Authorized redirect URIs:
#   http://localhost:8000/email/callback/google
#   http://localhost:8000/auth/callback/google
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8000/email/callback/google
GOOGLE_LOGIN_REDIRECT_URI=http://localhost:8000/auth/callback/google

# Microsoft OAuth — signup (Outlook scan) + login
# Register app at https://portal.azure.com
# Redirect URI: http://localhost:8000/email/callback/microsoft
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_REDIRECT_URI=http://localhost:8000/email/callback/microsoft

# Frontend base URL (used for CORS)
FRONTEND_URL=http://localhost:8081
```

### Frontend

No `.env` file required. The API base URL is set in `src/services/api.js` (defaults to `http://127.0.0.1:8000`).

---

## Google Cloud Console Setup

1. Go to [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create an **OAuth 2.0 Client ID** (Web application type)
3. Add both authorized redirect URIs:
   - `http://localhost:8000/email/callback/google` (signup + inbox scan)
   - `http://localhost:8000/auth/callback/google` (sign-in)
4. Go to [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent) → add your Google account as a **Test user** (required while app is in Testing mode)
5. Enable the **Gmail API** in [APIs & Services → Library](https://console.cloud.google.com/apis/library)

---

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get JWT token |
| GET | `/auth/connect/google` | Get Google OAuth URL (sign-in) |
| GET | `/auth/callback/google` | Google OAuth callback (sign-in) |
| GET/POST/PUT/DELETE | `/subscriptions/` | Manage subscriptions |
| GET | `/analytics/summary` | Spending analytics |
| GET | `/alerts/` | Get alerts |
| GET | `/email/connect/{provider}` | Get OAuth URL for inbox scan |
| GET | `/email/callback/google` | Google callback (scan + import) |
| POST | `/email/import` | Import detected subscriptions |
| POST | `/ai/chat` | Chat with AI assistant |
| GET | `/ai/suggestions` | AI spending suggestions |
| GET | `/ai/report` | Monthly AI report |
| GET | `/savings/audit` | Savings audit |
| GET | `/savings/alternatives/{id}` | Find cheaper alternatives |
