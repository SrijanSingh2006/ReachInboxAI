import { Worker, Job } from 'bullmq';
import nodemailer, { Transporter } from 'nodemailer';
import { connection, emailQueue } from './queue';
import { AppDataSource } from './db';
import { ScheduledEmail } from './entities/ScheduledEmail';
import { esClient, esEnabled } from './elasticsearch';
import { sendSlackNotification } from './slack';
import dotenv from 'dotenv';

dotenv.config();

const MIN_DELAY_MS = parseInt(process.env.MIN_DELAY_BETWEEN_EMAILS_MS || '2000');
const MAX_EMAILS_PER_HOUR = parseInt(process.env.MAX_EMAILS_PER_HOUR || '200');
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5');

// ── SMTP Transporter (Gmail / Custom SMTP / Sandbox) ───────────────────────
let transporter: Transporter;
let fromEmail = 'noreply@reachinbox.ai';

const getTransporter = async () => {
  if (transporter) return transporter;

  if (process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_USER !== 'ethereal_user') {
    // Use configured credentials
    fromEmail = process.env.SMTP_USER;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587'),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log(`SMTP configured with user: ${process.env.SMTP_USER}`);
  } else {
    // Auto-create an Ethereal account
    const testAccount = await nodemailer.createTestAccount();
    fromEmail = testAccount.user;
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log(`\n📧 Auto-created Ethereal account: ${testAccount.user}`);
    console.log(`📧 View emails at: https://ethereal.email/messages\n`);
  }
  return transporter;
};

// ── Rate limit helpers ─────────────────────────────────────────────────────
const getHourWindowKey = (senderId: string) => {
  const currentHour = new Date().toISOString().slice(0, 13); // yyyy-mm-ddThh
  return `rate_limit:${senderId}:${currentHour}`;
};

const checkRateLimit = async (senderId: string, limit: number): Promise<boolean> => {
  const key = getHourWindowKey(senderId);
  const count = await connection.get(key);
  return !count || parseInt(count) < limit;
};

const incrementRateLimit = async (senderId: string) => {
  const key = getHourWindowKey(senderId);
  const multi = connection.multi();
  multi.incr(key);
  multi.expire(key, 3600);
  await multi.exec();
};

// ── Global delay enforcement (min gap between any emails) ──────────────────
const acquireGlobalDelay = async (): Promise<boolean> => {
  const key = 'global_email_delay';
  const result = await connection.set(key, 'locked', 'PX', MIN_DELAY_MS, 'NX');
  return result !== null;
};

// ── Worker ────────────────────────────────────────────────────────────────
export const startWorker = () => {
  const worker = new Worker(
    'email-queue',
    async (job: Job) => {
      const { emailId, senderId } = job.data;

      // ── 1. Load email record from DB ───────────────────────────────────
      const repo = AppDataSource.getRepository(ScheduledEmail);
      const scheduledEmail = await repo.findOne({ where: { id: emailId } });

      if (!scheduledEmail) {
        console.warn(`Email ${emailId} not found — may have been deleted.`);
        return { status: 'not-found' };
      }

      // ── 2. Idempotency check ───────────────────────────────────────────
      if (scheduledEmail.status === 'sent') {
        console.log(`Email ${emailId} already sent — skipping (idempotent).`);
        return { status: 'skipped', message: 'Already sent' };
      }

      // ── 3. Effective rate limit (per-email override or global env) ─────
      const effectiveLimit =
        scheduledEmail.maxEmailsPerHour ?? MAX_EMAILS_PER_HOUR;

      const canSend = await checkRateLimit(senderId, effectiveLimit);
      if (!canSend) {
        // Notify Slack once per hour per sender
        const notifiedKey = `notified:${senderId}:${new Date().toISOString().slice(0, 13)}`;
        const alreadyNotified = await connection.get(notifiedKey);
        if (!alreadyNotified) {
          await sendSlackNotification(
            senderId,
            `⚠️ *Rate limit reached* for sender \`${senderId}\`.\nLimit: ${effectiveLimit} emails/hour. Further emails are being delayed to the next hour window.`
          );
          await connection.set(notifiedKey, 'true', 'EX', 3600);
        }

        // Re-queue into next hour window (preserve order as much as possible)
        const currentMin = new Date().getMinutes();
        const delayMs = (60 - currentMin + 1) * 60 * 1000;
        console.log(`Rate limit hit for ${senderId}. Rescheduling in ${Math.round(delayMs / 60000)} min.`);

        await emailQueue.add(job.name, job.data, { delay: delayMs });
        return { status: 'rate-limited', rescheduledInMs: delayMs };
      }

      // ── 4. Global min delay between emails ─────────────────────────────
      const canProceed = await acquireGlobalDelay();
      if (!canProceed) {
        // Re-queue with the min delay — will be picked up after lock expires
        await emailQueue.add(job.name, job.data, { delay: MIN_DELAY_MS });
        return { status: 'delayed', message: 'Global min delay enforced' };
      }

      // ── 5. Send email ──────────────────────────────────────────────────
      try {
        const smtp = await getTransporter();

        const info = await smtp.sendMail({
          from: `"ReachInbox Scheduler" <${fromEmail}>`,
          to: scheduledEmail.recipient,
          subject: scheduledEmail.subject,
          text: scheduledEmail.body,
          html: `<div style="font-family:sans-serif;">${scheduledEmail.body.replace(/\n/g, '<br>')}</div>`,
        });

        const previewUrl = nodemailer.getTestMessageUrl(info) || null;
        console.log(`✅ Email sent to ${scheduledEmail.recipient} | Preview: ${previewUrl}`);

        // ── 6. Update DB ───────────────────────────────────────────────
        scheduledEmail.status = 'sent';
        scheduledEmail.sentAt = new Date();
        scheduledEmail.etherealPreviewUrl = previewUrl as string | null;
        await repo.save(scheduledEmail);

        // ── 7. Increment rate limit counter ───────────────────────────
        await incrementRateLimit(senderId);

        // ── 8. Update Elasticsearch ────────────────────────────────────
        if (esEnabled) {
          try {
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
                sentAt: scheduledEmail.sentAt,
                senderId: scheduledEmail.senderId,
              },
            });
          } catch (esErr) {
            console.warn('ES update failed (non-fatal):', esErr);
          }
        }

        return { status: 'sent', previewUrl, messageId: info.messageId };
      } catch (error) {
        console.error(`❌ Failed to send email ${emailId}:`, error);
        scheduledEmail.status = 'failed';
        await repo.save(scheduledEmail);

        // Update ES to failed
        try {
          await esClient.update({
            index: 'emails',
            id: scheduledEmail.id,
            doc: { status: 'failed' },
          });
        } catch (_) { /* non-fatal */ }

        throw error; // Triggers BullMQ retries
      }
    },
    {
      connection,
      concurrency: WORKER_CONCURRENCY,
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed:`, result?.status);
  });

  worker.on('failed', (job, err) => {
    if (job) {
      console.error(`Job ${job.id} failed (attempt ${job.attemptsMade}):`, err.message);
    }
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  console.log(`🚀 BullMQ Worker started (concurrency: ${WORKER_CONCURRENCY}, min-delay: ${MIN_DELAY_MS}ms, max/hr: ${MAX_EMAILS_PER_HOUR})`);
  return worker;
};
