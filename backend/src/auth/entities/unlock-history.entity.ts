import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('unlock_history')
export class UnlockHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'box_id', type: 'varchar', length: 100 })
  boxId: string;

  @CreateDateColumn({
    name: 'timestamp',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  timestamp: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  status: string;

  @Column({ name: 'token_format', type: 'int', nullable: true })
  tokenFormat: number;
}
