import { Module } from '@nestjs/common';
import { FfmpegModule } from '../ffmpeg/ffmpeg.module';
import { AiUpscaleService } from './ai-upscale.service';

@Module({
  imports: [FfmpegModule],
  providers: [AiUpscaleService],
  exports: [AiUpscaleService],
})
export class AiUpscaleModule {}
