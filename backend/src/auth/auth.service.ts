import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { TotpAuthService } from '../totp-auth/totp-auth.service';
import { TotpLoginDto } from '../totp-auth/dto/totp-login.dto';
import { FaceAuthService } from '../face-auth/face-auth.service';
import { FaceAuthRequestService } from './services/face-auth-request.service';
import { FirebaseService } from '../firebase/firebase.service';
import { UserDevicesService } from '../users/user-devices.service';
import { FaceAuthGateway } from '../websockets/face-auth.gateway';
import {
  InitiateFaceAuthDto,
  FaceAuthStatusDto,
} from './dto/face-auth-web.dto';

interface TempTokenPayload {
  sub: number;
  email: string;
  type: string;
  twoFactorPending: boolean;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly totpAuthService: TotpAuthService,
    private readonly faceAuthService: FaceAuthService,
    private readonly faceAuthRequestService: FaceAuthRequestService,
    private readonly firebaseService: FirebaseService,
    private readonly userDevicesService: UserDevicesService,
    private readonly faceAuthGateway: FaceAuthGateway,
  ) {}

  async register(registerDto: RegisterDto): Promise<LoginResponseDto> {
    // Create user using the UsersService
    const user = await this.usersService.create({
      name: registerDto.name,
      surname: registerDto.surname,
      email: registerDto.email,
      password: registerDto.password,
      userType: registerDto.userType,
    });

    // Generate JWT token
    const payload = { sub: user.id, email: user.email };
    const token = await this.jwtService.signAsync(payload);

    return {
      success: true,
      message: 'Registration successful',
      access_token: token,
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        userType: user.userType,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    // Find user by email
    const user = await this.usersService.findByEmail(loginDto.email);

    // Compare passwords (plain text comparison)
    if (loginDto.password !== user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if any 2FA is enabled (explicitly check for true, not just truthy)
    const hasTotp = user.totpEnabled === true;
    const hasFace = user.faceEnabled === true;

    if (hasTotp || hasFace) {
      // Generate temporary token (short-lived, 5 minutes)
      const tempPayload = {
        sub: user.id,
        email: user.email,
        type: 'temp',
        twoFactorPending: true,
      };
      const tempToken = await this.jwtService.signAsync(tempPayload, {
        expiresIn: '5m',
      });

      // Build available 2FA methods
      const available2FAMethods: Array<{
        type: string;
        enabled: boolean;
        display_name: string;
      }> = [];
      if (hasTotp) {
        available2FAMethods.push({
          type: 'totp',
          enabled: true,
          display_name: 'Authenticator App',
        });
      }
      if (hasFace) {
        available2FAMethods.push({
          type: 'face_id',
          enabled: true,
          display_name: 'Face ID',
        });
      }

      return {
        success: true,
        message: 'Password verified. Please choose your 2FA method.',
        twoFactorRequired: true,
        tempToken,
        available_2fa_methods: available2FAMethods,
      };
    }

    // No 2FA required, generate regular JWT token
    const payload = { sub: user.id, email: user.email };
    const token = await this.jwtService.signAsync(payload);

    return {
      success: true,
      message: 'Login successful',
      access_token: token,
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        userType: user.userType,
      },
    };
  }

  async verifyTotpLogin(totpLoginDto: TotpLoginDto): Promise<LoginResponseDto> {
    try {
      // Verify the temporary token
      const decoded = await this.jwtService.verifyAsync<TempTokenPayload>(
        totpLoginDto.tempToken,
      );

      if (!decoded.twoFactorPending || decoded.type !== 'temp') {
        throw new UnauthorizedException('Invalid temporary token');
      }

      // Verify the TOTP code
      const isValidCode = await this.totpAuthService.verifyTotpCode(
        decoded.sub,
        totpLoginDto.code,
      );

      if (!isValidCode) {
        throw new UnauthorizedException('Invalid 2FA code');
      }

      // Get user info
      const user = await this.usersService.findOne(decoded.sub);

      // Generate final JWT token
      const payload = { sub: user.id, email: user.email };
      const token = await this.jwtService.signAsync(payload);

      return {
        success: true,
        message: 'Login successful',
        access_token: token,
        user: {
          id: user.id,
          name: user.name,
          surname: user.surname,
          email: user.email,
          userType: user.userType,
        },
      };
    } catch {
      throw new UnauthorizedException('Invalid 2FA verification');
    }
  }

  async verifyFaceLogin(
    tempToken: string,
    faceImage: Express.Multer.File,
  ): Promise<LoginResponseDto> {
    try {
      // Verify the temporary token
      const decoded =
        await this.jwtService.verifyAsync<TempTokenPayload>(tempToken);

      if (!decoded.twoFactorPending || decoded.type !== 'temp') {
        throw new UnauthorizedException('Invalid temporary token');
      }

      // Verify the face using face auth service
      const faceVerificationResult = await this.faceAuthService.verifyFace(
        decoded.sub.toString(),
        faceImage,
      );

      if (!faceVerificationResult.authenticated) {
        throw new UnauthorizedException('Face verification failed');
      }

      // Get user info
      const user = await this.usersService.findOne(decoded.sub);

      // Generate final JWT token
      const payload = { sub: user.id, email: user.email };
      const token = await this.jwtService.signAsync(payload);

      return {
        success: true,
        message: 'Login successful',
        access_token: token,
        user: {
          id: user.id,
          name: user.name,
          surname: user.surname,
          email: user.email,
          userType: user.userType,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid Face ID verification');
    }
  }

  // NEW WEBSOCKET FACE ID METHODS

  async initiateFaceAuthWeb(
    dto: InitiateFaceAuthDto,
    clientIp: string,
    userAgent: string,
  ): Promise<FaceAuthStatusDto> {
    try {
      // Verify the temporary token
      const decoded = await this.jwtService.verifyAsync<TempTokenPayload>(
        dto.tempToken,
      );

      if (!decoded.twoFactorPending || decoded.type !== 'temp') {
        throw new UnauthorizedException('Invalid temporary token');
      }

      // Get user's devices
      const userDevices = await this.userDevicesService.getUserDevices(
        decoded.sub,
      );

      if (userDevices.length === 0) {
        throw new UnauthorizedException(
          'No registered devices found for Face ID authentication',
        );
      }

      // Create Face ID authentication request
      const faceAuthRequest = await this.faceAuthRequestService.createRequest({
        userId: decoded.sub,
        expiresInMinutes: dto.timeoutMinutes || 5,
        deviceInfo: dto.deviceInfo,
        ipAddress: clientIp,
        userAgent: userAgent,
        metadata: {
          ...dto.metadata,
          tempTokenIssued: decoded.iat,
          initiatedFromWeb: true,
        },
      });

      // Send push notifications to all user devices
      const fcmTokens = userDevices.map((device) => device.fcmToken);
      await this.firebaseService.sendFaceAuthRequest(
        fcmTokens,
        faceAuthRequest.requestId,
        decoded.email,
      );

      // Notify WebSocket room about request creation
      this.faceAuthGateway.notifyFaceAuthStatus(
        faceAuthRequest.requestId,
        'notifications_sent',
        `Push notifications sent to ${userDevices.length} devices`,
      );

      return {
        requestId: faceAuthRequest.requestId,
        status: 'pending',
        websocketRoom: `face_auth_${faceAuthRequest.requestId}`,
        expiresAt: faceAuthRequest.expiresAt,
        devicesNotified: userDevices.length,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(
        'Failed to initiate Face ID authentication',
      );
    }
  }

  async completeFaceAuth(
    requestId: string,
    faceImage: Express.Multer.File,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Validate request
      const faceAuthRequest =
        await this.faceAuthRequestService.validateRequest(requestId);

      // Get user info
      const user = await this.usersService.findOne(faceAuthRequest.userId);

      // Verify the face using face auth service (same as regular face login)
      const faceVerificationResult = await this.faceAuthService.verifyFace(
        user.id.toString(),
        faceImage,
      );

      if (!faceVerificationResult.authenticated) {
        // Face verification failed
        await this.faceAuthRequestService.completeRequest({
          requestId,
          success: false,
          failureReason: 'Face verification failed',
          metadata: {
            completedAt: new Date().toISOString(),
            completedBy: 'mobile_app',
            verificationResult: faceVerificationResult,
          },
        });

        // Notify WebSocket room of failure
        this.faceAuthGateway.notifyFaceAuthComplete(requestId, {
          success: false,
          message: 'Face verification failed',
        });

        return {
          success: false,
          message: 'Face verification failed',
        };
      }

      // Face verification successful - Complete the request
      await this.faceAuthRequestService.completeRequest({
        requestId,
        success: true,
        metadata: {
          completedAt: new Date().toISOString(),
          completedBy: 'mobile_app',
          verificationResult: faceVerificationResult,
        },
      });

      // Generate final JWT token for web client
      const payload = { sub: user.id, email: user.email };
      const token = await this.jwtService.signAsync(payload);

      const loginResponse: LoginResponseDto = {
        success: true,
        message: 'Face ID authentication successful',
        access_token: token,
        user: {
          id: user.id,
          name: user.name,
          surname: user.surname,
          email: user.email,
          userType: user.userType,
        },
      };

      // Notify WebSocket room of successful completion (with JWT token)
      this.faceAuthGateway.notifyFaceAuthComplete(requestId, {
        success: true,
        data: loginResponse,
      });

      // Cancel any other pending Face ID requests for this user
      await this.faceAuthRequestService.cancelPendingRequestsForUser(
        faceAuthRequest.userId,
      );

      // Return simple success message to mobile app (NO JWT TOKEN)
      return {
        success: true,
        message: 'Face ID authentication successful. User has been logged in.',
      };
    } catch (error) {
      // Notify WebSocket room of error
      this.faceAuthGateway.notifyFaceAuthComplete(requestId, {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(
        'Failed to complete Face ID authentication',
      );
    }
  }

  async getFaceAuthStatus(requestId: string): Promise<FaceAuthStatusDto> {
    try {
      const faceAuthRequest =
        await this.faceAuthRequestService.findByRequestId(requestId);

      // Get user's device count for context
      const userDevices = await this.userDevicesService.getUserDevices(
        faceAuthRequest.userId,
      );

      return {
        requestId: faceAuthRequest.requestId,
        status: faceAuthRequest.status,
        websocketRoom: `face_auth_${faceAuthRequest.requestId}`,
        expiresAt: faceAuthRequest.expiresAt,
        devicesNotified: userDevices.length,
      };
    } catch {
      throw new UnauthorizedException('Face ID request not found');
    }
  }

  async logout(token: string): Promise<{ success: boolean; message: string }> {
    try {
      // Verify token is valid before blacklisting
      await this.jwtService.verifyAsync(token);

      // Add token to blacklist
      this.tokenBlacklistService.addToken(token);

      return {
        success: true,
        message: 'Logout successful',
      };
    } catch {
      // Even if token is invalid, consider logout successful
      return {
        success: true,
        message: 'Logout successful',
      };
    }
  }

  validate(payload: { sub: number; email: string }) {
    return { userId: payload.sub, email: payload.email };
  }
}
