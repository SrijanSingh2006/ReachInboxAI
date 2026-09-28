# ReachInbox Hiring Assignment – Full-stack Email Job Scheduler

## Architecture Overview
This is a production-grade email scheduler service and dashboard.
It consists of two main components:
1. **Backend (Node.js/Express + BullMQ + TypeORM + Elasticsearch)**
2. **Frontend (Next.js 15 App Router + TailwindCSS + NextAuth)**

### How Scheduling Works
- When a user schedules an email, the backend saves the email record in the **PostgreSQL** database with a status of `scheduled`.
- It then calculates the delay (in milliseconds) from the current time to the target `scheduledTime` and adds a delayed job to **BullMQ**.
- BullMQ (backed by **Redis**) stores this job. BullMQ's native delayed jobs feature handles the timing efficiently without using cron.
- Once the delay expires, the BullMQ worker picks up the job.

### Persistence on Restart
- Because the jobs are stored in Redis using BullMQ, if the Node server restarts, the delayed jobs are not lost. 
- When the worker restarts, it reconnects to Redis and resumes processing any jobs that are due. The state in the DB ensures we only process emails that haven't been successfully sent.

### Rate Limiting & Concurrency
- **Concurrency**: The BullMQ worker is instantiated with `{ concurrency: 5 }`, allowing up to 5 emails to be processed in parallel.
- **Rate Limiting**: Implemented via Redis counters keyed by `rate_limit:senderId:YYYY-MM-DDTHH`. If a user exceeds `MAX_EMAILS_PER_HOUR`, jobs are rescheduled to the next hour window using BullMQ `delay`, and a Slack notification is triggered.
- **Minimum Delay**: A global lock in Redis (`global_email_delay`) ensures at least a 2-second delay between any emails going out. If the lock is held, the job is briefly re-queued.

### Features Implemented
- **Backend:**
  - Scheduler with BullMQ delayed jobs.
  - Rate limiting & minimum delay between emails via Redis logic.
  - Elasticsearch indexing on scheduled/sent emails.
  - BullMQ Dashboard exposed at `/admin/queues`.
  - TypeORM with Postgres.
- **Frontend:**
  - Google OAuth Login (via NextAuth).
  - Main Dashboard with Scheduled/Sent tabs.
  - Compose New Email with CSV parsing capability.
  - Matches the aesthetic structure requested.

## Setup Instructions

### 1. Prerequisites
- Docker (for Postgres, Redis, Elasticsearch)
- Node.js (v18+)

### 2. Infra Setup (Docker)
In the root directory, start the infrastructure:
```bash
docker compose up -d
```
*(Wait a few seconds for Elasticsearch and Postgres to fully initialize)*

### 3. Backend Setup
```bash
cd backend
npm install

# Setup your Ethereal Email and Slack credentials in backend/.env
# PORT=5000
# REDIS_HOST=localhost
# REDIS_PORT=6379
# DB_HOST=localhost
# DB_PORT=5432
# DB_USER=reachinbox
# DB_PASS=reachinboxpassword
# DB_NAME=reachinboxdb
# ELASTICSEARCH_NODE=http://localhost:9200
# SMTP_HOST=smtp.ethereal.email
# SMTP_PORT=587
# SMTP_USER=your_ethereal_user
# SMTP_PASS=your_ethereal_pass
# SLACK_CLIENT_ID=slack_client_id
# SLACK_CLIENT_SECRET=slack_client_secret
# MAX_EMAILS_PER_HOUR=200
# MIN_DELAY_BETWEEN_EMAILS_MS=2000

# Start backend (this creates tables, indexes, and starts worker)
npm run start
```
*Note: If using `ts-node`, run `npx ts-node src/index.ts` or set it up in package.json scripts.*

### 4. Frontend Setup
```bash
cd frontend
npm install

# Setup NextAuth in frontend/.env.local
# NEXTAUTH_URL=http://localhost:3000
# NEXTAUTH_SECRET=a_very_secure_random_string
# GOOGLE_CLIENT_ID=your_google_oauth_client_id
# GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
# NEXT_PUBLIC_API_URL=http://localhost:5000/api

npm run dev
```

### 5. Access
- Frontend App: `http://localhost:3000`
- BullMQ Dashboard: `http://localhost:5000/admin/queues`
