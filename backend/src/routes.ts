import express from 'express';
import { AppDataSource } from './db';
import { ScheduledEmail } from './entities/ScheduledEmail';
import { SlackConnection } from './entities/SlackConnection';
import { emailQueue } from './queue';
import { esClient } from './elasticsearch';
import axios from 'axios';

export const router = express.Router();

router.post('/schedule', async (req, res) => {
  const { recipient, subject, body, scheduledTime, senderId } = req.body;
  
  try {
    const repo = AppDataSource.getRepository(ScheduledEmail);
    
    // Save to DB
    const email = repo.create({
      recipient,
      subject,
      body,
      scheduledTime: new Date(scheduledTime),
      senderId: senderId || 'default-sender'
    });
    
    await repo.save(email);

    // Calculate delay
    const delay = Math.max(0, new Date(scheduledTime).getTime() - Date.now());

    // Schedule in BullMQ
    const job = await emailQueue.add('send-email', {
      emailId: email.id,
      senderId: email.senderId
    }, { delay });

    // Update DB with jobId
    email.jobId = job.id as string;
    await repo.save(email);

    // Index to ES as scheduled
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
      }
    });

    res.status(201).json({ message: 'Email scheduled', email });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to schedule email' });
  }
});

router.get('/emails/scheduled', async (req, res) => {
  try {
    const repo = AppDataSource.getRepository(ScheduledEmail);
    const emails = await repo.find({ where: { status: 'scheduled' }, order: { scheduledTime: 'ASC' } });
    res.json(emails);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch scheduled emails' });
  }
});

router.get('/emails/sent', async (req, res) => {
  try {
    const repo = AppDataSource.getRepository(ScheduledEmail);
    const emails = await repo.find({ where: { status: 'sent' }, order: { scheduledTime: 'DESC' } });
    res.json(emails);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sent emails' });
  }
});

router.get('/emails/search', async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }
  
  try {
    const result = await esClient.search({
      index: 'emails',
      query: {
        multi_match: {
          query: q as string,
          fields: ['subject', 'body', 'recipient']
        }
      }
    });
    
    const hits = result.hits.hits.map(h => h._source);
    res.json(hits);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Elasticsearch query failed' });
  }
});

// Mock Slack OAuth endpoint (For testing/demo purposes)
router.post('/slack/connect', async (req, res) => {
  const { senderId, webhookUrl } = req.body;
  try {
    const repo = AppDataSource.getRepository(SlackConnection);
    let connection = await repo.findOne({ where: { senderId } });
    if (!connection) {
      connection = repo.create({ senderId, webhookUrl, accessToken: 'mock_token' });
    } else {
      connection.webhookUrl = webhookUrl;
    }
    await repo.save(connection);
    res.json({ message: 'Slack connected successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to connect slack' });
  }
});
