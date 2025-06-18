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
import { InventoryItemsModule } from './inventory-items/inventory-items.module';
import { ExtraOrdersModule } from './extra-orders/extra-orders.module';
import { CleanersModule } from './cleaners/cleaners.module';
import { TotpAuthModule } from './totp-auth/totp-auth.module';
import { FirebaseModule } from './firebase/firebase.module';
import { RedisModule } from './redis/redis.module';

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
    RedisModule,
    FirebaseModule,
    StorageModule,
    UsersModule,
    AuthModule,
    FaceAuthModule,
    BoxesModule,
    ReservationsModule,
    InventoryItemsModule,
    ExtraOrdersModule,
    CleanersModule,
    TotpAuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
