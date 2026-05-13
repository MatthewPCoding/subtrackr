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
| Backend hosting | Render |
| Frontend hosting | Vercel |

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
├── backend/                  # FastAPI application
│   ├── app/
│   │   ├── models/           # SQLAlchemy models
│   │   ├── routes/           # API endpoints
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── services/         # Business logic (email scanning, AI)
│   │   ├── auth.py           # JWT + password hashing
│   │   └── main.py           # App entry point
│   ├── alembic/              # Database migrations
│   ├── Procfile              # Render process definition
│   ├── runtime.txt           # Python version for Render
│   ├── requirements.txt
│   └── .env.example
└── frontend/                 # Expo React Native app
    ├── src/
    │   ├── screens/
    │   ├── navigation/
    │   ├── hooks/
    │   ├── services/         # API client (api.js)
    │   └── theme.js
    ├── vercel.json           # Vercel deploy config
    └── App.js
```

---

## Running Locally

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Expo CLI (`npm install -g expo-cli`)

### Backend

```bash
cd backend

python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

pip install -r requirements.txt

createdb subtrackr                 # or create via psql

cp .env.example .env               # fill in values

alembic upgrade head

uvicorn app.main:app --reload
```

API: `http://localhost:8000` · Docs: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npx expo start
```

For OAuth deep links, a development build is required (Expo Go won't handle `subtrackr://`):

```bash
npx expo run:ios     # or run:android
```

---

## Deploying

### Backend — Render

1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your GitHub repo and select the `backend/` directory (or set the root directory to `backend`)
3. Runtime: **Python 3**
4. Build command: `pip install -r requirements.txt`
5. Start command: automatically picked up from `Procfile`

#### Environment variables

Set these in your Render service's **Environment** tab:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Render PostgreSQL internal URL (or external URL) |
| `SECRET_KEY` | your random secret |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `GOOGLE_CLIENT_ID` | from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | from Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://your-service.onrender.com/email/callback/google` |
| `GOOGLE_LOGIN_REDIRECT_URI` | `https://your-service.onrender.com/auth/callback/google` |
| `MICROSOFT_CLIENT_ID` | from Azure portal |
| `MICROSOFT_CLIENT_SECRET` | from Azure portal |
| `MICROSOFT_REDIRECT_URI` | `https://your-service.onrender.com/email/callback/microsoft` |
| `ALLOWED_ORIGINS` | `https://your-project.vercel.app` |
| `FRONTEND_URL` | `https://your-project.vercel.app` |

#### Database

Use Render's managed **PostgreSQL** service (New → PostgreSQL) and copy the internal database URL into `DATABASE_URL`. After the instance is ready, run migrations:

```bash
# with DATABASE_URL set to the Render connection string
alembic upgrade head
```

---

### Frontend — Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo
2. Set the **Root Directory** to `frontend`
3. Vercel will use `vercel.json` for build settings automatically

#### Update API base URL

In `frontend/src/services/api.js`, set:
```js
const BASE_URL = 'https://your-service.onrender.com';
```

Then push — Vercel redeploys on every commit to `main`.

---

## Environment Variables

### Backend (`backend/.env` / Render environment)

See `backend/.env.example` for the full list with descriptions.

Key production values to update from their local defaults:

| Variable | Local | Production |
|----------|-------|------------|
| `DATABASE_URL` | `postgresql://...@localhost/subtrackr` | Render PostgreSQL URL |
| `GOOGLE_REDIRECT_URI` | `http://localhost:8000/...` | `https://your-service.onrender.com/...` |
| `GOOGLE_LOGIN_REDIRECT_URI` | `http://localhost:8000/...` | `https://your-service.onrender.com/...` |
| `ALLOWED_ORIGINS` | _(empty)_ | `https://your-project.vercel.app` |
| `FRONTEND_URL` | `http://localhost:8081` | `https://your-project.vercel.app` |

### Frontend

No `.env` file. Update `BASE_URL` in `src/services/api.js` before deploying.

---

## Google Cloud Console Setup

1. Go to [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add all authorized redirect URIs (local + production):
   - `http://localhost:8000/email/callback/google`
   - `http://localhost:8000/auth/callback/google`
   - `https://your-service.onrender.com/email/callback/google`
   - `https://your-service.onrender.com/auth/callback/google`
4. Go to **OAuth consent screen** → add test users while in Testing mode
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
