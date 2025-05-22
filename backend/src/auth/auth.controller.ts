import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpCode,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Direct4meService } from './services/direct4me.service';
import { OpenBoxDto } from './dto/open-box.dto';
import { UsersService } from '../users/users.service';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user?: { userId: number };
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly direct4meService: Direct4meService,
    private readonly usersService: UsersService,
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

  @Post('box/open')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Open a box using Direct4me API' })
  @ApiResponse({
    status: 200,
    description: 'Returns the token data for opening the box',
  })
  async openBox(
    @Body() openBoxDto: OpenBoxDto,
    @Req() req: RequestWithUser,
  ): Promise<any> {
    if (!req.user?.userId) throw new UnauthorizedException();
    const user = await this.usersService.findOne(req.user.userId);
    return this.direct4meService.openBox(openBoxDto, user);
  }
}
