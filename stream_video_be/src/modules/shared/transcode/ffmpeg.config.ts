import { HLS_SEGMENT_SECONDS, Rendition } from './rendition.constant';

export function optionHlsOutput(
  rendition: Rendition,
  segmentPattern: string,
  keyInfoPath?: string,
): string[] {
  const opts = [
    '-preset',
    'veryfast',
    '-profile:v',
    'main',
    '-sc_threshold',
    '0',
    '-g',
    '48',
    '-keyint_min',
    '48',
    '-vf',
    `scale=w=${rendition.width}:h=${rendition.height}:force_original_aspect_ratio=decrease,pad=${rendition.width}:${rendition.height}:(ow-iw)/2:(oh-ih)/2`,
    '-b:v',
    rendition.videoBitrate,
    '-maxrate',
    rendition.maxrate,
    '-bufsize',
    rendition.bufsize,
    '-hls_time',
    String(HLS_SEGMENT_SECONDS),
    '-hls_playlist_type',
    'vod',
    '-hls_segment_filename',
    segmentPattern,
  ];

  if (keyInfoPath) {
    opts.push('-hls_key_info_file', keyInfoPath);
  }

  return opts;
}
