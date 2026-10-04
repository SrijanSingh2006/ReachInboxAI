import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import path from 'path';
import { ScheduledEmail } from './entities/ScheduledEmail';
import { SlackConnection } from './entities/SlackConnection';
dotenv.config();

const entities = [ScheduledEmail, SlackConnection];

const dbType = (process.env.DB_TYPE || 'better-sqlite3') as 'better-sqlite3' | 'sqlite' | 'mysql' | 'postgres';

const getDataSourceOptions = () => {
  if (dbType === 'better-sqlite3' || dbType === 'sqlite') {
    return {
      type: 'better-sqlite3' as const,
      database: path.join(process.cwd(), 'reachinbox.db'),
      synchronize: true,
      logging: false,
      entities,
    };
  }
  if (dbType === 'mysql') {
    return {
      type: 'mysql' as const,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'reachinboxdb',
      synchronize: true,
      logging: false,
      charset: 'utf8mb4',
      entities,
    };
  }
  // postgres
  return {
    type: 'postgres' as const,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'reachinbox',
    password: process.env.DB_PASS || 'reachinboxpassword',
    database: process.env.DB_NAME || 'reachinboxdb',
    ssl: (process.env.DB_SSL === 'true' || process.env.DB_HOST?.includes('supabase') || process.env.DB_HOST?.includes('pooler'))
      ? { rejectUnauthorized: false }
      : false,
    synchronize: true,
    logging: false,
    entities,
  };
};

export const AppDataSource = new DataSource(getDataSourceOptions() as any);

export const connectDB = async () => {
  try {
    await AppDataSource.initialize();
    console.log(`✅ Database (${dbType}) connected via TypeORM`);
  } catch (error) {
    console.error('❌ Error connecting to DB:', error);
    process.exit(1);
  }
};
