import { ConfigService } from '@nestjs/config';

export const redisConfig = (configService: ConfigService) => ({
  host: configService.get<string>('REDIS_HOST') || 'redis',
  port: parseInt(configService.get<string>('REDIS_PORT') || '6379', 10),
  password: configService.get<string>('REDIS_PASSWORD') || '',
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
  lazyConnect: true,
});
