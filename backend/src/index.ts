import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './db';
import { initElasticsearch } from './elasticsearch';
import { startWorker } from './worker';
import { router } from './routes';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { emailQueue } from './queue';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: [frontendUrl, 'http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── BullMQ Bull Board ───────────────────────────────────────────────────────
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api', router);
app.use('/admin/queues', serverAdapter.getRouter());

// Root
app.get('/', (_req, res) => {
  res.json({
    service: 'ReachInbox Email Scheduler API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      schedule: 'POST /api/schedule',
      bulkSchedule: 'POST /api/schedule/bulk',
      scheduledEmails: 'GET /api/emails/scheduled',
      sentEmails: 'GET /api/emails/sent',
      allEmails: 'GET /api/emails/all',
      search: 'GET /api/emails/search?q=<query>',
      stats: 'GET /api/stats',
      slackStatus: 'GET /api/slack/status/:senderId',
      slackConnect: 'POST /api/slack/connect',
      slackOAuth: 'GET /api/slack/oauth (callback)',
      bullMQDashboard: '/admin/queues',
    },
  });
});

// ── Startup ─────────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  await initElasticsearch();
  startWorker();

  app.listen(port, () => {
    console.log(`\n🚀 Server running on http://localhost:${port}`);
    console.log(`📊 BullMQ Dashboard: http://localhost:${port}/admin/queues`);
    console.log(`📡 API Root:         http://localhost:${port}/api`);
    console.log(`❤️  Health Check:    http://localhost:${port}/api/health\n`);
  });
};

start().catch(console.error);
