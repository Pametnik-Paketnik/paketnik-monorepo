import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { DeviceToken } from '../entities/device-token.entity';
import { PendingAuthRequest, PendingAuthStatus } from '../entities/pending-auth-request.entity';
import { FirebaseAdminService } from './firebase-admin.service';
import { User } from '../../users/entities/user.entity';

export interface PendingAuthResponse {
  requiresApproval: boolean;
  pendingAuthId?: string;
  expiresAt?: Date;
  access_token?: string;
  refresh_token?: string;
}

@Injectable()
export class TwoFactorAuthService {
  private readonly logger = new Logger(TwoFactorAuthService.name);
  private readonly PENDING_AUTH_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(DeviceToken)
    private deviceTokenRepository: Repository<DeviceToken>,
    @InjectRepository(PendingAuthRequest)
    private pendingAuthRepository: Repository<PendingAuthRequest>,
    private firebaseService: FirebaseAdminService,
    private jwtService: JwtService,
  ) {}

  async updateFcmToken(userId: number, fcmToken: string, deviceName?: string): Promise<void> {
    await this.deviceTokenRepository.upsert(
      {
        userId,
        token: fcmToken,
        platform: 'android',
        deviceName,
      },
      ['token']
    );
    this.logger.log(`FCM token updated for user ${userId}`);
  }

  async getUserDevices(userId: number): Promise<DeviceToken[]> {
    return this.deviceTokenRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async createPendingAuthRequest(
    user: User,
    sessionInfo: {
      ipAddress?: string;
      userAgent?: string;
      location?: string;
    }
  ): Promise<PendingAuthResponse> {
    // Get user's registered devices
    const devices = await this.getUserDevices(user.id);

    if (devices.length === 0) {
      // No 2FA devices registered - return tokens directly
      const tokens = this.generateTokens(user);
      return {
        requiresApproval: false,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      };
    }

    // Cancel any existing pending requests for this user
    await this.pendingAuthRepository.update(
      { userId: user.id, status: PendingAuthStatus.PENDING },
      { status: PendingAuthStatus.EXPIRED }
    );

    // Create new pending request
    const pendingAuth = await this.pendingAuthRepository.save({
      userId: user.id,
      sessionToken: this.generateRandomToken(),
      ipAddress: sessionInfo.ipAddress,
      userAgent: sessionInfo.userAgent,
      location: sessionInfo.location,
      expiresAt: new Date(Date.now() + this.PENDING_AUTH_TIMEOUT),
      status: PendingAuthStatus.PENDING,
    });

    // Send push notification to all user devices
    const tokens = devices.map(d => d.token);
    await this.firebaseService.sendLoginApprovalNotification(
      tokens,
      pendingAuth.id,
      {
        username: user.username,
        ip: sessionInfo.ipAddress || 'Unknown',
        location: sessionInfo.location,
      }
    );

    this.logger.log(`Pending auth request created: ${pendingAuth.id} for user ${user.id}`);

    return {
      requiresApproval: true,
      pendingAuthId: pendingAuth.id,
      expiresAt: pendingAuth.expiresAt,
    };
  }

  async approvePendingAuth(pendingAuthId: string, userId: number): Promise<{ access_token: string; refresh_token: string }> {
    const pendingAuth = await this.pendingAuthRepository.findOne({
      where: {
        id: pendingAuthId,
        userId,
        status: PendingAuthStatus.PENDING,
        expiresAt: MoreThan(new Date()),
      },
      relations: ['user'],
    });

    if (!pendingAuth) {
      throw new NotFoundException('Pending authentication request not found or expired');
    }

    // Update status to approved
    await this.pendingAuthRepository.update(
      { id: pendingAuthId },
      { status: PendingAuthStatus.APPROVED }
    );

    this.logger.log(`Pending auth request approved: ${pendingAuthId} by user ${userId}`);

    // Generate tokens for the approved user
    return this.generateTokens(pendingAuth.user);
  }

  async denyPendingAuth(pendingAuthId: string, userId: number): Promise<void> {
    const pendingAuth = await this.pendingAuthRepository.findOne({
      where: {
        id: pendingAuthId,
        userId,
        status: PendingAuthStatus.PENDING,
      },
    });

    if (!pendingAuth) {
      throw new NotFoundException('Pending authentication request not found');
    }

    await this.pendingAuthRepository.update(
      { id: pendingAuthId },
      { status: PendingAuthStatus.DENIED }
    );

    this.logger.log(`Pending auth request denied: ${pendingAuthId} by user ${userId}`);
  }

  async getPendingAuthStatus(pendingAuthId: string): Promise<PendingAuthRequest | null> {
    return this.pendingAuthRepository.findOne({
      where: { id: pendingAuthId },
      relations: ['user'],
    });
  }

  async cleanupExpiredRequests(): Promise<void> {
    await this.pendingAuthRepository.update(
      {
        status: PendingAuthStatus.PENDING,
        expiresAt: MoreThan(new Date()),
      },
      { status: PendingAuthStatus.EXPIRED }
    );
  }

  private generateTokens(user: User): { access_token: string; refresh_token: string } {
    const payload = { username: user.username, sub: user.id, userType: user.userType };
    
    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '30d' }),
    };
  }

  private generateRandomToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
} 