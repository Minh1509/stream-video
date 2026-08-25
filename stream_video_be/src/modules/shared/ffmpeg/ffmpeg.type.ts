export interface ProbeResult {
  width: number;
  height: number;
  duration: number;
  hasAudio: boolean;
}

export interface ThumbnailOptions {
  timestamps?: string[];
  filename?: string;
  size?: string;
}
