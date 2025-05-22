import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { compare } from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async register(registerDto: RegisterDto): Promise<UserResponseDto> {
    // Check if passwords match
    if (registerDto.password !== registerDto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Create user using the UsersService
    const user = await this.usersService.create({
      username: registerDto.username,
      password: registerDto.password,
    });

    // Map to response DTO
    const responseDto = new UserResponseDto();
    responseDto.id = user.id;
    responseDto.username = user.username;
    responseDto.createdAt = user.createdAt;
    responseDto.updatedAt = user.updatedAt;

    return responseDto;
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

      return {
        success: true,
        message: 'Login successful',
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid credentials');
    }
  }
}
