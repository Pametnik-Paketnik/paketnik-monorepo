import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { envValidationSchema } from './config/env.validation';
import { getDatabaseConfig } from './config/database.config';
import { AuthModule } from './auth/auth.module';
import { BoxesModule } from './boxes/boxes.module';
import { ReservationsModule } from './reservations/reservations.module';
import { StorageModule } from './storage/storage.module';
import { FaceAuthModule } from './face-auth/face-auth.module';
import { TwoFactorAuthModule } from './two-factor-auth/two-factor-auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'dev'}`,
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: true,
        allowUnknown: true,
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) =>
        getDatabaseConfig(configService),
      inject: [ConfigService],
    }),
    StorageModule,
    UsersModule,
    AuthModule,
    FaceAuthModule,
    TwoFactorAuthModule,
    BoxesModule,
    ReservationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
