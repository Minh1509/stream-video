# Phase 1: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CLI tool that wraps FFmpeg to transcode any video input into multiple resolutions (1080p/720p/480p), demonstrating solid understanding of codecs, containers, and FFmpeg internals.

**Architecture:** A TypeScript CLI spawns FFmpeg as a child process, streams stderr to parse progress, and outputs multi-resolution MP4 files. No external libraries for media work — only Node.js built-ins + FFmpeg binary.

**Tech Stack:** Node.js 20+, TypeScript 5+, FFmpeg 6+ (system install), tsx for running TS directly.

## Global Constraints

- FFmpeg must be installed on the system and available in PATH
- No cloud services or media libraries — FFmpeg only
- TypeScript strict mode enabled

---

### Task 1: Project Scaffold

**Files:**
- Create: `phase1-foundations/package.json`
- Create: `phase1-foundations/tsconfig.json`
- Create: `phase1-foundations/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "phase1-foundations",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create src/index.ts placeholder**

```ts
console.log('Phase 1: Foundations')
```

- [ ] **Step 4: Install dependencies and verify**

```bash
cd phase1-foundations && npm install && npm run dev
```
Expected output: `Phase 1: Foundations`

- [ ] **Step 5: Commit**

```bash
git add phase1-foundations/
git commit -m "feat(phase1): scaffold project"
```

---

### Task 2: FFmpeg Probe Wrapper

**Files:**
- Create: `phase1-foundations/src/ffprobe.ts`

**Interfaces:**
- Produces: `probeVideo(filePath: string): Promise<VideoInfo>`
- `VideoInfo`: `{ duration: number, width: number, height: number, codec: string, bitrate: number }`

- [ ] **Step 1: Download a small test video**

```bash
curl -L "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4" \
  -o phase1-foundations/samples/sample.mp4 --create-dirs
```

- [ ] **Step 2: Create src/ffprobe.ts**

```ts
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
```

- [ ] **Step 3: Smoke test in index.ts**

Replace `src/index.ts`:

```ts
import { probeVideo } from './ffprobe.js'

const info = await probeVideo('samples/sample.mp4')
console.log('Video info:', info)
```

Run: `cd phase1-foundations && npm run dev`
Expected: prints `{ duration, width: 1920, height: 1080, codec: 'h264', bitrate: ... }`

- [ ] **Step 4: Commit**

```bash
git add phase1-foundations/src/ffprobe.ts phase1-foundations/src/index.ts
git commit -m "feat(phase1): add ffprobe wrapper"
```

---

### Task 3: FFmpeg Transcode Wrapper

**Files:**
- Create: `phase1-foundations/src/transcode.ts`

**Interfaces:**
- Consumes: `VideoInfo` from `ffprobe.ts`
- Produces: `transcodeVideo(opts: TranscodeOptions): Promise<void>`
- `TranscodeOptions`: `{ input: string, output: string, width: number, height: number, videoBitrate: string, audioBitrate: string, onProgress?: (percent: number) => void }`

- [ ] **Step 1: Create src/transcode.ts**

```ts
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
```

- [ ] **Step 2: Smoke test in index.ts**

```ts
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
```

Run: `cd phase1-foundations && npm run dev`
Expected: progress counter, then `samples/sample_720p.mp4` created

- [ ] **Step 3: Commit**

```bash
git add phase1-foundations/src/transcode.ts phase1-foundations/src/index.ts
git commit -m "feat(phase1): add transcode wrapper with progress reporting"
```

---

### Task 4: Multi-Resolution CLI Tool

**Files:**
- Create: `phase1-foundations/src/cli.ts`
- Modify: `phase1-foundations/package.json` (add `cli` script)

**Interfaces:**
- Produces: `npx tsx src/cli.ts <input>` → `<basename>_1080p.mp4`, `<basename>_720p.mp4`, `<basename>_480p.mp4`

- [ ] **Step 1: Create src/cli.ts**

```ts
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
```

- [ ] **Step 2: Run CLI end-to-end**

```bash
cd phase1-foundations && npx tsx src/cli.ts samples/sample.mp4
```
Expected: three files created — `sample_1080p.mp4`, `sample_720p.mp4`, `sample_480p.mp4`

- [ ] **Step 3: Verify output files with ffprobe**

```bash
ffprobe -v quiet -show_streams -of json samples/sample_720p.mp4 | grep height
```
Expected: `"height": 720`

- [ ] **Step 4: Commit**

```bash
git add phase1-foundations/src/cli.ts
git commit -m "feat(phase1): add multi-resolution CLI tool — completes phase 1 demo"
```
