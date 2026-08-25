import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService, ConfigType } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import appConfig from '../configs/app.config';
import databaseConfig from '../configs/database.config';
import { VideosModule } from './videos/videos.module';
import { RedisModule } from './shared/redis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [databaseConfig, appConfig],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (syncDatabaseConfig: ConfigType<typeof databaseConfig>) =>
        syncDatabaseConfig,
      inject: [databaseConfig.KEY],
    }),
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>('REDIS_URL'),
        },
      }),
      inject: [ConfigService],
    }),
    ServeStaticModule.forRootAsync({
      useFactory: (config: ConfigType<typeof appConfig>) => [
        {
          rootPath: join(process.cwd(), config.storageDir),
          serveRoot: '/static',
          serveStaticOptions: {
            setHeaders: (res) => {
              res.setHeader('Access-Control-Allow-Origin', '*');
            },
          },
        },
      ],
      inject: [appConfig.KEY],
    }),
    VideosModule,
    RedisModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
