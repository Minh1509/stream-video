import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`,
  storageDir: process.env.STORAGE_DIR || 'storage',
  ffmpegPath: process.env.FFMPEG_PATH || '',
  ffprobePath: process.env.FFPROBE_PATH || '',
}));
