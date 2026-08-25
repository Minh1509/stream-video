export const TRANSCODE_QUEUE = 'transcode';
export const TRANSCODE_JOB = 'transcode-to-hls';

export interface TranscodeJobData {
  videoId: string;
  inputPath: string;
}
