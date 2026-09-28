import { Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { connection, emailQueue } from './queue';
import { AppDataSource } from './db';
import { ScheduledEmail } from './entities/ScheduledEmail';
import { esClient } from './elasticsearch';
import { sendSlackNotification } from './slack';
import dotenv from 'dotenv';

dotenv.config();

const MIN_DELAY_MS = parseInt(process.env.MIN_DELAY_BETWEEN_EMAILS_MS || '2000');
const MAX_EMAILS_PER_HOUR = parseInt(process.env.MAX_EMAILS_PER_HOUR || '200');

// Create Ethereal SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const getHourWindowKey = (senderId: string) => {
  const currentHour = new Date().toISOString().slice(0, 13); // yyyy-mm-ddThh
  return `rate_limit:${senderId}:${currentHour}`;
};

const checkRateLimit = async (senderId: string): Promise<boolean> => {
  const key = getHourWindowKey(senderId);
  const count = await connection.get(key);
  if (count && parseInt(count) >= MAX_EMAILS_PER_HOUR) {
    return false; // Limit reached
  }
  return true;
};

const incrementRateLimit = async (senderId: string) => {
  const key = getHourWindowKey(senderId);
  const multi = connection.multi();
  multi.incr(key);
  multi.expire(key, 3600); // expire in 1 hour
  await multi.exec();
};

const checkAndSetGlobalDelay = async (): Promise<boolean> => {
  // Use a global lock/key to enforce min delay between any emails
  const key = 'global_email_delay';
  const set = await connection.set(key, 'locked', 'PX', MIN_DELAY_MS, 'NX');
  return set !== null; // true if successfully acquired, false if locked
};

export const startWorker = () => {
  const worker = new Worker('email-queue', async (job: Job) => {
    const { emailId, senderId } = job.data;
    
    // 1. Check Rate Limit
    const canSend = await checkRateLimit(senderId);
    if (!canSend) {
      // Send Slack Notification
      // We should check if we already notified this hour to avoid spam
      const notifiedKey = `notified:${senderId}:${new Date().toISOString().slice(0, 13)}`;
      const alreadyNotified = await connection.get(notifiedKey);
      if (!alreadyNotified) {
        await sendSlackNotification(senderId, `Alert: Rate limit of ${MAX_EMAILS_PER_HOUR} emails/hour reached! Delaying further emails.`);
        await connection.set(notifiedKey, 'true', 'EX', 3600);
      }

      // Delay job to next hour window
      const currentMin = new Date().getMinutes();
      const delayMs = (60 - currentMin + 1) * 60 * 1000;
      await emailQueue.add(job.name, job.data, { delay: delayMs });
      return { status: 'rate-limited', message: 'Delayed due to rate limits' };
    }

    // 2. Enforce minimum delay between emails
    const canProceed = await checkAndSetGlobalDelay();
    if (!canProceed) {
        // Re-queue with short delay
        await emailQueue.add(job.name, job.data, { delay: MIN_DELAY_MS });
        return { status: 'delayed', message: 'Delayed for concurrency minimum time' };
    }

    // 3. Process email
    const repo = AppDataSource.getRepository(ScheduledEmail);
    const scheduledEmail = await repo.findOne({ where: { id: emailId } });
    
    if (!scheduledEmail) {
      throw new Error(`Email with ID ${emailId} not found in DB`);
    }

    if (scheduledEmail.status === 'sent') {
       console.log(`Email ${emailId} was already sent. Skipping.`);
       return { status: 'skipped', message: 'Already sent' };
    }

    try {
      // Send via SMTP
      const info = await transporter.sendMail({
        from: `"ReachInbox Sender" <${process.env.SMTP_USER}>`,
        to: scheduledEmail.recipient,
        subject: scheduledEmail.subject,
        text: scheduledEmail.body,
      });

      console.log(`Email sent: ${info.messageId}`);
      console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);

      // Update DB
      scheduledEmail.status = 'sent';
      await repo.save(scheduledEmail);

      // Increment Rate Limit counter
      await incrementRateLimit(senderId);

      // Index in Elasticsearch
      await esClient.index({
        index: 'emails',
        id: scheduledEmail.id,
        document: {
          id: scheduledEmail.id,
          recipient: scheduledEmail.recipient,
          subject: scheduledEmail.subject,
          body: scheduledEmail.body,
          status: 'sent',
          scheduledTime: scheduledEmail.scheduledTime,
        }
      });

      return { status: 'sent', info };

    } catch (error) {
      console.error(`Failed to send email ${emailId}`, error);
      scheduledEmail.status = 'failed';
      await repo.save(scheduledEmail);
      throw error; // Will trigger BullMQ retries
    }
  }, {
    connection,
    concurrency: 5, // Process up to 5 jobs concurrently
  });

  worker.on('failed', (job, err) => {
    if (job) {
      console.error(`Job ${job.id} failed with error ${err.message}`);
    }
  });

  console.log('BullMQ Worker started');
};
