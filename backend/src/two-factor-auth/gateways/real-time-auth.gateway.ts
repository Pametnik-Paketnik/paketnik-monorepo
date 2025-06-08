import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { TwoFactorAuthService } from '../services/two-factor-auth.service';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  pendingAuthId?: string;
}

@WebSocketGateway({
  cors: {
    origin: true, // Allow all origins for development
    credentials: true,
  },
  namespace: '/auth',
})
export class RealTimeAuthGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealTimeAuthGateway.name);
  private readonly connectionMap = new Map<string, AuthenticatedSocket>();

  constructor(
    private jwtService: JwtService,
    private twoFactorAuthService: TwoFactorAuthService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`🔄 WebSocket connection attempt from ${client.handshake.address}`);
    
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (!token) {
        this.logger.warn(`❌ Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.userId = payload.sub;
      
      this.connectionMap.set(client.id, client);
      this.logger.log(`✅ Client ${client.id} connected for user ${client.userId}`);
      
      client.emit('connected', { userId: client.userId });
    } catch (error) {
      this.logger.warn(`❌ Invalid token for client ${client.id}: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.connectionMap.delete(client.id);
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('subscribe_to_pending_auth')
  async subscribeToPendingAuth(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { pendingAuthId: string }
  ) {
    if (!client.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    client.pendingAuthId = data.pendingAuthId;
    client.join(`pending_auth_${data.pendingAuthId}`);
    
    this.logger.log(`Client ${client.id} subscribed to pending auth ${data.pendingAuthId}`);
    
    // Send current status
    const pendingAuth = await this.twoFactorAuthService.getPendingAuthStatus(data.pendingAuthId);
    if (pendingAuth) {
      client.emit('auth_status_update', {
        pendingAuthId: data.pendingAuthId,
        status: pendingAuth.status,
        expiresAt: pendingAuth.expiresAt,
      });
    }
  }

  @SubscribeMessage('unsubscribe_from_pending_auth')
  async unsubscribeFromPendingAuth(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { pendingAuthId: string }
  ) {
    client.leave(`pending_auth_${data.pendingAuthId}`);
    client.pendingAuthId = undefined;
    this.logger.log(`Client ${client.id} unsubscribed from pending auth ${data.pendingAuthId}`);
  }

  // Method to notify clients about auth status changes
  async notifyAuthStatusUpdate(pendingAuthId: string, status: string, tokens?: { access_token: string; refresh_token: string }) {
    this.server.to(`pending_auth_${pendingAuthId}`).emit('auth_status_update', {
      pendingAuthId,
      status,
      tokens: tokens || null,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Auth status update sent for ${pendingAuthId}: ${status}`);
  }

  // Method to notify about auth expiration
  async notifyAuthExpired(pendingAuthId: string) {
    this.server.to(`pending_auth_${pendingAuthId}`).emit('auth_expired', {
      pendingAuthId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Auth expiration notification sent for ${pendingAuthId}`);
  }
} 