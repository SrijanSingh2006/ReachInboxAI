import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redisOptions: any = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
};

if (process.env.REDIS_PASSWORD) {
  redisOptions.password = process.env.REDIS_PASSWORD;
}

if (process.env.REDIS_TLS === 'true' || process.env.REDIS_HOST?.includes('upstash.io')) {
  redisOptions.tls = {};
}

export const connection = new Redis(redisOptions);

export const emailQueue = new Queue('email-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: false, // Keep in redis to show in dashboard
    removeOnFail: false,
  },
});

export const emailQueueEvents = new QueueEvents('email-queue', { connection });
