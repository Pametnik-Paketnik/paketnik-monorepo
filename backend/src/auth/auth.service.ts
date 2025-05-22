import { Injectable, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';

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
}
