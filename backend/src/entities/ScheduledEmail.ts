import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class ScheduledEmail {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  recipient!: string;

  @Column({ type: 'varchar' })
  subject!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'timestamp' })
  scheduledTime!: Date;

  @Column({ type: 'varchar', default: 'scheduled' })
  status!: string; // 'scheduled', 'sent', 'failed'

  @Column({ type: 'varchar', nullable: true })
  jobId!: string;

  @Column({ type: 'varchar', nullable: true })
  senderId!: string; // to track tenant/sender for rate limiting

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
