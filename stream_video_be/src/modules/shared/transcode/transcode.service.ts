import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { appConfiguration } from 'src/configs';
import { join } from 'path';
import { mkdir, rm, unlink, writeFile } from 'fs/promises';
import { randomBytes } from 'crypto';
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
    const probe = await this.ffmpegService.probe(inputPath);

    const matched = RENDITIONS.filter((r) => r.height <= probe.height);
    const renditions = matched.length ? matched : [RENDITIONS[0]];

    const baseRelative = join('hls', videoId);
    const baseDir = join(this.storageRoot, baseRelative);
    await mkdir(baseDir, { recursive: true });

    // Generate AES-128 key 
    const keyBytes = randomBytes(16);
    const keyHex = keyBytes.toString('hex');
    const keyFilePath = join(baseDir, 'enc.key');
    const keyInfoPath = join(baseDir, 'enc.keyinfo');

    const keyUri = `${this.appConfig.appUrl}/videos/${videoId}/stream/key`;
    await writeFile(keyFilePath, keyBytes);
    // keyinfo format: <URI>\n<local key file path>\n
    await writeFile(keyInfoPath, `${keyUri}\n${keyFilePath}\n`, 'utf-8');

    try {
      for (const rendition of renditions) {
        const renditionDir = join(baseDir, rendition.name);
        await mkdir(renditionDir, { recursive: true });

        this.logger.log(`[${videoId}] transcoding ${rendition.name}...`);
        await this.transcodeRendition(
          inputPath,
          renditionDir,
          rendition,
          probe.hasAudio,
          keyInfoPath,
        );
      }

      const master = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        ...renditions.flatMap((r) => [
          `#EXT-X-STREAM-INF:BANDWIDTH=${r.bandwidth},RESOLUTION=${r.width}x${r.height},NAME="${r.height}p"`,
          `${r.name}/index.m3u8`,
        ]),
      ].join('\n');
      await writeFile(join(baseDir, 'master.m3u8'), master, 'utf-8');

      await this.ffmpegService.generateThumbnail(inputPath, baseDir);

      // Clean up temp key files
      await unlink(keyFilePath).catch(() => undefined);
      await unlink(keyInfoPath).catch(() => undefined);

      return {
        masterRelativePath: toUrlPath(join(baseRelative, 'master.m3u8')),
        thumbnailRelativePath: toUrlPath(join(baseRelative, 'thumbnail.jpg')),
        duration: probe.duration,
        outputDir: baseDir,
        keyPrefix: toUrlPath(baseRelative),
        encryptionKey: keyHex,
      };
    } catch (err) {
      await unlink(keyFilePath).catch(() => undefined);
      await unlink(keyInfoPath).catch(() => undefined);
      await rm(baseDir, { recursive: true, force: true }).catch(() => undefined);
      throw err;
    }
  }

  private transcodeRendition(
    inputPath: string,
    outputDir: string,
    rendition: Rendition,
    hasAudio: boolean,
    keyInfoPath: string,
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
        .outputOptions(optionHlsOutput(rendition, segmentPattern, keyInfoPath))
        .output(playlist);
    });
  }
}

function toUrlPath(p: string): string {
  return p.replace(/\\/g, '/');
}
