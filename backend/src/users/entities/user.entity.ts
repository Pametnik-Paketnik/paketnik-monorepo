import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';

export enum UserType {
  USER = 'USER',
  HOST = 'HOST',
  CLEANER = 'CLEANER',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  surname: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'hashed_password' })
  @Exclude()
  password: string;

  @Column({
    type: 'enum',
    enum: UserType,
    default: UserType.USER,
    name: 'user_type',
  })
  userType: UserType;

  // TOTP/2FA fields
  @Column({ name: 'totp_secret', type: 'varchar', nullable: true })
  @Exclude()
  totpSecret: string | null;

  @Column({
    name: 'totp_enabled',
    type: 'boolean',
    default: false,
    nullable: false,
  })
  totpEnabled: boolean;

  @Column({
    name: 'face_enabled',
    type: 'boolean',
    default: false,
    nullable: false,
  })
  faceEnabled: boolean;

  // Relationship: Each cleaner belongs to exactly one host
  @ManyToOne(() => User, (user) => user.cleaners, { nullable: true })
  @JoinColumn({ name: 'host_id' })
  host: User;

  // Relationship: Each host can have multiple cleaners
  @OneToMany(() => User, (user) => user.host)
  cleaners: User[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
