import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { REDIS_CLIENT } from './redis.constant';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    Logger,
    {
      provide: REDIS_CLIENT,
      useFactory: async (configService: ConfigService, logger: Logger) => {
        const redisUrl = configService.get<string>('REDIS_URL');

        const redisClient = new IORedis(redisUrl, {
          retryStrategy: () => null,
          maxRetriesPerRequest: 1,
        });

        redisClient.on('error', (err) => {
          logger.error(`${err.message}`, 'RedisClient');
        });
        redisClient.on('connect', () => {
          logger.log(`Redis client connected`, 'RedisClient');
        });

        // Check redis connection
        try {
          await redisClient.ping();
        } catch (err) {
          throw err instanceof Error ? err : new Error(String(err));
        }

        return redisClient;
      },
      inject: [ConfigService, Logger],
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
