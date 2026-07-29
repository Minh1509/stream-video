import { probeVideo } from './ffprobe.js'

const info = await probeVideo('samples/sample.mp4')
console.log('Video info:', info)
