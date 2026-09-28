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

app.use(cors());
app.use(express.json());

// Bull Board setup
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter: serverAdapter,
});

app.use('/api', router);
app.use('/admin/queues', serverAdapter.getRouter());

const start = async () => {
  await connectDB();
  await initElasticsearch();
  startWorker();
  
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`BullMQ dashboard available at http://localhost:${port}/admin/queues`);
  });
};

start();
