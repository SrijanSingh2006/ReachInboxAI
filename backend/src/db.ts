import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'reachinbox',
  password: process.env.DB_PASS || 'reachinboxpassword',
  database: process.env.DB_NAME || 'reachinboxdb',
  synchronize: true, // For demo purposes, sync schema automatically
  logging: false,
  entities: [__dirname + '/entities/*.{js,ts}'],
});

export const connectDB = async () => {
  try {
    await AppDataSource.initialize();
    console.log('PostgreSQL connected via TypeORM');
  } catch (error) {
    console.error('Error connecting to DB', error);
  }
};
