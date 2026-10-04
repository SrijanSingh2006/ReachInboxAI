import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class SlackConnection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  senderId!: string;

  @Column({ type: 'varchar', length: 1000 })
  accessToken!: string;

  @Column({ type: 'varchar', length: 500 })
  webhookUrl!: string;
}
