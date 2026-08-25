import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { appConfiguration } from 'src/configs';
import { join } from 'path';
import { mkdir, rm, writeFile } from 'fs/promises';
import { FfmpegService } from '../ffmpeg';
import { TranscodeResult } from './transcode.type';
import { Rendition, RENDITIONS } from './rendition.constant';
import { optionHlsOutput } from './ffmpeg.config';

@Injectable()
export class TranscodeService {
  private readonly logger = new Logger(TranscodeService.name);

  constructor(
    @Inject(appConfiguration.KEY)
    private readonly appConfig: ConfigType<typeof appConfiguration>,
    private readonly ffmpegService: FfmpegService,
  ) {}

  private get storageRoot(): string {
    return join(process.cwd(), this.appConfig.storageDir);
  }

  async transcodeToHls(
    inputPath: string,
    videoId: string,
  ): Promise<TranscodeResult> {
    // 1. Get information video
    const probe = await this.ffmpegService.probe(inputPath);

    // 2. Select renditions <= the source (fallback to smallest)
    const matched = RENDITIONS.filter((r) => r.height <= probe.height);
    const renditions = matched.length ? matched : [RENDITIONS[0]];

    // 3. Output directory
    const baseRelative = join('hls', videoId);
    const baseDir = join(this.storageRoot, baseRelative);
    await mkdir(baseDir, { recursive: true });

    try {
      // 4. Transcode each rendition to HLS
      for (const rendition of renditions) {
        const renditionDir = join(baseDir, rendition.name);
        await mkdir(renditionDir, { recursive: true });

        this.logger.log(`[${videoId}] transcoding ${rendition.name}...`);
        await this.transcodeRendition(
          inputPath,
          renditionDir,
          rendition,
          probe.hasAudio,
        );
      }

      // 5. Write master playlist referencing renditions
      const master = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        ...renditions.flatMap((r) => [
          `#EXT-X-STREAM-INF:BANDWIDTH=${r.bandwidth},RESOLUTION=${r.width}x${r.height},NAME="${r.height}p"`,
          `${r.name}/index.m3u8`,
        ]),
      ].join('\n');
      await writeFile(join(baseDir, 'master.m3u8'), master, 'utf-8');

      // 6. Generate thumbnail
      await this.ffmpegService.generateThumbnail(inputPath, baseDir);

      return {
        masterRelativePath: toUrlPath(join(baseRelative, 'master.m3u8')),
        thumbnailRelativePath: toUrlPath(join(baseRelative, 'thumbnail.jpg')),
        duration: probe.duration,
        outputDir: baseDir,
        keyPrefix: toUrlPath(baseRelative),
      };
    } catch (err) {
      await rm(baseDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
      throw err;
    }
  }

  private transcodeRendition(
    inputPath: string,
    outputDir: string,
    rendition: Rendition,
    hasAudio: boolean,
  ): Promise<void> {
    const playlist = join(outputDir, 'index.m3u8');
    const segmentPattern = join(outputDir, 'seg_%03d.ts');

    return this.ffmpegService.run(inputPath, (command) => {
      command.videoCodec('libx264');
      if (hasAudio) {
        command.audioCodec('aac').audioBitrate(rendition.audioBitrate);
      } else {
        command.noAudio();
      }

      return command
        .outputOptions(optionHlsOutput(rendition, segmentPattern))
        .output(playlist);
    });
  }
}

function toUrlPath(p: string): string {
  return p.replace(/\\/g, '/');
}
