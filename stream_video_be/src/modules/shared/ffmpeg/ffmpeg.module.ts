import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfiguration } from 'src/configs';
import { FfmpegService } from './ffmpeg.service';

@Global()
@Module({
  imports: [ConfigModule.forFeature(appConfiguration)],
  providers: [FfmpegService],
  exports: [FfmpegService],
})
export class FfmpegModule {}
