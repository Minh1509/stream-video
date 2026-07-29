# Phase 2: VOD Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mini VOD platform — upload a video, transcode it into multi-bitrate HLS, serve via HTTP, and play in a React browser app with adaptive bitrate switching.

**Architecture:** Express API handles upload and triggers FFmpeg HLS packaging; Nginx serves the static HLS segments; React + HLS.js player fetches the master manifest and switches bitrates automatically. All runs in Docker Compose.

**Tech Stack:** Node.js 20+, TypeScript 5+, Express 4, FFmpeg 6+, Nginx, HLS.js 1.x, Multer, Docker Compose.

## Global Constraints

- HLS packaging uses FFmpeg only — no third-party packagers
- Segments use MPEG-TS container (`.ts` files)
- Master manifest must include all three renditions: 1080p, 720p, 480p
- Player must use HLS.js (not native HLS)
- Docker Compose must start the full stack with `docker compose up`

---

### Task 1: Project Scaffold + Docker Compose

**Files:**
- Create: `phase2-vod/docker-compose.yml`
- Create: `phase2-vod/api/package.json`
- Create: `phase2-vod/api/tsconfig.json`
- Create: `phase2-vod/api/src/index.ts`
- Create: `phase2-vod/api/Dockerfile`
- Create: `phase2-vod/nginx/nginx.conf`
- Create: `phase2-vod/player/index.html`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
version: '3.9'
services:
  api:
    build: ./api
    ports:
      - "3000:3000"
    volumes:
      - hls_data:/data/hls
      - uploads:/data/uploads
    environment:
      - HLS_DIR=/data/hls
      - UPLOAD_DIR=/data/uploads

  nginx:
    image: nginx:1.25-alpine
    ports:
      - "8080:80"
    volumes:
      - hls_data:/usr/share/nginx/hls:ro
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./player:/usr/share/nginx/html:ro

volumes:
  hls_data:
  uploads:
```

- [ ] **Step 2: Create nginx/nginx.conf**

```nginx
server {
    listen 80;

    location /hls {
        root /usr/share/nginx;
        add_header Cache-Control "no-cache";
        add_header Access-Control-Allow-Origin *;
        types {
            application/vnd.apple.mpegurl m3u8;
            video/mp2t              ts;
        }
    }

    location / {
        root /usr/share/nginx/html;
        index index.html;
    }
}
```

- [ ] **Step 3: Create api/package.json**

```json
{
  "name": "phase2-vod-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "multer": "^1.4.5-lts.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/multer": "^1.4.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 4: Create api/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

- [ ] **Step 5: Create api/Dockerfile**

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
```

- [ ] **Step 6: Create api/src/index.ts placeholder**

```ts
import express from 'express'
const app = express()
app.get('/health', (_req, res) => res.json({ ok: true }))
app.listen(3000, () => console.log('API on :3000'))
export { app }
```

- [ ] **Step 7: Create player/index.html placeholder**

```html
<!DOCTYPE html><html><body><h1>VOD Player — coming in Task 4</h1></body></html>
```

- [ ] **Step 8: Commit**

```bash
git add phase2-vod/
git commit -m "feat(phase2): scaffold VOD project with Docker Compose"
```

---

### Task 2: HLS Packager

**Files:**
- Create: `phase2-vod/api/src/hls-packager.ts`

**Interfaces:**
- Produces: `packageHLS(opts: HLSPackageOptions): Promise<string>` — returns path to master manifest
- `HLSPackageOptions`: `{ inputPath: string, outputDir: string, videoId: string }`
- Output: `<outputDir>/<videoId>/master.m3u8`, `<outputDir>/<videoId>/1080p/index.m3u8`, etc.

- [ ] **Step 1: Create src/hls-packager.ts**

```ts
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

export interface HLSPackageOptions {
  inputPath: string
  outputDir: string
  videoId: string
}

interface Rendition {
  name: string
  width: number
  height: number
  videoBitrate: string
  audioBitrate: string
  bandwidth: number
}

const RENDITIONS: Rendition[] = [
  { name: '1080p', width: 1920, height: 1080, videoBitrate: '5000k', audioBitrate: '192k', bandwidth: 5200000 },
  { name: '720p',  width: 1280, height: 720,  videoBitrate: '2500k', audioBitrate: '128k', bandwidth: 2628000 },
  { name: '480p',  width: 854,  height: 480,  videoBitrate: '1000k', audioBitrate: '96k',  bandwidth: 1096000 },
]

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args)
    let stderr = ''
    proc.stderr.on('data', (c: Buffer) => { stderr += c.toString() })
    proc.on('close', (code) => {
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-300)}`))
    })
    proc.on('error', reject)
  })
}

export async function packageHLS(opts: HLSPackageOptions): Promise<string> {
  const videoDir = path.join(opts.outputDir, opts.videoId)

  for (const r of RENDITIONS) {
    const rendDir = path.join(videoDir, r.name)
    fs.mkdirSync(rendDir, { recursive: true })

    await runFFmpeg([
      '-y', '-i', opts.inputPath,
      '-vf', `scale=${r.width}:${r.height}`,
      '-c:v', 'libx264', '-b:v', r.videoBitrate,
      '-c:a', 'aac', '-b:a', r.audioBitrate,
      '-hls_time', '6',
      '-hls_list_size', '0',
      '-hls_segment_filename', path.join(rendDir, 'seg%03d.ts'),
      '-f', 'hls',
      path.join(rendDir, 'index.m3u8'),
    ])
  }

  const masterPath = path.join(videoDir, 'master.m3u8')
  const lines = ['#EXTM3U', '']
  for (const r of RENDITIONS) {
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${r.bandwidth},RESOLUTION=${r.width}x${r.height}`)
    lines.push(`${r.name}/index.m3u8`)
    lines.push('')
  }
  fs.writeFileSync(masterPath, lines.join('\n'))

  return masterPath
}
```

- [ ] **Step 2: Commit**

```bash
git add phase2-vod/api/src/hls-packager.ts
git commit -m "feat(phase2): add HLS packager"
```

---

### Task 3: Upload API Endpoint

**Files:**
- Create: `phase2-vod/api/src/routes/upload.ts`
- Modify: `phase2-vod/api/src/index.ts`

**Interfaces:**
- Consumes: `packageHLS` from `hls-packager.ts`
- Produces: `POST /upload` multipart `video` field → `{ videoId, manifestUrl }`

- [ ] **Step 1: Create src/routes/upload.ts**

```ts
import { Router } from 'express'
import multer from 'multer'
import { randomUUID } from 'crypto'
import path from 'path'
import { packageHLS } from '../hls-packager.js'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/tmp/uploads'
const HLS_DIR = process.env.HLS_DIR ?? '/tmp/hls'

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname)}`),
})
const upload = multer({ storage })

const router = Router()

router.post('/', upload.single('video'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No video file provided' })
    return
  }

  const videoId = randomUUID()

  await packageHLS({ inputPath: req.file.path, outputDir: HLS_DIR, videoId })

  res.json({ videoId, manifestUrl: `/hls/${videoId}/master.m3u8` })
})

export { router as uploadRouter }
```

- [ ] **Step 2: Wire into src/index.ts**

```ts
import express from 'express'
import { uploadRouter } from './routes/upload.js'

const app = express()

app.get('/health', (_req, res) => res.json({ ok: true }))
app.use('/upload', uploadRouter)

app.listen(3000, () => console.log('API on :3000'))

export { app }
```

- [ ] **Step 3: Commit**

```bash
git add phase2-vod/api/src/
git commit -m "feat(phase2): add upload API endpoint"
```

---

### Task 4: React HLS Player

**Files:**
- Modify: `phase2-vod/player/index.html`

- [ ] **Step 1: Replace player/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VOD Player</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js"></script>
  <style>
    body { margin: 0; background: #111; color: #eee; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; padding: 2rem; }
    video { width: 100%; max-width: 900px; background: #000; }
    #upload-form { margin-bottom: 1rem; display: flex; gap: 0.5rem; }
    #status { margin-top: 0.5rem; font-size: 0.85rem; color: #aaa; }
    #quality { margin-top: 0.5rem; }
  </style>
</head>
<body>
  <h2>VOD Player</h2>
  <div id="upload-form">
    <input type="file" id="file-input" accept="video/*">
    <button id="upload-btn">Upload & Play</button>
  </div>
  <div id="status">Select a video file to upload.</div>
  <video id="video" controls></video>
  <div id="quality"></div>

  <script>
    const video = document.getElementById('video')
    const status = document.getElementById('status')
    const qualityDiv = document.getElementById('quality')
    let hls

    document.getElementById('upload-btn').addEventListener('click', async () => {
      const file = document.getElementById('file-input').files[0]
      if (!file) { status.textContent = 'No file selected.'; return }

      status.textContent = 'Uploading & transcoding… (this may take a minute)'
      const form = new FormData()
      form.append('video', file)

      const res = await fetch('http://localhost:3000/upload', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) { status.textContent = 'Upload failed: ' + data.error; return }

      status.textContent = 'Ready — manifest: ' + data.manifestUrl
      loadHLS('http://localhost:8080' + data.manifestUrl)
    })

    function loadHLS(url) {
      if (hls) hls.destroy()
      if (Hls.isSupported()) {
        hls = new Hls()
        hls.loadSource(url)
        hls.attachMedia(video)
        hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
          const l = hls.levels[data.level]
          qualityDiv.textContent = `Current quality: ${l.height}p (${Math.round(l.bitrate / 1000)} kbps)`
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url
      }
      video.play()
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Start the stack**

```bash
cd phase2-vod && docker compose up --build
```

- [ ] **Step 3: Smoke test**

1. Open `http://localhost:8080`
2. Select a video file, click "Upload & Play"
3. Verify video plays and quality indicator shows current rendition (e.g., `720p — 2500 kbps`)

- [ ] **Step 4: Commit**

```bash
git add phase2-vod/player/index.html
git commit -m "feat(phase2): add HLS.js player — completes phase 2 demo"
```
