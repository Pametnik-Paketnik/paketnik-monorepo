import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { redisConfig } from '../config/redis.config';

@Injectable()
export class RedisService implements OnModuleInit {
  private redis: Redis;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {}

  onModuleInit(): void {
    // Create a dedicated Redis client for direct operations
    const config = redisConfig(this.configService);
    this.redis = new Redis(config);
  }

  /**
   * Cache Manager Operations (High-level, with TTL support)
   */

  // Set a value with optional TTL
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl);
  }

  // Get a value
  async get<T>(key: string): Promise<T | undefined> {
    return await this.cacheManager.get<T>(key);
  }

  // Delete a key
  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  // Clear all cache (using direct Redis client since cache manager may not have reset)
  async reset(): Promise<void> {
    await this.redis.flushdb();
  }

  /**
   * Direct Redis Operations (Low-level, for advanced use cases)
   */

  // Get the Redis client for direct operations
  getRedisClient(): Redis {
    return this.redis;
  }

  // Set with expiration
  async setex(key: string, seconds: number, value: string): Promise<void> {
    await this.redis.setex(key, seconds, value);
  }

  // Hash operations
  async hset(key: string, field: string, value: string): Promise<void> {
    await this.redis.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return await this.redis.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return await this.redis.hgetall(key);
  }

  // List operations
  async lpush(key: string, ...values: string[]): Promise<number> {
    return await this.redis.lpush(key, ...values);
  }

  async rpop(key: string): Promise<string | null> {
    return await this.redis.rpop(key);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return await this.redis.lrange(key, start, stop);
  }

  // Set operations
  async sadd(key: string, ...members: string[]): Promise<number> {
    return await this.redis.sadd(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return await this.redis.smembers(key);
  }

  // Key operations
  async exists(key: string): Promise<number> {
    return await this.redis.exists(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return await this.redis.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return await this.redis.ttl(key);
  }

  // Pattern matching
  async keys(pattern: string): Promise<string[]> {
    return await this.redis.keys(pattern);
  }

  /**
   * Utility Methods
   */

  // Check if Redis is connected
  async ping(): Promise<string> {
    return await this.redis.ping();
  }

  // Get Redis info
  async info(section?: string): Promise<string> {
    if (section) {
      return await this.redis.info(section);
    }
    return await this.redis.info();
  }
}
