import { spawn } from 'child_process'
import { probeVideo } from './ffprobe.js'

export interface TranscodeOptions {
  input: string
  output: string
  width: number
  height: number
  videoBitrate: string
  audioBitrate: string
  onProgress?: (percent: number) => void
}

export function transcodeVideo(opts: TranscodeOptions): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const info = await probeVideo(opts.input).catch(reject)
    if (!info) return

    const args = [
      '-y',
      '-i', opts.input,
      '-vf', `scale=${opts.width}:${opts.height}`,
      '-c:v', 'libx264',
      '-b:v', opts.videoBitrate,
      '-c:a', 'aac',
      '-b:a', opts.audioBitrate,
      '-movflags', '+faststart',
      '-progress', 'pipe:2',
      opts.output,
    ]

    const proc = spawn('ffmpeg', args)
    let stderr = ''

    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stderr += text

      const outTimeMatch = text.match(/out_time_ms=(\d+)/)
      if (outTimeMatch && opts.onProgress) {
        const outMs = parseInt(outTimeMatch[1], 10) / 1000
        const durationMs = info.duration * 1000
        const percent = Math.min(100, Math.round((outMs / durationMs) * 100))
        opts.onProgress(percent)
      }
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg failed (code ${code}): ${stderr.slice(-500)}`))
      } else {
        resolve()
      }
    })

    proc.on('error', reject)
  })
}
