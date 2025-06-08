import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpCode,
  UseGuards,
  Req,
  UnauthorizedException,
  Get,
  Headers,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { LogoutResponseDto } from './dto/logout-response.dto';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request } from 'express';
import { GetUser } from './decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';
import { TwoFactorAuthService } from '../two-factor-auth/services/two-factor-auth.service';
import { UpdateFcmTokenDto } from '../two-factor-auth/dto/update-fcm-token.dto';
import { PendingAuthActionDto, AuthResponseDto } from '../two-factor-auth/dto/pending-auth-action.dto';
import { RealTimeAuthGateway } from '../two-factor-auth/gateways/real-time-auth.gateway';

interface RequestWithUser extends Request {
  user?: { userId: number };
  headers: any;
}

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private twoFactorAuthService: TwoFactorAuthService,
    private realTimeAuthGateway: RealTimeAuthGateway,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - passwords do not match',
  })
  @ApiResponse({
    status: 409,
    description: 'Username already exists',
  })
  async register(@Body() registerDto: RegisterDto): Promise<LoginResponseDto> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with username and password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('login-2fa')
  @ApiOperation({ summary: 'User login with 2FA support' })
  @ApiResponse({ status: 200, description: 'Login successful or 2FA required' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login2FA(@Body() loginDto: LoginDto, @Req() req: Request) {
    try {
      // First, try the normal login flow that we know works
      const normalLoginResult = await this.authService.login(loginDto);
      
      // If normal login succeeds, try to enhance with 2FA
      try {
        // Get user entity for 2FA check
        const user = await this.authService.validateCredentials(loginDto.username, loginDto.password);
        
        // Try to create pending auth request (this will return normal login if no devices)
        const authResponse = await this.twoFactorAuthService.createPendingAuthRequest(user, {
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'],
          location: await this.getLocationFromIp(req.ip || 'unknown'),
        });

        return authResponse;
      } catch (twoFAError) {
        // If 2FA fails for any reason, fall back to normal login
        console.log('2FA failed, falling back to normal login:', twoFAError.message);
        return normalLoginResult;
      }
    } catch (error) {
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate token' })
  @ApiResponse({
    status: 200,
    description: 'Logout successful',
    type: LogoutResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid token',
  })
  async logout(@Req() req: RequestWithUser): Promise<LogoutResponseDto> {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1]; // Remove 'Bearer ' prefix

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    return this.authService.logout(token);
  }

  @Get('test-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Test authentication' })
  async testAuth(@GetUser() user: any) {
    return {
      success: true,
      message: 'Authentication working',
      user: user,
    };
  }

  @Post('update-fcm-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update FCM token for push notifications' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async updateFcmToken(
    @GetUser() user: { userId: number; username: string },
    @Body() updateFcmTokenDto: UpdateFcmTokenDto,
  ): Promise<AuthResponseDto> {
    try {
      console.log('FCM Token request received:', { userId: user.userId, token: updateFcmTokenDto.fcm_token });
      console.log('User object:', user);
      console.log('TwoFactorAuthService available:', !!this.twoFactorAuthService);
      
      // Check if service is available
      if (!this.twoFactorAuthService) {
        throw new Error('TwoFactorAuthService not available');
      }
      
      await this.twoFactorAuthService.updateFcmToken(user.userId, updateFcmTokenDto.fcm_token);
      
      return {
        success: true,
        message: 'FCM token updated successfully',
      };
    } catch (error) {
      console.error('Error updating FCM token:', error);
      throw new UnauthorizedException('Failed to update FCM token: ' + error.message);
    }
  }

  @Post('approve-pending-auth')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Approve pending authentication request' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async approvePendingAuth(
    @GetUser() user: { userId: number; username: string },
    @Body() pendingAuthActionDto: PendingAuthActionDto,
  ): Promise<AuthResponseDto> {
    const tokens = await this.twoFactorAuthService.approvePendingAuth(
      pendingAuthActionDto.pendingAuthId,
      user.userId,
    );

    // Notify via WebSocket
    await this.realTimeAuthGateway.notifyAuthStatusUpdate(
      pendingAuthActionDto.pendingAuthId,
      'approved',
      tokens,
    );

    return {
      success: true,
      message: 'Authentication approved successfully',
    };
  }

  @Post('deny-pending-auth')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Deny pending authentication request' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async denyPendingAuth(
    @GetUser() user: { userId: number; username: string },
    @Body() pendingAuthActionDto: PendingAuthActionDto,
  ): Promise<AuthResponseDto> {
    await this.twoFactorAuthService.denyPendingAuth(
      pendingAuthActionDto.pendingAuthId,
      user.userId,
    );

    // Notify via WebSocket
    await this.realTimeAuthGateway.notifyAuthStatusUpdate(
      pendingAuthActionDto.pendingAuthId,
      'denied',
    );

    return {
      success: true,
      message: 'Authentication denied',
    };
  }

  @Get('pending-auth-status/:pendingAuthId')
  @ApiOperation({ summary: 'Get status of pending authentication request' })
  async getPendingAuthStatus(@Param('pendingAuthId') pendingAuthId: string) {
    const pendingAuth = await this.twoFactorAuthService.getPendingAuthStatus(pendingAuthId);
    
    if (!pendingAuth) {
      throw new NotFoundException('Pending authentication request not found');
    }

    return {
      pendingAuthId: pendingAuth.id,
      status: pendingAuth.status,
      expiresAt: pendingAuth.expiresAt,
      createdAt: pendingAuth.createdAt,
    };
  }

  private async getLocationFromIp(ip: string): Promise<string | undefined> {
    // Implement IP geolocation if needed
    // For now, return undefined
    return undefined;
  }
}
