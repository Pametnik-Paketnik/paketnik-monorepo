import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { compare } from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenBlacklistService } from './services/token-blacklist.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  async register(registerDto: RegisterDto): Promise<LoginResponseDto> {
    // Create user using the UsersService
    const user = await this.usersService.create({
      username: registerDto.username,
      password: registerDto.password,
      userType: registerDto.userType,
    });

    // Generate JWT token
    const payload = { sub: user.id, username: user.username };
    const token = await this.jwtService.signAsync(payload);

    return {
      success: true,
      message: 'Registration successful',
      access_token: token,
      user: {
        id: user.id,
        username: user.username,
        userType: user.userType,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    try {
      // Find user by username
      const user = await this.usersService.findByUsername(loginDto.username);

      // Compare passwords
      const isPasswordValid = await compare(
        loginDto.password,
        user.hashedPassword,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Generate JWT token
      const payload = { sub: user.id, username: user.username };
      const token = await this.jwtService.signAsync(payload);

      return {
        success: true,
        message: 'Login successful',
        access_token: token,
        user: {
          id: user.id,
          username: user.username,
          userType: user.userType,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid credentials');
    }
  }
  async logout(token: string): Promise<{ success: boolean; message: string }> {
    try {
      // Verify token is valid before blacklisting
      const payload = await this.jwtService.verifyAsync(token);

      // Add token to blacklist
      this.tokenBlacklistService.addToken(token);

      return {
        success: true,
        message: 'Logout successful',
      };
    } catch (error) {
      // Even if token is invalid, consider logout successful
      return {
        success: true,
        message: 'Logout successful',
      };
    }
  }
  validate(payload: { sub: number; username: string }) {
    return { userId: payload.sub, username: payload.username };
  }

  async validateCredentials(username: string, password: string) {
    try {
      // Find user by username
      const user = await this.usersService.findByUsername(username);

      // Compare passwords
      const isPasswordValid = await compare(password, user.hashedPassword);

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      return user;
    } catch (error) {
      throw new UnauthorizedException('Invalid credentials');
    }
  }
}
