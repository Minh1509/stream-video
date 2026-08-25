export interface TranscodeResult {
  masterRelativePath: string;
  thumbnailRelativePath: string;
  duration: number;
  outputDir: string;
  keyPrefix: string;
  encryptionKey: string;
}
