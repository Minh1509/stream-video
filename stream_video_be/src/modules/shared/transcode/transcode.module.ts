import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfiguration } from 'src/configs';
import { TranscodeService } from './transcode.service';
import { FfmpegModule } from '../ffmpeg';

@Module({
  imports: [ConfigModule.forFeature(appConfiguration), FfmpegModule],
  providers: [TranscodeService],
  exports: [TranscodeService],
})
export class TranscodeModule {}
