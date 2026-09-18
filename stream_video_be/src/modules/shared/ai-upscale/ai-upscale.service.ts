import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, rm } from 'fs/promises';
import { dirname, isAbsolute, join } from 'path';
import { appConfiguration } from 'src/configs';
import { FfmpegService } from '../ffmpeg';
import { ProbeResult } from '../ffmpeg/ffmpeg.type';

@Injectable()
export class AiUpscaleService implements OnModuleInit {
  private readonly logger = new Logger(AiUpscaleService.name);

  constructor(
    @Inject(appConfiguration.KEY)
    private readonly appConfig: ConfigType<typeof appConfiguration>,
    private readonly ffmpegService: FfmpegService,
  ) {}

  /**
   * Tự động dọn dẹp các thư mục frames tạm còn sót lại nếu server bị tắt đột ngột
   * hoặc crash trong lần chạy trước.
   */
  async onModuleInit(): Promise<void> {
    const tmpRoot = join(process.cwd(), this.appConfig.storageDir, 'tmp-ai');
    try {
      await rm(tmpRoot, { recursive: true, force: true });
      await mkdir(tmpRoot, { recursive: true });
      this.logger.log(`Đã dọn dẹp thư mục tạm AI Upscale tồn dư: ${tmpRoot}`);
    } catch (err) {
      this.logger.warn(`Dọn dẹp tmp-ai lúc boot lỗi: ${(err as Error).message}`);
    }
  }

  get isEnabled(): boolean {
    return !!this.appConfig.enableAiUpscale;
  }

  get realesrganBinPath(): string {
    const raw =
      this.appConfig.realesrganPath ||
      'bin/realesrgan/realesrgan-ncnn-vulkan.exe';
    return isAbsolute(raw) ? raw : join(process.cwd(), raw);
  }

  /**
   * Nâng cấp độ phân giải video lên chuẩn Full HD 1080p bằng Real-ESRGAN AI.
   * Quy trình tối ưu:
   * 1. Trích xuất khung hình với -vsync 0 giữ nguyên 100% frame gốc mà không drop/duplicate.
   * 2. Gọi Real-ESRGAN NCNN Vulkan tăng độ sắc nét qua GPU.
   * 3. Ghép frames trực tiếp với track âm thanh gốc từ input (không cần giải mã audio trung gian).
   * 4. Dọn dẹp thư mục frames tạm.
   */
  async upscaleTo1080p(
    inputPath: string,
    outputPath: string,
    providedProbe?: ProbeResult,
  ): Promise<string> {
    const probe = providedProbe || (await this.ffmpegService.probe(inputPath));
    const binPath = this.realesrganBinPath;

    if (!existsSync(binPath)) {
      throw new Error(
        `Không tìm thấy binary Real-ESRGAN tại đường dẫn: ${binPath}`,
      );
    }

    const modelDir = join(dirname(binPath), 'models');
    const tmpDir = join(
      process.cwd(),
      this.appConfig.storageDir,
      'tmp-ai',
      `${Date.now()}_${randomUUID().slice(0, 8)}`,
    );
    const framesInDir = join(tmpDir, 'in');
    const framesOutDir = join(tmpDir, 'out');

    await mkdir(framesInDir, { recursive: true });
    await mkdir(framesOutDir, { recursive: true });

    // Tính toán scale factor: <= 360p dùng x4; 480p-720p dùng x2
    const scale = probe.height <= 360 ? 4 : 2;
    const fps = probe.fps || 30;

    const ffmpegBin = this.appConfig.ffmpegPath || 'ffmpeg';

    this.logger.log(
      `[AI Upscale] Bắt đầu xử lý: ${inputPath} (${probe.width}x${probe.height}, ${fps}fps) -> scale=${scale}x`,
    );

    try {
      // 1. Trích xuất frames (dùng -vsync 0 để chuẩn xác từng frame, không drop)
      this.logger.log('1/3. Đang trích xuất video frames...');
      await this.runProcess(
        ffmpegBin,
        [
          '-y',
          '-i',
          inputPath,
          '-vsync',
          '0',
          '-qscale:v',
          '2',
          join(framesInDir, 'frame_%06d.jpg'),
        ],
        'FFmpeg frames extraction',
      );

      // 2. Chạy Real-ESRGAN NCNN Vulkan
      this.logger.log(
        `2/3. Đang thực thi Real-ESRGAN Vulkan (mô hình realesr-animevideov3, scale ${scale}x)...`,
      );
      await this.runProcess(
        binPath,
        [
          '-i',
          framesInDir,
          '-o',
          framesOutDir,
          '-m',
          modelDir,
          '-n',
          'realesr-animevideov3',
          '-s',
          String(scale),
          '-f',
          'jpg',
        ],
        'Real-ESRGAN AI Upscale',
      );

      // 3. Ghép frames đã upscale và lấy audio trực tiếp từ video gốc
      this.logger.log('3/3. Đang ghép frames thành video 1080p...');
      const mergeArgs = [
        '-y',
        '-framerate',
        String(fps),
        '-i',
        join(framesOutDir, 'frame_%06d.jpg'),
      ];

      if (probe.hasAudio) {
        mergeArgs.push('-i', inputPath);
        mergeArgs.push('-map', '0:v:0', '-map', '1:a:0?');
      } else {
        mergeArgs.push('-map', '0:v:0');
      }

      mergeArgs.push(
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-pix_fmt',
        'yuv420p',
        '-vf',
        'scale=w=1920:h=1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
      );

      if (probe.hasAudio) {
        mergeArgs.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
      }

      mergeArgs.push(outputPath);

      await this.runProcess(ffmpegBin, mergeArgs, 'FFmpeg merge video');

      this.logger.log(`[AI Upscale] Hoàn thành thành công: ${outputPath}`);
      return outputPath;
    } finally {
      // Dọn dẹp toàn bộ frames tạm để giải phóng ổ cứng
      await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private runProcess(
    bin: string,
    args: string[],
    contextName: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(bin, args, { windowsHide: true });
      let stderrMsg = '';

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        stderrMsg += text;
      });

      proc.on('error', (err) => {
        this.logger.error(`[${contextName}] lỗi khởi chạy: ${err.message}`);
        reject(err);
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          const tail = stderrMsg.slice(-400);
          this.logger.error(
            `[${contextName}] thất bại với mã lỗi ${code}: ${tail}`,
          );
          reject(
            new Error(
              `[${contextName}] kết thúc với mã lỗi ${code}: ${tail.trim()}`,
            ),
          );
        }
      });
    });
  }
}
