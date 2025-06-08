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

@Entity('device_tokens')
@Index(['token'], { unique: true })
export class DeviceToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ type: 'varchar', length: 500 })
  token: string;

  @Column({ 
    type: 'varchar', 
    length: 10, 
    default: 'android' 
  })
  platform: string;

  @Column({ 
    name: 'device_name',
    type: 'varchar', 
    length: 100, 
    nullable: true 
  })
  deviceName?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
} 