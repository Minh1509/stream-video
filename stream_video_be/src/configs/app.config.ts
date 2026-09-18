import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`,
  storageDir: process.env.STORAGE_DIR || 'storage',
  ffmpegPath: process.env.FFMPEG_PATH || '',
  ffprobePath: process.env.FFPROBE_PATH || '',
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  streamAccessKey: process.env.STREAM_ACCESS_KEY || 'dev-access-key',
  realesrganPath: process.env.REALESRGAN_PATH || 'bin/realesrgan/realesrgan-ncnn-vulkan.exe',
  enableAiUpscale: process.env.ENABLE_AI_UPSCALE === 'true',
}));
