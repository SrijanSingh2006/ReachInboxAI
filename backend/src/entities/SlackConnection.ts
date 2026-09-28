import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class SlackConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  senderId: string;

  @Column({ type: 'varchar' })
  accessToken: string;

  @Column({ type: 'varchar' })
  webhookUrl: string;
}
