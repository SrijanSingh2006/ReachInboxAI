import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';
dotenv.config();

export let esEnabled = false;

export const esClient = new Client({
  node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
  requestTimeout: 3000,
  sniffOnStart: false,
});

export const initElasticsearch = async () => {
  try {
    // Quick ping to check if ES is available
    await esClient.ping();
    esEnabled = true;

    const indexExists = await esClient.indices.exists({ index: 'emails' });
    if (!indexExists) {
      await esClient.indices.create({
        index: 'emails',
        mappings: {
          properties: {
            id:            { type: 'keyword' },
            recipient:     { type: 'text' },
            subject:       { type: 'text' },
            body:          { type: 'text' },
            status:        { type: 'keyword' },
            scheduledTime: { type: 'date' },
            sentAt:        { type: 'date' },
            senderId:      { type: 'keyword' },
          },
        },
      });
      console.log('✅ Elasticsearch index "emails" created.');
    } else {
      console.log('✅ Elasticsearch index "emails" already exists.');
    }
  } catch {
    esEnabled = false;
    console.warn('⚠️  Elasticsearch not available — search will use database fallback.');
  }
};
