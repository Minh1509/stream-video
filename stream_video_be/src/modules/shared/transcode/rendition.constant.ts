export interface Rendition {
  name: string; // folder name, e.g. "360p"
  height: number; // target height in px
  width: number; // target width in px (16:9)
  videoBitrate: string; // e.g. "800k"
  maxrate: string;
  bufsize: string;
  audioBitrate: string; // e.g. "96k"
  bandwidth: number; // for master playlist BANDWIDTH attr (bits/s)
}

export const RENDITIONS: Rendition[] = [
  {
    name: '360p',
    height: 360,
    width: 640,
    videoBitrate: '800k',
    maxrate: '856k',
    bufsize: '1200k',
    audioBitrate: '96k',
    bandwidth: 900000,
  },
  {
    name: '720p',
    height: 720,
    width: 1280,
    videoBitrate: '2800k',
    maxrate: '2996k',
    bufsize: '4200k',
    audioBitrate: '128k',
    bandwidth: 3000000,
  },
  {
    name: '1080p',
    height: 1080,
    width: 1920,
    videoBitrate: '5000k',
    maxrate: '5350k',
    bufsize: '7500k',
    audioBitrate: '192k',
    bandwidth: 5200000,
  },
];

export const HLS_SEGMENT_SECONDS = 6;
