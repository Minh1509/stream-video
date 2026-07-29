import { spawn } from 'child_process'

export interface VideoInfo {
  duration: number
  width: number
  height: number
  codec: string
  bitrate: number
}

export function probeVideo(filePath: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      filePath,
    ]

    const proc = spawn('ffprobe', args)
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed (code ${code}): ${stderr}`))
        return
      }

      const data = JSON.parse(stdout)
      const videoStream = data.streams.find((s: any) => s.codec_type === 'video')

      if (!videoStream) {
        reject(new Error('No video stream found'))
        return
      }

      resolve({
        duration: parseFloat(data.format.duration),
        width: videoStream.width,
        height: videoStream.height,
        codec: videoStream.codec_name,
        bitrate: parseInt(data.format.bit_rate, 10),
      })
    })

    proc.on('error', reject)
  })
}
