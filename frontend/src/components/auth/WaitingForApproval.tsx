import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Smartphone, 
  Clock, 
  Shield, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react';
import { toast } from 'sonner';
import { socketService, AuthStatusUpdate, AuthExpiredEvent } from '@/services/socket.service';

interface WaitingForApprovalProps {
  pendingAuthId: string;
  expiresAt: Date;
  onApproved: (tokens: { access_token: string; refresh_token: string }) => void;
  onDenied: () => void;
  onExpired: () => void;
  onCancel: () => void;
}

export function WaitingForApproval({
  pendingAuthId,
  expiresAt,
  onApproved,
  onDenied,
  onExpired,
  onCancel,
}: WaitingForApprovalProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [progress, setProgress] = useState<number>(100);
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'approved' | 'denied' | 'expired'>('connecting');
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // Calculate initial time left
  useEffect(() => {
    const updateTimeLeft = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const remaining = Math.max(0, expiry - now);
      
      setTimeLeft(remaining);
      setProgress((remaining / (5 * 60 * 1000)) * 100); // 5 minutes total
      
      if (remaining <= 0) {
        setStatus('expired');
        onExpired();
      }
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);
    
    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  // WebSocket connection and subscription
  useEffect(() => {
    const initializeWebSocket = async () => {
      try {
        await socketService.connect();
        setIsSocketConnected(true);
        setStatus('waiting');

        const handleStatusUpdate = (update: AuthStatusUpdate) => {
          console.log('📡 Auth status update:', update);
          
          switch (update.status) {
            case 'approved':
              setStatus('approved');
              toast.success('🎉 Login approved! Redirecting...');
              if (update.tokens) {
                setTimeout(() => onApproved(update.tokens!), 1500);
              }
              break;
            case 'denied':
              setStatus('denied');
              toast.error('❌ Login denied by your mobile device');
              setTimeout(() => onDenied(), 2000);
              break;
            case 'expired':
              setStatus('expired');
              toast.error('⏰ Login request expired');
              setTimeout(() => onExpired(), 2000);
              break;
          }
        };

        const handleAuthExpired = (event: AuthExpiredEvent) => {
          console.log('⏰ Auth expired:', event);
          setStatus('expired');
          toast.error('⏰ Login request expired');
          setTimeout(() => onExpired(), 2000);
        };

        socketService.subscribeToPendingAuth(
          pendingAuthId,
          handleStatusUpdate,
          handleAuthExpired
        );

      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
        setIsSocketConnected(false);
        toast.error('Connection failed. Showing manual refresh option.');
      }
    };

    initializeWebSocket();

    return () => {
      socketService.unsubscribeFromPendingAuth(pendingAuthId);
      socketService.disconnect();
    };
  }, [pendingAuthId, onApproved, onDenied, onExpired]);

  const formatTimeLeft = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleManualRefresh = async () => {
    try {
      const response = await fetch(`/api/auth/pending-auth-status/${pendingAuthId}`);
      const data = await response.json();
      
      if (data.status === 'approved') {
        setStatus('approved');
        toast.success('🎉 Login approved! Please wait...');
        // Would need to get tokens from somewhere
      } else if (data.status === 'denied') {
        setStatus('denied');
        onDenied();
      } else if (data.status === 'expired') {
        setStatus('expired');
        onExpired();
      }
    } catch (error) {
      toast.error('Failed to check status');
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'connecting':
        return <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />;
      case 'waiting':
        return <Smartphone className="h-8 w-8 text-orange-500 animate-pulse" />;
      case 'approved':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'denied':
        return <XCircle className="h-8 w-8 text-red-500" />;
      case 'expired':
        return <Clock className="h-8 w-8 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connecting':
        return 'Connecting...';
      case 'waiting':
        return 'Waiting for approval';
      case 'approved':
        return 'Approved! Redirecting...';
      case 'denied':
        return 'Access denied';
      case 'expired':
        return 'Request expired';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connecting':
        return 'bg-blue-500';
      case 'waiting':
        return 'bg-orange-500';
      case 'approved':
        return 'bg-green-500';
      case 'denied':
        return 'bg-red-500';
      case 'expired':
        return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {getStatusIcon()}
          </div>
          <CardTitle className="text-2xl font-bold">
            {getStatusText()}
          </CardTitle>
          <CardDescription>
            {status === 'waiting' && 'Check your mobile device and approve the login request'}
            {status === 'connecting' && 'Establishing secure connection...'}
            {status === 'approved' && 'Successfully authenticated'}
            {status === 'denied' && 'Login request was denied'}
            {status === 'expired' && 'Please try logging in again'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress Bar */}
          {status === 'waiting' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Time remaining</span>
                <span className="font-mono">{formatTimeLeft(timeLeft)}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Connection Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
            <div className="flex items-center space-x-2">
              {isSocketConnected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium">
                {isSocketConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <Badge variant={isSocketConnected ? 'default' : 'destructive'}>
              {isSocketConnected ? 'Live' : 'Offline'}
            </Badge>
          </div>

          {/* Security Info */}
          <div className="flex items-start space-x-3 p-3 rounded-lg bg-blue-50">
            <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">Secure 2FA Authentication</p>
              <p className="text-xs text-blue-700">
                This request will expire automatically for your security
              </p>
            </div>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="space-y-3">
            {!isSocketConnected && status === 'waiting' && (
              <Button 
                onClick={handleManualRefresh} 
                variant="outline" 
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Check Status
              </Button>
            )}
            
            {(status === 'waiting' || status === 'connecting') && (
              <Button 
                onClick={onCancel} 
                variant="outline" 
                className="w-full"
              >
                Cancel
              </Button>
            )}
            
            {(status === 'denied' || status === 'expired') && (
              <Button 
                onClick={onCancel} 
                className="w-full"
              >
                Try Again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 