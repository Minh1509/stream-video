import path from 'path'
import { transcodeVideo } from './transcode.js'

const PROFILES: Record<string, { width: number; height: number; videoBitrate: string; audioBitrate: string }> = {
  '1080p': { width: 1920, height: 1080, videoBitrate: '5000k', audioBitrate: '192k' },
  '720p':  { width: 1280, height: 720,  videoBitrate: '2500k', audioBitrate: '128k' },
  '480p':  { width: 854,  height: 480,  videoBitrate: '1000k', audioBitrate: '96k'  },
}

async function main() {
  const input = process.argv[2]
  if (!input) {
    console.error('Usage: tsx src/cli.ts <input-file>')
    process.exit(1)
  }

  const absInput = path.resolve(input)
  const dir = path.dirname(absInput)
  const base = path.basename(absInput, path.extname(absInput))

  for (const [profile, p] of Object.entries(PROFILES)) {
    const output = path.join(dir, `${base}_${profile}.mp4`)
    process.stdout.write(`\nTranscoding ${profile}...\n`)

    await transcodeVideo({
      input: absInput,
      output,
      ...p,
      onProgress: (pct) => process.stdout.write(`\r  ${profile}: ${pct}%   `),
    })

    console.log(`\n  → ${output}`)
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
