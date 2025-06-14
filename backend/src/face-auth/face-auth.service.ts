import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegisterResponseDto } from './dto/register-response.dto';
import { VerifyResponseDto } from './dto/verify-response.dto';
import { StatusResponseDto } from './dto/status-response.dto';
import { DeleteResponseDto } from './dto/delete-response.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class FaceAuthService {
  private readonly logger = new Logger(FaceAuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Register a user's face by faking the registration process
   */
  registerFace(
    userId: string,
    files: Express.Multer.File[],
  ): Promise<RegisterResponseDto> {
    this.logger.log(
      `Faking face registration for user ${userId} with ${files.length} images`,
    );

    // Simulate successful registration
    const response: RegisterResponseDto = {
      user_id: userId,
      status: 'training_started',
      images_received: files.length,
      message: 'Training started in background. Use /status to check progress.',
    };

    this.logger.log(`Fake face registration successful for user ${userId}`);
    return Promise.resolve(response);
  }

  /**
   * Verify a user's face by faking the verification process
   */
  verifyFace(
    userId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _file: Express.Multer.File,
  ): Promise<VerifyResponseDto> {
    this.logger.log(`Faking face verification for user ${userId}`);

    // Simulate successful verification with high probability
    const response: VerifyResponseDto = {
      user_id: userId,
      authenticated: true,
      probability: 0.95, // High confidence fake score
    };

    this.logger.log(
      `Fake face verification result for user ${userId}: ${response.authenticated}`,
    );
    return Promise.resolve(response);
  }

  /**
   * Check training status for a user - fake as training completed
   */
  async getStatus(userId: string): Promise<StatusResponseDto> {
    this.logger.log(`Faking status check for user ${userId}`);

    const statusData: StatusResponseDto = {
      user_id: userId,
      status: 'training_completed',
      model_ready: true,
      message: 'Model training completed successfully. User can now login.',
    };

    // If training is "completed" and user hasn't been enabled yet, enable face auth
    await this.enableFaceAuthForUser(parseInt(userId));

    return statusData;
  }

  /**
   * Enable face authentication for a user
   */
  async enableFaceAuthForUser(userId: number): Promise<void> {
    try {
      const user = await this.usersRepository.findOne({
        where: { id: userId },
      });

      if (user && !user.faceEnabled) {
        user.faceEnabled = true;
        await this.usersRepository.save(user);
        this.logger.log(`Face authentication enabled for user ${userId}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to enable face auth for user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Delete a user's face model and data - fake the deletion
   */
  async deleteFaceData(userId: string): Promise<DeleteResponseDto> {
    this.logger.log(`Faking face data deletion for user ${userId}`);

    // Disable face authentication for the user
    await this.disableFaceAuthForUser(parseInt(userId));

    const response: DeleteResponseDto = {
      user_id: userId,
      status: 'deleted',
      model_deleted: true,
      local_data_deleted: true,
      message: 'User data deleted successfully.',
    };

    this.logger.log(
      `Fake face data deletion result for user ${userId}: ${response.status}`,
    );
    return response;
  }

  /**
   * Disable face authentication for a user
   */
  async disableFaceAuthForUser(userId: number): Promise<void> {
    try {
      const user = await this.usersRepository.findOne({
        where: { id: userId },
      });

      if (user && user.faceEnabled) {
        user.faceEnabled = false;
        await this.usersRepository.save(user);
        this.logger.log(`Face authentication disabled for user ${userId}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to disable face auth for user ${userId}:`,
        error,
      );
    }
  }
}
