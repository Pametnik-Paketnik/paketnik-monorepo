import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey,
          clientEmail,
        }),
      });
      this.logger.log('Firebase Admin SDK initialized');
    }
  }

  async sendMulticast(tokens: string[], notification: admin.messaging.Notification, data?: Record<string, string>) {
    if (tokens.length === 0) {
      this.logger.warn('No tokens provided for multicast');
      return { successCount: 0, failureCount: 0 };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        notification,
        data,
        tokens,
        android: {
          priority: 'high',
          notification: {
            channelId: 'auth_notifications',
            priority: 'high',
            sound: 'default',
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      
      this.logger.log(`Multicast sent: ${response.successCount} success, ${response.failureCount} failures`);
      
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            this.logger.warn(`Failed to send to token ${tokens[idx]}: ${resp.error?.message}`);
          }
        });
      }

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      this.logger.error('Failed to send multicast message', error);
      return { successCount: 0, failureCount: tokens.length };
    }
  }

  async sendLoginApprovalNotification(
    tokens: string[],
    pendingAuthId: string,
    userData: {
      username: string;
      ip: string;
      location?: string;
    }
  ) {
    const notification: admin.messaging.Notification = {
      title: '🔐 Login Approval Required',
      body: `${userData.username} is trying to login from ${userData.location || userData.ip}`,
    };

    const data = {
      type: 'login_approval',
      pendingAuthId,
      username: userData.username,
      ip: userData.ip,
      location: userData.location || '',
      timestamp: new Date().toISOString(),
    };

    return this.sendMulticast(tokens, notification, data);
  }
} 