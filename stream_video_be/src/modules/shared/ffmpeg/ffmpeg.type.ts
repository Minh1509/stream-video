export interface ProbeResult {
  width: number;
  height: number;
  duration: number;
  hasAudio: boolean;
  fps?: number;
}

export interface ThumbnailOptions {
  timestamps?: string[];
  filename?: string;
  size?: string;
}
