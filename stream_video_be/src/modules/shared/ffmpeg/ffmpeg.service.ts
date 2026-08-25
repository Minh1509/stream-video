import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import ffmpeg from 'fluent-ffmpeg';
import { appConfiguration } from 'src/configs';
import { ProbeResult, ThumbnailOptions } from './ffmpeg.type';

@Injectable()
export class FfmpegService {
  constructor(
    @Inject(appConfiguration.KEY)
    appConfig: ConfigType<typeof appConfiguration>,
  ) {
    if (appConfig.ffmpegPath) ffmpeg.setFfmpegPath(appConfig.ffmpegPath);
    if (appConfig.ffprobePath) ffmpeg.setFfprobePath(appConfig.ffprobePath);
  }

  probe(inputPath: string): Promise<ProbeResult> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, data) => {
        if (err) return reject(err);
        const stream = data.streams.find((s) => s.codec_type === 'video');
        if (!stream) return reject(new Error('No video stream found'));
        resolve({
          width: stream.width ?? 0,
          height: stream.height ?? 0,
          duration: Math.round(Number(data.format.duration) || 0),
          hasAudio: data.streams.some((s) => s.codec_type === 'audio'),
        });
      });
    });
  }

  run(
    inputPath: string,
    configure: (command: ffmpeg.FfmpegCommand) => ffmpeg.FfmpegCommand,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      configure(ffmpeg(inputPath))
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });
  }

  generateThumbnail(
    inputPath: string,
    outputDir: string,
    options: ThumbnailOptions = {},
  ): Promise<void> {
    const {
      timestamps = ['50%'],
      filename = 'thumbnail.jpg',
      size = '640x360',
    } = options;

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .on('end', () => resolve())
        .on('error', reject)
        .screenshots({ timestamps, filename, folder: outputDir, size });
    });
  }
}
