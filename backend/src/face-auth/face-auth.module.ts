import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FaceAuthController } from './face-auth.controller';
import { FaceAuthService } from './face-auth.service';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [FaceAuthController],
  providers: [FaceAuthService],
  exports: [FaceAuthService],
})
export class FaceAuthModule {}
