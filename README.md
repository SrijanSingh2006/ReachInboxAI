# ReachInbox AI — Distributed Email Job Scheduler

> **Enterprise-grade cold email queuing and delivery platform** built with **Next.js 16**, **Express**, **BullMQ**, **Upstash Cloud Redis**, **Supabase Cloud PostgreSQL**, and **Google Gmail SMTP**.

---

## 1. Project Overview & Problem Statement

### The Real-World Problem
Modern cold outreach platforms, sales engagement tools (e.g., ReachInbox, Lemlist, Instantly), and transactional email services send millions of outbound emails every day. However, naïve implementations that fire HTTP requests or SMTP packets synchronously face severe technical and operational issues:

1. **Mailbox Warming & Spam Throttling:** Sending 500 emails simultaneously triggers spam filters (Gmail, Outlook, Spamhaus) and blacklists your sending domain or IP address within minutes.
2. **Rate Limit Breaches:** Email service providers impose strict hourly and daily rate limits (e.g., 200 emails/hour, 2,000/day). Exceeding these limits leads to dropped connections and temporary account bans.
3. **Server Crashes & Lost Jobs:** If an in-memory queue or single server process crashes mid-batch, in-flight emails are lost forever without recovery mechanisms.
4. **Duplicate Dispatch:** Network timeouts often cause retries that accidentally email the same prospect multiple times, destroying sender reputation.

### The Solution: ReachInbox Architecture
ReachInbox implements a robust, fault-tolerant **distributed asynchronous task queue** powered by **BullMQ** and **Redis**:
- **Controlled Cadence:** Configurable minimum delay (e.g., 2,000 ms) between every outbound email to emulate human sending behavior.
- **Sliding-Window Rate Limiting:** Enforces strict limits (default: 200 emails/hour per sender) using atomic Redis key expiration. When limits are exceeded, jobs are automatically re-queued into the next hour window.
- **Persistent State & Idempotency:** Every email is assigned a deterministic UUID and job ID (`email-${id}`). The worker checks database status before dispatching, preventing duplicate sends even during network retries.
- **Exponential Backoff:** If SMTP delivery fails due to temporary network issues, BullMQ retries the job with exponential backoff before marking it failed.
- **Live Observability:** Real-time 3D Axonometric charts, delivery metrics, and an integrated Bull-Board queue monitor.

---

## 2. Technology Stack (A to Z)

| Layer | Technology | Role & Architecture Details |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 16 (Turbopack)** | React 19, Server & Client Components, App Router, responsive design |
| **Styling & Icons** | **TailwindCSS & Lucide Icons** | Custom glassmorphism, 3D SVG isometric chart visualizer, dark/light theme |
| **Authentication** | **NextAuth.js (v4)** | Google OAuth 2.0 integration + instant single-click session provider |
| **Backend Runtime** | **Node.js & Express (TypeScript)** | RESTful API server, input validation, CSV ingestion engine |
| **Queue & Worker Engine** | **BullMQ + ioredis** | High-throughput Redis-backed persistent job queue with 5x concurrency |
| **Queue Cache & Locks** | **Upstash Cloud Redis** | Cloud Redis with TLS, atomic sliding-window rate limit counters, distributed locks |
| **Primary Database** | **Supabase Cloud PostgreSQL** | Cloud relational database connected via AWS IPv4 Session Pooler with TypeORM |
| **Email Gateway** | **Google Gmail SMTP** | Authenticated dispatch over Port 587 (TLS) using Google App Passwords |
| **Queue Monitoring** | **Bull-Board (`@bull-board/express`)** | Real-time queue inspection GUI at `/admin/queues` (Active, Delayed, Completed, Failed) |
| **Alerts & Webhooks** | **Slack Webhook Integration** | Automatic notifications when a sender reaches their hourly rate limit |

---

## 3. System Architecture & Data Flow

```
[ Next.js Client / CSV Upload ]
               │
               ▼  (HTTP POST /api/schedule)
┌──────────────────────────────────────────────┐
│            Express REST API                  │
│  - Validates payload (recipient, subject)   │
│  - Records email in Supabase (status='sched')│
│  - Pushes delayed job to BullMQ Queue        │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│           Upstash Cloud Redis                │
│  - Stores job payload & delay timers         │
│  - Tracks sender rate limit counters         │
│  - Manages atomic distributed delay locks    │
└──────────────────────┬───────────────────────┘
                       │
                       ▼  (Worker polls on schedule)
┌──────────────────────────────────────────────┐
│            BullMQ Worker Engine              │
│  1. Idempotency Check (status !== 'sent')    │
│  2. Rate Limit Verification (max/hr)         │
│  3. Global Min Delay Lock (2000ms gap)       │
│  4. SMTP Dispatch via Google Gmail           │
│  5. Updates Supabase record (status='sent')  │
│  6. Increments hourly rate limit counter     │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
         [ Recipient Inbox Delivered ]
```

---

## 4. Key Features

- **Bulk CSV Upload:** Drag-and-drop recipient list parsing via PapaParse with duplicate deduplication.
- **Live 3D Axonometric Analytics:** Interactive 3D isometric bar charts and delivery efficiency donut graphs visualizing Queued, Sent, and Failed metrics.
- **Dual Authentication Modes:** Single-click "Continue with Google" (authenticated as Srijan Singh / `sspersonal2003@gmail.com`) and "One-Click Demo Access".
- **Dynamic Cadence Control:** Set custom millisecond delays between individual messages and enforce hourly batch limits.
- **Real-Time Queue Dashboard:** Visual inspection of Redis jobs, active workers, delays, and retry attempts via Bull-Board.
- **Search & Filter:** Instant search across recipient addresses, subjects, and email body content with database fallbacks.
- **Slack Alerting:** Instant webhook notifications triggered if a sender account hits its hourly throughput threshold.

---

## 5. Repository Structure

```
ReachInboxAI/
├── backend/                        # Express API & BullMQ Worker
│   ├── src/
│   │   ├── entities/               # TypeORM Database Entities
│   │   │   ├── ScheduledEmail.ts   # Email entity (UUID, status, timestamps)
│   │   │   └── SlackConnection.ts  # Slack webhook settings entity
│   │   ├── db.ts                   # TypeORM Data Source (PostgreSQL/Supabase)
│   │   ├── queue.ts                # BullMQ queue & Upstash Redis connection
│   │   ├── worker.ts               # Worker processor, rate limiter, SMTP sender
│   │   ├── routes.ts               # Express API endpoints & search logic
│   │   ├── slack.ts                # Slack alerting service
│   │   └── index.ts                # Application entrypoint & Bull-Board setup
│   ├── .env                        # Backend environment configuration
│   ├── Dockerfile                  # Production container image for backend
│   └── package.json
│
├── frontend/                       # Next.js 16 Web Application
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/auth/           # NextAuth route handler
│   │   │   ├── page.tsx            # Main dashboard, 3D visualizer, & modal
│   │   │   └── globals.css         # Styling system & dark mode tokens
│   │   ├── lib/api.ts              # Frontend API client
│   │   └── types/index.ts          # TypeScript type definitions
│   ├── .env.local                  # Frontend environment configuration
│   ├── Dockerfile                  # Production container image for frontend
│   └── package.json
│
├── test.csv                        # Sample CSV file for testing bulk campaigns
├── docker-compose.yml              # Local infrastructure orchestration
├── docker-compose.prod.yml         # Production multi-container orchestration
└── README.md                       # Comprehensive project documentation
```

---

## 6. Environment Variables Reference

### Backend (`backend/.env`)

```env
PORT=5000

# Upstash Cloud Redis (Queue & Locks)
REDIS_HOST=tight-chamois-196865.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your_upstash_redis_password
REDIS_TLS=true

# Supabase Cloud PostgreSQL (Data Persistence)
DB_TYPE=postgres
DB_HOST=aws-0-ap-southeast-1.pooler.supabase.com
DB_PORT=5432
DB_USER=postgres.your_project_ref
DB_PASS=your_supabase_db_password
DB_NAME=postgres
DB_SSL=true

# Google Gmail SMTP (Verified Dispatch)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=sspersonal2003@gmail.com
SMTP_PASS=your_16_char_google_app_password

# Rate Limiting & Concurrency Policies
MAX_EMAILS_PER_HOUR=200
MIN_DELAY_BETWEEN_EMAILS_MS=2000
WORKER_CONCURRENCY=5
```

### Frontend (`frontend/.env.local`)

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=reachinbox_secret_key_12345
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

---

## 7. Local Setup & Quick Start

### 1. Prerequisites
- **Node.js:** v18 or later
- **npm:** v9 or later
- **Internet Connection:** To reach Upstash Redis, Supabase, and Gmail SMTP

### 2. Start the Backend API & Queue Worker
```bash
cd backend
npm install
npm start
```
*The server will boot on `http://localhost:5000`, connect to Supabase PostgreSQL via TypeORM, establish TLS to Upstash Redis, and start the BullMQ worker.*

### 3. Start the Next.js Frontend
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
*The frontend will launch on `http://localhost:3000`.*

---

## 8. Step-by-Step Testing & Verification Guide

### Step 1: Open the Application
Navigate to **[http://localhost:3000](http://localhost:3000)** in your browser.

### Step 2: Authenticate
Click **Continue with Google** to sign in as **Srijan Singh** (`sspersonal2003@gmail.com`), or choose **One-Click Demo Access**. Notice the green connection beacon indicating active communication with the backend.

### Step 3: Schedule a Campaign
1. Click the **+ New Campaign** button in the top right.
2. The **Sender Email** automatically defaults to `sspersonal2003@gmail.com`.
3. Enter a **Subject** (e.g., `ReachInbox Live Delivery Test`) and a **Body**.
4. Drag and drop the included [`test.csv`](test.csv) file (or type in a recipient).
5. Set a scheduled time (immediate or future) and click **Schedule Batch**.

### Step 4: Verify Delivery
- **Queue State:** Visit `http://localhost:5000/admin/queues` to see BullMQ transition the job from `delayed` -> `active` -> `completed`.
- **Sent Records:** In the web application, click the **Sent** tab to inspect the delivered email timestamp, recipient, and status.
- **Inbox:** Check the recipient's real inbox to view the delivered email sent directly from your Google account.
- **Analytics:** Switch to the **Analytics** tab to view the live 3D Axonometric charts reflecting the delivery.

---

## 9. API Reference

| Method | Endpoint | Description | Payload Example |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Healthcheck and timestamp | — |
| `POST` | `/api/schedule` | Schedule single email or batch | `{"recipient":"test@domain.com","subject":"Hi","body":"Msg","scheduledTime":"2026-10-05T04:00:00Z","senderId":"sspersonal2003@gmail.com"}` |
| `GET` | `/api/emails/all` | List all emails (paginated/ordered) | — |
| `GET` | `/api/emails/scheduled` | List pending / delayed emails | — |
| `GET` | `/api/emails/sent` | List delivered emails | — |
| `GET` | `/api/emails/stats` | Aggregate queue stats (`total`, `scheduled`, `sent`, `failed`) | — |
| `GET` | `/api/emails/search?q=:query`| Search emails by subject, recipient, or body | — |
| `POST` | `/api/slack/save-url` | Configure Slack webhook URL | `{"senderId":"...","webhookUrl":"https://hooks.slack.com/..."}` |
| `GET` | `/api/slack/status?senderId=...` | Retrieve Slack webhook connection status | — |

---

## 10. Production Deployment

### Option A: Cloud Deployment (Render + Vercel)
1. **Backend (Render / Railway):**
   - Push repository to GitHub.
   - Create a **Web Service** pointing to the `backend` directory.
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Set all environment variables from `backend/.env`.
2. **Frontend (Vercel):**
   - Import the repository on Vercel and select the `frontend` root directory.
   - Set `NEXT_PUBLIC_API_URL` to your live Render backend URL (`https://your-backend.onrender.com/api`).
   - Set `NEXTAUTH_URL` to your production domain.

### Option B: Docker Compose
Run the production multi-container stack locally or on a VPS:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 11. Security & Best Practices

- **Zero Plaintext Secrets in Code:** All database credentials, Redis tokens, and SMTP passwords reside exclusively in `.env` files (excluded via `.gitignore`).
- **Encrypted Transmission:** All Redis traffic uses TLS, Supabase connections use SSL, and SMTP traffic runs over encrypted TLS (Port 587).
- **Anti-Spam Throttling:** Strict minimum delays and per-sender sliding hour limits prevent domain blacklisting.
- **Idempotency Locks:** Deterministic job keys prevent double-send race conditions during high-concurrency spikes.
