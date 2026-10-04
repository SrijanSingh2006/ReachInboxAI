import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import dotenv from 'dotenv';
dotenv.config();

const isPostgres = (process.env.DB_TYPE || '').toLowerCase() === 'postgres';
const dateColumnType = (isPostgres ? 'timestamp' : 'datetime') as any;

@Entity()
export class ScheduledEmail {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  recipient!: string;

  @Column({ type: 'varchar', length: 500 })
  subject!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: dateColumnType })
  scheduledTime!: Date;

  @Column({ type: dateColumnType, nullable: true })
  sentAt!: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'scheduled' })
  status!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  jobId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  senderId!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  etherealPreviewUrl!: string | null;

  @Column({ type: 'integer', nullable: true })
  delayBetweenEmailsMs!: number | null;

  @Column({ type: 'integer', nullable: true })
  maxEmailsPerHour!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
