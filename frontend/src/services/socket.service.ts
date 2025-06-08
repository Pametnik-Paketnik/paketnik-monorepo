import { io, Socket } from 'socket.io-client';
import Cookies from 'js-cookie';

export interface AuthStatusUpdate {
  pendingAuthId: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  tokens?: {
    access_token: string;
    refresh_token: string;
  };
  timestamp: string;
}

export interface AuthExpiredEvent {
  pendingAuthId: string;
  timestamp: string;
}

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const token = Cookies.get('access_token');
      
      if (!token) {
        reject(new Error('No authentication token found'));
        return;
      }

      // Get the base URL from environment variable, remove /api suffix and add /auth namespace
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const baseUrl = apiUrl.replace('/api', '');
      const socketUrl = `${baseUrl}/auth`;

      this.socket = io(socketUrl, {
        auth: {
          token,
        },
        transports: ['websocket'],
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        console.log('🔗 WebSocket connected');
        resolve();
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        console.log('🔌 WebSocket disconnected');
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection error:', error);
        reject(error);
      });

      this.socket.on('connected', (data) => {
        console.log('✅ WebSocket authenticated for user:', data.userId);
      });

      this.socket.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  subscribeToPendingAuth(
    pendingAuthId: string,
    onStatusUpdate: (update: AuthStatusUpdate) => void,
    onExpired: (event: AuthExpiredEvent) => void
  ): void {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ WebSocket not connected');
      return;
    }

    // Subscribe to pending auth updates
    this.socket.emit('subscribe_to_pending_auth', { pendingAuthId });

    // Listen for status updates
    this.socket.on('auth_status_update', onStatusUpdate);
    this.socket.on('auth_expired', onExpired);

    console.log(`📡 Subscribed to pending auth: ${pendingAuthId}`);
  }

  unsubscribeFromPendingAuth(pendingAuthId: string): void {
    if (!this.socket) return;

    this.socket.emit('unsubscribe_from_pending_auth', { pendingAuthId });
    this.socket.off('auth_status_update');
    this.socket.off('auth_expired');

    console.log(`📴 Unsubscribed from pending auth: ${pendingAuthId}`);
  }

  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }
}

// Export singleton instance
export const socketService = new SocketService(); 