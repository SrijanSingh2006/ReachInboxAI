import express from 'express';
import { AppDataSource } from './db';
import { ScheduledEmail } from './entities/ScheduledEmail';
import { SlackConnection } from './entities/SlackConnection';
import { emailQueue } from './queue';
import { esClient, esEnabled } from './elasticsearch';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export const router = express.Router();

// ── Health check ─────────────────────────────────────────────────────────────
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Schedule single email ─────────────────────────────────────────────────────
router.post('/schedule', async (req, res) => {
  const {
    recipient,
    subject,
    body,
    scheduledTime,
    senderId,
    delayBetweenEmailsMs,
    maxEmailsPerHour,
  } = req.body;

  if (!recipient || !subject || !body || !scheduledTime) {
    res.status(400).json({ error: 'recipient, subject, body, scheduledTime are required' });
    return;
  }

  try {
    const repo = AppDataSource.getRepository(ScheduledEmail);

    const email = repo.create({
      recipient,
      subject,
      body,
      scheduledTime: new Date(scheduledTime),
      senderId: senderId || 'default-sender',
      delayBetweenEmailsMs: delayBetweenEmailsMs ?? null,
      maxEmailsPerHour: maxEmailsPerHour ?? null,
    });

    await repo.save(email);

    // Delay in ms from now
    const delay = Math.max(0, new Date(scheduledTime).getTime() - Date.now());

    const job = await emailQueue.add(
      'send-email',
      { emailId: email.id, senderId: email.senderId },
      {
        delay,
        jobId: `email-${email.id}`, // deterministic jobId for idempotency
      }
    );

    email.jobId = job.id as string;
    await repo.save(email);

    // Index in Elasticsearch
    if (esEnabled) {
      try {
        await esClient.index({
          index: 'emails',
          id: email.id,
          document: {
            id: email.id,
            recipient: email.recipient,
            subject: email.subject,
            body: email.body,
            status: 'scheduled',
            scheduledTime: email.scheduledTime,
            senderId: email.senderId,
          },
        });
      } catch (esErr) {
        console.warn('Elasticsearch indexing failed (non-fatal):', esErr);
      }
    }

    res.status(201).json({ message: 'Email scheduled', email });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to schedule email' });
  }
});

// ── Bulk schedule (array of recipients) ──────────────────────────────────────
router.post('/schedule/bulk', async (req, res) => {
  const {
    recipients,
    subject,
    body,
    startTime,
    delayBetweenEmailsMs = 2000,
    maxEmailsPerHour = 200,
    senderId = 'default-sender',
  } = req.body;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    res.status(400).json({ error: 'recipients array is required' });
    return;
  }

  try {
    const repo = AppDataSource.getRepository(ScheduledEmail);
    const emailIds: string[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const offsetMs = i * delayBetweenEmailsMs;
      const scheduledTime = new Date(new Date(startTime).getTime() + offsetMs);

      const email = repo.create({
        recipient: recipients[i],
        subject,
        body,
        scheduledTime,
        senderId,
        delayBetweenEmailsMs,
        maxEmailsPerHour,
      });
      await repo.save(email);

      const delay = Math.max(0, scheduledTime.getTime() - Date.now());
      const job = await emailQueue.add(
        'send-email',
        { emailId: email.id, senderId },
        { delay, jobId: `email-${email.id}` }
      );

      email.jobId = job.id as string;
      await repo.save(email);
      emailIds.push(email.id);

      // ES indexing
      try {
        await esClient.index({
          index: 'emails',
          id: email.id,
          document: {
            id: email.id,
            recipient: email.recipient,
            subject,
            body,
            status: 'scheduled',
            scheduledTime,
            senderId,
          },
        });
      } catch (_) { /* non-fatal */ }
    }

    res.status(201).json({ scheduled: recipients.length, emailIds });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Bulk scheduling failed' });
  }
});

// ── Get scheduled emails ──────────────────────────────────────────────────────
router.get('/emails/scheduled', async (_req, res) => {
  try {
    const repo = AppDataSource.getRepository(ScheduledEmail);
    const emails = await repo.find({
      where: { status: 'scheduled' },
      order: { scheduledTime: 'ASC' },
    });
    res.json(emails);
  } catch (_) {
    res.status(500).json({ error: 'Failed to fetch scheduled emails' });
  }
});

// ── Get sent emails ───────────────────────────────────────────────────────────
router.get('/emails/sent', async (_req, res) => {
  try {
    const repo = AppDataSource.getRepository(ScheduledEmail);
    const emails = await repo.find({
      where: { status: 'sent' },
      order: { updatedAt: 'DESC' },
    });
    res.json(emails);
  } catch (_) {
    res.status(500).json({ error: 'Failed to fetch sent emails' });
  }
});

// ── Get all emails ────────────────────────────────────────────────────────────
router.get('/emails/all', async (_req, res) => {
  try {
    const repo = AppDataSource.getRepository(ScheduledEmail);
    const emails = await repo.find({ order: { createdAt: 'DESC' } });
    res.json(emails);
  } catch (_) {
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

// ── Search (ES with DB fallback) ─────────────────────────────────────────────
router.get('/emails/search', async (req, res) => {
  const { q } = req.query;
  if (!q) {
    res.status(400).json({ error: 'Query parameter "q" is required' });
    return;
  }

  // Try Elasticsearch first
  if (esEnabled) {
    try {
      const result = await esClient.search({
        index: 'emails',
        query: {
          multi_match: {
            query: q as string,
            fields: ['subject^2', 'body', 'recipient', 'senderId'],
          },
        },
        size: 50,
      });
      const hits = result.hits.hits.map((h) => h._source);
      res.json(hits);
      return;
    } catch (esError) {
      console.warn('ES search failed, falling back to DB:', esError);
    }
  }

  // DB fallback — LIKE query
  try {
    const repo = AppDataSource.getRepository(ScheduledEmail);
    const term = `%${(q as string).toLowerCase()}%`;
    const emails = await repo
      .createQueryBuilder('email')
      .where('LOWER(email.subject) LIKE :term OR LOWER(email.recipient) LIKE :term OR LOWER(email.body) LIKE :term', { term })
      .orderBy('email.createdAt', 'DESC')
      .limit(50)
      .getMany();
    res.json(emails);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── Get single email by ID ────────────────────────────────────────────────────
router.get('/emails/:id', async (req, res) => {
  try {
    const repo = AppDataSource.getRepository(ScheduledEmail);
    const email = await repo.findOne({ where: { id: req.params.id } });
    if (!email) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }
    res.json(email);
  } catch (_) {
    res.status(500).json({ error: 'Failed to fetch email' });
  }
});

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats', async (_req, res) => {
  try {
    const repo = AppDataSource.getRepository(ScheduledEmail);
    const [scheduled, sent, failed, total] = await Promise.all([
      repo.count({ where: { status: 'scheduled' } }),
      repo.count({ where: { status: 'sent' } }),
      repo.count({ where: { status: 'failed' } }),
      repo.count(),
    ]);
    res.json({ scheduled, sent, failed, total });
  } catch (_) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── Slack OAuth authorize redirect ────────────────────────────────────────────
router.get('/slack/authorize', (req, res) => {
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = process.env.SLACK_REDIRECT_URI;
  const scopes = 'incoming-webhook,chat:write';
  const state = req.query.senderId as string || 'default-sender';
  const url = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri || '')}&state=${encodeURIComponent(state)}`;
  res.redirect(url);
});

// ── Slack OAuth callback ──────────────────────────────────────────────────────
router.get('/slack/oauth', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    res.status(400).json({ error: 'Missing code param' });
    return;
  }

  try {
    const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: process.env.SLACK_REDIRECT_URI,
      },
    });

    const data = response.data as {
      ok: boolean;
      access_token?: string;
      incoming_webhook?: { url?: string };
      error?: string;
    };

    if (!data.ok) {
      res.status(400).json({ error: data.error || 'Slack OAuth failed' });
      return;
    }

    const repo = AppDataSource.getRepository(SlackConnection);
    const senderId = decodeURIComponent((state as string) || 'default-sender');
    let connection = await repo.findOne({ where: { senderId } });

    if (!connection) {
      connection = repo.create({ senderId, accessToken: '', webhookUrl: '' });
    }

    connection.accessToken = data.access_token || '';
    connection.webhookUrl = data.incoming_webhook?.url || '';
    await repo.save(connection);

    // Redirect back to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}?slack=connected`);
  } catch (error) {
    console.error('Slack OAuth error:', error);
    res.status(500).json({ error: 'Failed to complete Slack OAuth' });
  }
});

// ── Slack webhook connect (direct webhook URL) ────────────────────────────────
router.post('/slack/connect', async (req, res) => {
  const { senderId, webhookUrl } = req.body;
  try {
    const repo = AppDataSource.getRepository(SlackConnection);
    let connection = await repo.findOne({ where: { senderId } });
    if (!connection) {
      connection = repo.create({ senderId, webhookUrl, accessToken: 'webhook-direct' });
    } else {
      connection.webhookUrl = webhookUrl;
    }
    await repo.save(connection);
    res.json({ message: 'Slack connected successfully' });
  } catch (_) {
    res.status(500).json({ error: 'Failed to connect Slack' });
  }
});

// ── Slack status ──────────────────────────────────────────────────────────────
router.get('/slack/status/:senderId', async (req, res) => {
  try {
    const repo = AppDataSource.getRepository(SlackConnection);
    const connection = await repo.findOne({ where: { senderId: req.params.senderId } });
    res.json({
      connected: !!(connection && connection.webhookUrl),
      webhookUrl: connection?.webhookUrl,
    });
  } catch (_) {
    res.status(500).json({ error: 'Failed to fetch Slack status' });
  }
});

// ── Slack disconnect ──────────────────────────────────────────────────────────
router.delete('/slack/disconnect/:senderId', async (req, res) => {
  try {
    const repo = AppDataSource.getRepository(SlackConnection);
    await repo.delete({ senderId: req.params.senderId });
    res.json({ message: 'Slack disconnected' });
  } catch (_) {
    res.status(500).json({ error: 'Failed to disconnect Slack' });
  }
});
