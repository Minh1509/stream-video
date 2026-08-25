export interface TranscodeResult {
  masterRelativePath: string;
  thumbnailRelativePath: string;
  duration: number;
  // Absolute local directory holding the HLS output (for uploading to storage).
  outputDir: string;
  // Key prefix under which the output should be stored (e.g. "hls/{videoId}").
  keyPrefix: string;
}
