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
| Backend hosting | AWS Elastic Beanstalk |
| Frontend hosting | AWS S3 + CloudFront |
| Database hosting | AWS RDS (PostgreSQL) |

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
│   ├── .ebextensions/        # Elastic Beanstalk config
│   ├── Procfile              # EB process definition
│   ├── requirements.txt
│   └── .env.example
└── frontend/                 # Expo React Native app
    ├── src/
    │   ├── screens/
    │   ├── navigation/
    │   ├── hooks/
    │   ├── services/         # API client (api.js)
    │   └── theme.js
    ├── deploy.sh             # S3 + CloudFront deploy script
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

## Deploying to AWS

### 1. RDS PostgreSQL

1. Open the [RDS console](https://console.aws.amazon.com/rds/) → **Create database**
2. Engine: **PostgreSQL 15+**
3. Template: **Free tier** (dev) or **Production**
4. DB instance identifier: `subtrackr-db`
5. Master username / password: choose and save these
6. Under **Connectivity** → set VPC, enable **Public access** if EB needs to reach it, or keep private and place both in the same VPC
7. Create database, then note the **Endpoint** (e.g. `subtrackr-db.xxxx.us-east-1.rds.amazonaws.com`)

Connection string format:
```
postgresql://username:password@subtrackr-db.xxxx.us-east-1.rds.amazonaws.com:5432/subtrackr
```

After the instance is available, connect and create the database:
```bash
psql -h <rds-endpoint> -U <username> -c "CREATE DATABASE subtrackr;"
alembic upgrade head   # run from backend/ with DATABASE_URL set to the RDS URL
```

---

### 2. Backend — Elastic Beanstalk

#### Prerequisites
```bash
pip install awsebcli
eb --version
```

#### Initial setup
```bash
cd backend

# Initialize EB application (choose Python 3.11, us-east-1 or your region)
eb init subtrackr-backend --platform python-3.11 --region us-east-1

# Create environment
eb create subtrackr-prod
```

#### Set environment variables in EB console

Go to your EB environment → **Configuration** → **Software** → **Environment properties** and add:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://user:pass@rds-endpoint:5432/subtrackr` |
| `SECRET_KEY` | your random secret |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `GOOGLE_CLIENT_ID` | from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | from Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://your-env.elasticbeanstalk.com/email/callback/google` |
| `GOOGLE_LOGIN_REDIRECT_URI` | `https://your-env.elasticbeanstalk.com/auth/callback/google` |
| `MICROSOFT_CLIENT_ID` | from Azure portal |
| `MICROSOFT_CLIENT_SECRET` | from Azure portal |
| `MICROSOFT_REDIRECT_URI` | `https://your-env.elasticbeanstalk.com/email/callback/microsoft` |
| `ALLOWED_ORIGINS` | `https://your-cloudfront-id.cloudfront.net` |
| `FRONTEND_URL` | `https://your-cloudfront-id.cloudfront.net` |

#### Deploy
```bash
cd backend
eb deploy
```

Note your EB URL (e.g. `https://subtrackr-prod.us-east-1.elasticbeanstalk.com`).

#### Update Google Cloud Console redirect URIs

Add your production URIs alongside the existing localhost ones:
- `https://your-env.elasticbeanstalk.com/email/callback/google`
- `https://your-env.elasticbeanstalk.com/auth/callback/google`

---

### 3. Frontend — S3 + CloudFront

#### Create S3 bucket

1. Go to [S3 console](https://s3.console.aws.amazon.com/) → **Create bucket**
2. Name: `subtrackr-web` (must be globally unique)
3. Uncheck **Block all public access**
4. Enable **Static website hosting** → index document: `index.html`, error document: `index.html`
5. Add bucket policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::subtrackr-web/*"
  }]
}
```

#### Create CloudFront distribution

1. Go to [CloudFront console](https://console.aws.amazon.com/cloudfront/) → **Create distribution**
2. Origin domain: select your S3 bucket's website endpoint
3. Default root object: `index.html`
4. Under **Error pages**: add a custom error response — HTTP 403/404 → `/index.html`, HTTP 200
5. Create distribution, note the **Distribution domain name** (e.g. `xyz.cloudfront.net`)

#### Update API base URL

In `frontend/src/services/api.js`, change:
```js
const BASE_URL = 'https://your-env.elasticbeanstalk.com';
```

#### Build and deploy

```bash
cd frontend

# First-time or after BASE_URL change:
S3_BUCKET=subtrackr-web CF_DIST_ID=EXXXXXXXXXX ./deploy.sh
```

The script builds the Expo web export, syncs to S3 with correct cache headers, and invalidates CloudFront.

---

## Environment Variables

### Backend (`backend/.env` / EB environment properties)

See `backend/.env.example` for the full list with descriptions.

Key production values to update from their local defaults:

| Variable | Local | Production |
|----------|-------|------------|
| `DATABASE_URL` | `postgresql://...@localhost/subtrackr` | RDS endpoint URL |
| `GOOGLE_REDIRECT_URI` | `http://localhost:8000/...` | `https://your-eb.elasticbeanstalk.com/...` |
| `GOOGLE_LOGIN_REDIRECT_URI` | `http://localhost:8000/...` | `https://your-eb.elasticbeanstalk.com/...` |
| `ALLOWED_ORIGINS` | _(empty)_ | `https://your-cloudfront.net` |
| `FRONTEND_URL` | `http://localhost:8081` | `https://your-cloudfront.net` |

### Frontend

No `.env` file. Update `BASE_URL` in `src/services/api.js` before building for production.

---

## Google Cloud Console Setup

1. Go to [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add all authorized redirect URIs (local + production):
   - `http://localhost:8000/email/callback/google`
   - `http://localhost:8000/auth/callback/google`
   - `https://your-env.elasticbeanstalk.com/email/callback/google`
   - `https://your-env.elasticbeanstalk.com/auth/callback/google`
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
