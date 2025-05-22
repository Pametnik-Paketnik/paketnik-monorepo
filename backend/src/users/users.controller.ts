import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  HttpStatus,
  HttpCode,
  UseGuards,
  Req,
  HttpException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './entities/user.entity';
import {
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: { userId: number };
}

@ApiTags('Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.usersService.findAll();
    return users.map((user) => this.mapToResponseDto(user));
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.usersService.findOne(+id);
    return this.mapToResponseDto(user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  @ApiParam({
    name: 'id',
    description: 'The ID of the user to update',
    type: 'number',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'The user has been successfully updated',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Username already exists',
  })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.update(+id, updateUserDto);
    return this.mapToResponseDto(user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    if (req.user.userId !== +id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    await this.usersService.remove(+id);
  }

  private mapToResponseDto(user: User): UserResponseDto {
    const responseDto = new UserResponseDto();
    responseDto.id = user.id;
    responseDto.username = user.username;
    responseDto.createdAt = user.createdAt;
    responseDto.updatedAt = user.updatedAt;
    return responseDto;
  }
}
