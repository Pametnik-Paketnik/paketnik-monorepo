import {
  Controller,
  Post,
  Get,
  Delete,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FaceAuthService } from './face-auth.service';
import { RegisterResponseDto } from './dto/register-response.dto';
import { VerifyResponseDto } from './dto/verify-response.dto';
import { StatusResponseDto } from './dto/status-response.dto';
import { DeleteResponseDto } from './dto/delete-response.dto';

interface RequestWithUser extends Request {
  user?: { userId: number };
}

@ApiTags('Face Authentication')
@Controller('api/face-auth')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class FaceAuthController {
  constructor(private readonly faceAuthService: FaceAuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('files', 100)) // Allow up to 100 files
  @ApiOperation({
    summary: 'Register user face for authentication',
    description: `
    Register a user's face by uploading multiple face images for training.
    The system will train a personalized model for face authentication.
    
    **Recommendations:**
    - Upload 20-60 high-quality face images
    - Ensure good lighting and clear face visibility
    - Include different angles and expressions
    - Training takes 1-3 minutes depending on image count
    
    **Process:**
    1. Images are processed and faces are detected
    2. Model training starts in background
    3. Use /face-auth/status to check training progress
    `,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Face images for training',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Array of face image files (JPG, PNG)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Face registration started successfully',
    type: RegisterResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - no valid image files provided',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid JWT token',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - user already has a trained model',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async registerFace(
    @Req() req: RequestWithUser,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<RegisterResponseDto> {
    const userId = req.user?.userId?.toString();
    if (!userId) {
      throw new HttpException('User ID not found', HttpStatus.UNAUTHORIZED);
    }
    return this.faceAuthService.registerFace(userId, files);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Verify user identity using face authentication',
    description: `
    Authenticate a user by comparing their face image against their trained model.
    
    **Requirements:**
    - User must have completed face registration first
    - Model training must be completed (check with /face-auth/status)
    - Upload a clear face image for verification
    
    **Authentication Logic:**
    - Probability > 0.5 = Authenticated
    - Probability ≤ 0.5 = Not authenticated
    - Higher probability indicates better match
    `,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Face image for verification',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Single face image file (JPG, PNG)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Face verification completed',
    type: VerifyResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid image file',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - user model not found or training not completed',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async verifyFace(
    @Req() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<VerifyResponseDto> {
    const userId = req.user?.userId?.toString();
    if (!userId) {
      throw new HttpException('User ID not found', HttpStatus.UNAUTHORIZED);
    }
    return this.faceAuthService.verifyFace(userId, file);
  }

  @Get('status')
  @ApiOperation({
    summary: 'Check face model training status',
    description: `
    Check the current status of face model training for the authenticated user.
    
    **Possible Status Values:**
    - \`training_completed\`: Model is ready for authentication
    - \`training_in_progress\`: Training is still running
    - \`user_not_found\`: User has not registered for face authentication
    
    **Usage:**
    - Call this endpoint after registration to monitor training progress
    - Wait for \`training_completed\` before attempting verification
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Training status retrieved successfully',
    type: StatusResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid JWT token',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getStatus(@Req() req: RequestWithUser): Promise<StatusResponseDto> {
    const userId = req.user?.userId?.toString();
    if (!userId) {
      throw new HttpException('User ID not found', HttpStatus.UNAUTHORIZED);
    }
    return this.faceAuthService.getStatus(userId);
  }

  @Delete('delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete user face model and data',
    description: `
    Permanently delete all face authentication data for the authenticated user.
    This includes:
    - Trained face model
    - Training images
    - All associated metadata
    
    **Warning:**
    - This action is irreversible
    - User will need to register again for face authentication
    - Any ongoing training will be terminated
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Face data deleted successfully',
    type: DeleteResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - no face data exists for user',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async deleteUser(@Req() req: RequestWithUser): Promise<DeleteResponseDto> {
    const userId = req.user?.userId?.toString();
    if (!userId) {
      throw new HttpException('User ID not found', HttpStatus.UNAUTHORIZED);
    }
    return this.faceAuthService.deleteUser(userId);
  }
} 