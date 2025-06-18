import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';
import { redisConfig } from '../config/redis.config';
import { RedisService } from './redis.service';

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const config = redisConfig(configService);
        return {
          store: redisStore,
          ...config,
          ttl: 300, // Default TTL of 5 minutes (in seconds)
        };
      },
      inject: [ConfigService],
      isGlobal: true, // Make cache available globally
    }),
  ],
  providers: [RedisService],
  exports: [RedisService, CacheModule],
})
export class RedisModule {}
