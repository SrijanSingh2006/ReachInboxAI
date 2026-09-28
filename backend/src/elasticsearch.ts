import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';
dotenv.config();

export const esClient = new Client({
  node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
});

export const initElasticsearch = async () => {
  try {
    const indexExists = await esClient.indices.exists({ index: 'emails' });
    if (!indexExists) {
      await esClient.indices.create({
        index: 'emails',
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              recipient: { type: 'text' },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledTime: { type: 'date' },
            }
          }
        }
      });
      console.log('Elasticsearch index "emails" created.');
    } else {
      console.log('Elasticsearch index "emails" already exists.');
    }
  } catch (error) {
    console.error('Elasticsearch connection/setup error:', error);
  }
};
