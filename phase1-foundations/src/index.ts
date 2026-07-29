import { transcodeVideo } from './transcode.js'

await transcodeVideo({
  input: 'samples/sample.mp4',
  output: 'samples/sample_720p.mp4',
  width: 1280,
  height: 720,
  videoBitrate: '2500k',
  audioBitrate: '128k',
  onProgress: (p) => process.stdout.write(`\rProgress: ${p}%   `),
})
console.log('\nDone!')
