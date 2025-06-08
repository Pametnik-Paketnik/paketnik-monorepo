import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { DeviceToken } from './entities/device-token.entity';
import { PendingAuthRequest } from './entities/pending-auth-request.entity';
import { TwoFactorAuthService } from './services/two-factor-auth.service';
import { FirebaseAdminService } from './services/firebase-admin.service';
import { RealTimeAuthGateway } from './gateways/real-time-auth.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeviceToken, PendingAuthRequest]),
    JwtModule.register({}),
    ConfigModule,
  ],
  providers: [
    TwoFactorAuthService,
    FirebaseAdminService,
    RealTimeAuthGateway,
  ],
  exports: [
    TwoFactorAuthService,
    FirebaseAdminService,
    RealTimeAuthGateway,
  ],
})
export class TwoFactorAuthModule {} 