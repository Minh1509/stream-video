import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { basename, extname, join } from 'path';
import appConfig from '../../configs/app.config';
import { appConfiguration, s3Configuration } from '../../configs';
import { Video } from './entities/video.entity';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { TranscodeModule } from '../shared/transcode/transcode.module';
import { AwsS3Module } from '../shared/aws-s3';
import { TranscodeProcessor } from './transcode-queue/transcode.processor';
import { TRANSCODE_QUEUE } from './transcode-queue/transcode-queue.constant';

@Module({
  imports: [
    TypeOrmModule.forFeature([Video]),
    TranscodeModule,
    AwsS3Module,
    ConfigModule.forFeature(s3Configuration),
    ConfigModule.forFeature(appConfiguration),
    BullModule.registerQueue({ name: TRANSCODE_QUEUE }),
    MulterModule.registerAsync({
      useFactory: (config: ConfigType<typeof appConfig>) => {
        const uploadDir = join(process.cwd(), config.storageDir, 'uploads');
        if (!existsSync(uploadDir)) {
          mkdirSync(uploadDir, { recursive: true });
        }
        return {
          storage: diskStorage({
            destination: uploadDir,
            filename: (_req, file, cb) => {
              const ext = extname(file.originalname);
              const name = basename(file.originalname, ext);
              cb(null, `${randomUUID()}-${name}-${Date.now()}${ext}`);
            },
          }),
          fileFilter: (_req, file, cb) => {
            if (file.mimetype.startsWith('video/')) {
              cb(null, true);
            } else {
              cb(new Error('Only video files are allowed'), false);
            }
          },
        };
      },
      inject: [appConfig.KEY],
    }),
  ],
  controllers: [VideosController],
  providers: [VideosService, TranscodeProcessor],
  exports: [VideosService],
})
export class VideosModule {}
