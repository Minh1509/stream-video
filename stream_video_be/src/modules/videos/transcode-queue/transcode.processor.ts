import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { rm, unlink } from 'fs/promises';
import { join } from 'path';
import { Repository } from 'typeorm';
import { appConfiguration, s3Configuration } from '../../../configs';
import { AiUpscaleService } from '../../shared/ai-upscale';
import { AwsS3Service } from '../../shared/aws-s3';
import { FfmpegService } from '../../shared/ffmpeg';
import { TranscodeService } from '../../shared/transcode/transcode.service';
import { Video, VideoStatus } from '../entities/video.entity';
import { TRANSCODE_QUEUE, TranscodeJobData } from './transcode-queue.constant';

@Processor(TRANSCODE_QUEUE, { concurrency: 1 })
export class TranscodeProcessor extends WorkerHost {
  private readonly logger = new Logger(TranscodeProcessor.name);

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly transcodeService: TranscodeService,
    private readonly awsS3Service: AwsS3Service,
    private readonly aiUpscaleService: AiUpscaleService,
    private readonly ffmpegService: FfmpegService,
    @Inject(s3Configuration.KEY)
    private readonly s3Config: ConfigType<typeof s3Configuration>,
    @Inject(appConfiguration.KEY)
    private readonly appConfig: ConfigType<typeof appConfiguration>,
  ) {
    super();
  }

  async process(job: Job<TranscodeJobData>): Promise<void> {
    const { videoId, inputPath } = job.data;
    const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    let actualInputPath = inputPath;
    let upscaledTempPath: string | null = null;

    try {
      // 0. Kiểm tra nếu cần chạy AI Upscale (lấy từ biến môi trường ENABLE_AI_UPSCALE trong .env)
      if (this.aiUpscaleService.isEnabled) {
        const probe = await this.ffmpegService.probe(inputPath);
        if (probe.height < 1080) {
          this.logger.log(
            `[${videoId}] Video gốc (${probe.width}x${probe.height}) < 1080p. Đang kích hoạt Real-ESRGAN AI Upscale...`,
          );
          const storageRoot = join(process.cwd(), this.appConfig.storageDir);
          upscaledTempPath = join(storageRoot, `upscaled-${videoId}.mp4`);
          await this.aiUpscaleService.upscaleTo1080p(
            inputPath,
            upscaledTempPath,
            probe,
          );
          actualInputPath = upscaledTempPath;
        }
      }

      // 1. Transcode to HLS
      const result = await this.transcodeService.transcodeToHls(
        actualInputPath,
        videoId,
      );

      // 2. Upload HLS output to storage
      await this.awsS3Service.uploadDirectory(
        result.outputDir,
        result.keyPrefix,
      );

      // 3. Clean up local HLS files
      await rm(result.outputDir, { recursive: true, force: true }).catch(
        () => undefined,
      );

      const base = (this.s3Config.cloudFrontUrl ?? '').replace(/\/$/, '');
      await this.videoRepository.update(videoId, {
        status: VideoStatus.READY,
        hlsMasterUrl: `${base}/${result.masterRelativePath}`,
        thumbnailUrl: `${base}/${result.thumbnailRelativePath}`,
        duration: result.duration,
        encryptionKey: result.encryptionKey,
      });
      this.logger.log(`[${videoId}] transcode complete`);

      // 4. Clean up the original video
      await unlink(inputPath).catch(() => undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${videoId}] transcode failed (attempt ${job.attemptsMade + 1}): ${message}`,
      );

      if (isLastAttempt) {
        await this.videoRepository.update(videoId, {
          status: VideoStatus.FAILED,
        });
        await unlink(inputPath).catch(() => undefined);
      }

      throw err;
    } finally {
      if (upscaledTempPath) {
        await unlink(upscaledTempPath).catch(() => undefined);
      }
    }
  }
}
