import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum PendingAuthStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DENIED = 'denied',
  EXPIRED = 'expired',
}

@Entity('pending_auth_requests')
@Index(['userId', 'status'])
export class PendingAuthRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ 
    name: 'session_token',
    type: 'varchar', 
    length: 255 
  })
  sessionToken: string;

  @Column({ 
    name: 'ip_address',
    type: 'inet',
    nullable: true 
  })
  ipAddress?: string;

  @Column({ 
    name: 'user_agent',
    type: 'text',
    nullable: true 
  })
  userAgent?: string;

  @Column({ 
    type: 'varchar', 
    length: 255,
    nullable: true 
  })
  location?: string;

  @Column({
    type: 'enum',
    enum: PendingAuthStatus,
    default: PendingAuthStatus.PENDING,
  })
  status: PendingAuthStatus;

  @Column({ 
    name: 'expires_at',
    type: 'timestamp'
  })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
} 