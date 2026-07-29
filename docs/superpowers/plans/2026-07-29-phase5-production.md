# Phase 5: Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the Phase 2 VOD platform into a production-ready architecture — add MinIO for segment storage, CDN-style caching headers, CMAF/fMP4 packaging, horizontal-scale-ready stateless API, and a real-time monitoring dashboard.

**Architecture:** Stateless API nodes write HLS segments to MinIO (S3-compatible object storage); Nginx acts as origin with proper cache headers; a metrics endpoint exposes stream health data; a dashboard page polls it. All services in Docker Compose with explicit resource limits.

**Tech Stack:** Node.js 20+, TypeScript 5+, Express, FFmpeg 6+, MinIO (latest), Nginx, Prometheus-style metrics via prom-client, React dashboard (CDN), Docker Compose.

## Global Constraints

- Object storage: MinIO, bucket `hls-segments`, public read
- Segment format: CMAF (fMP4, `.m4s` files) for HLS + DASH compatibility
- Cache-Control on `.m3u8`: `no-cache` (live manifests must not be stale)
- Cache-Control on `.m4s`/`.ts`: `max-age=3600` (segments are immutable)
- API nodes are stateless — no local segment files, all reads/writes via MinIO SDK
- Monitoring endpoint: `GET /metrics` (prom-client text format)

---

### Task 1: MinIO Integration

**Files:**
- Create: `phase5-production/docker-compose.yml`
- Create: `phase5-production/api/src/storage.ts`
- Create: `phase5-production/api/package.json`
- Create: `phase5-production/api/tsconfig.json`

**Interfaces:**
- Produces: `uploadSegment(key: string, data: Buffer): Promise<void>`
- Produces: `uploadManifest(key: string, content: string): Promise<void>`
- Produces: `getPublicUrl(key: string): string`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
version: '3.9'
services:
  api:
    build: ./api
    ports:
      - "3000:3000"
    environment:
      - MINIO_ENDPOINT=minio
      - MINIO_PORT=9000
      - MINIO_ACCESS_KEY=minioadmin
      - MINIO_SECRET_KEY=minioadmin
      - MINIO_BUCKET=hls-segments
      - MINIO_PUBLIC_URL=http://localhost:9000/hls-segments
    depends_on:
      - minio

  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

  nginx:
    image: nginx:1.25-alpine
    ports:
      - "8080:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./dashboard:/usr/share/nginx/html:ro

volumes:
  minio_data:
```

- [ ] **Step 2: Create api/package.json**

```json
{
  "name": "phase5-production-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "minio": "^8.0.0",
    "multer": "^1.4.5-lts.1",
    "prom-client": "^15.0.0"
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

- [ ] **Step 3: Create api/tsconfig.json**

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

- [ ] **Step 4: Create api/src/storage.ts**

```ts
import { Client } from 'minio'
import { Readable } from 'stream'

const BUCKET = process.env.MINIO_BUCKET ?? 'hls-segments'
const PUBLIC_URL = process.env.MINIO_PUBLIC_URL ?? 'http://localhost:9000/hls-segments'

export const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
  port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
})

export async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(BUCKET)
  if (!exists) {
    await minioClient.makeBucket(BUCKET)
    // Set public read policy
    await minioClient.setBucketPolicy(BUCKET, JSON.stringify({
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${BUCKET}/*`],
      }],
    }))
  }
}

export async function uploadSegment(key: string, data: Buffer): Promise<void> {
  await minioClient.putObject(BUCKET, key, Readable.from(data), data.length, {
    'Content-Type': 'video/mp2t',
    'Cache-Control': 'max-age=3600',
  })
}

export async function uploadManifest(key: string, content: string): Promise<void> {
  const buf = Buffer.from(content)
  await minioClient.putObject(BUCKET, key, Readable.from(buf), buf.length, {
    'Content-Type': 'application/vnd.apple.mpegurl',
    'Cache-Control': 'no-cache',
  })
}

export function getPublicUrl(key: string): string {
  return `${PUBLIC_URL}/${key}`
}
```

- [ ] **Step 5: Commit**

```bash
git add phase5-production/
git commit -m "feat(phase5): scaffold with MinIO storage integration"
```

---

### Task 2: CMAF HLS Packager

**Files:**
- Create: `phase5-production/api/src/cmaf-packager.ts`

**Interfaces:**
- Consumes: `uploadSegment`, `uploadManifest`, `getPublicUrl` from `storage.ts`
- Produces: `packageCMAF(opts: CMFAPackageOptions): Promise<string>` — returns master manifest public URL
- `CMFAPackageOptions`: `{ inputPath: string, videoId: string }`
- Segments: fMP4 (`.m4s`) with init segment (`.mp4`) per rendition

- [ ] **Step 1: Create src/cmaf-packager.ts**

```ts
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { uploadSegment, uploadManifest, getPublicUrl } from './storage.js'

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
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`))
    })
    proc.on('error', reject)
  })
}

export interface CMAFPackageOptions {
  inputPath: string
  videoId: string
}

export async function packageCMAF(opts: CMAFPackageOptions): Promise<string> {
  const tmpDir = path.join(os.tmpdir(), `cmaf-${opts.videoId}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  for (const r of RENDITIONS) {
    const rendDir = path.join(tmpDir, r.name)
    fs.mkdirSync(rendDir, { recursive: true })

    // fMP4 HLS packaging: init.mp4 + seg%03d.m4s
    await runFFmpeg([
      '-y', '-i', opts.inputPath,
      '-vf', `scale=${r.width}:${r.height}`,
      '-c:v', 'libx264', '-b:v', r.videoBitrate,
      '-c:a', 'aac', '-b:a', r.audioBitrate,
      '-hls_time', '6',
      '-hls_list_size', '0',
      '-hls_segment_type', 'fmp4',
      '-hls_fmp4_init_filename', 'init.mp4',
      '-hls_segment_filename', path.join(rendDir, 'seg%03d.m4s'),
      '-f', 'hls',
      path.join(rendDir, 'index.m3u8'),
    ])

    // Upload init segment and all media segments to MinIO
    const files = fs.readdirSync(rendDir)
    for (const file of files) {
      if (file.endsWith('.m4s') || file.endsWith('.mp4')) {
        const data = fs.readFileSync(path.join(rendDir, file))
        await uploadSegment(`${opts.videoId}/${r.name}/${file}`, data)
      }
    }

    // Rewrite manifest with MinIO public URLs, then upload
    const m3u8 = fs.readFileSync(path.join(rendDir, 'index.m3u8'), 'utf-8')
    const rewritten = m3u8
      .replace(/^(init\.mp4)$/m, getPublicUrl(`${opts.videoId}/${r.name}/init.mp4`))
      .replace(/^(seg\d+\.m4s)$/gm, (_, f) => getPublicUrl(`${opts.videoId}/${r.name}/${f}`))
    await uploadManifest(`${opts.videoId}/${r.name}/index.m3u8`, rewritten)
  }

  // Build and upload master manifest
  const lines = ['#EXTM3U', '']
  for (const r of RENDITIONS) {
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${r.bandwidth},RESOLUTION=${r.width}x${r.height}`)
    lines.push(getPublicUrl(`${opts.videoId}/${r.name}/index.m3u8`))
    lines.push('')
  }
  const masterContent = lines.join('\n')
  const masterKey = `${opts.videoId}/master.m3u8`
  await uploadManifest(masterKey, masterContent)

  // Clean up tmp
  fs.rmSync(tmpDir, { recursive: true, force: true })

  return getPublicUrl(masterKey)
}
```

- [ ] **Step 2: Commit**

```bash
git add phase5-production/api/src/cmaf-packager.ts
git commit -m "feat(phase5): add CMAF/fMP4 HLS packager with MinIO upload"
```

---

### Task 3: Upload API + Monitoring Endpoint

**Files:**
- Create: `phase5-production/api/src/index.ts`

**Interfaces:**
- `POST /upload` → `{ manifestUrl }` (public MinIO URL)
- `GET /metrics` → Prometheus text format

- [ ] **Step 1: Create src/index.ts**

```ts
import express from 'express'
import multer from 'multer'
import { randomUUID } from 'crypto'
import * as promClient from 'prom-client'
import { ensureBucket } from './storage.js'
import { packageCMAF } from './cmaf-packager.js'

const app = express()
const upload = multer({ dest: '/tmp/uploads' })

// Prometheus metrics
const register = new promClient.Registry()
promClient.collectDefaultMetrics({ register })

const uploadCounter = new promClient.Counter({
  name: 'vod_uploads_total',
  help: 'Total video uploads processed',
  registers: [register],
})

const transcodeHistogram = new promClient.Histogram({
  name: 'vod_transcode_duration_seconds',
  help: 'Time to transcode and package a video',
  buckets: [30, 60, 120, 300, 600],
  registers: [register],
})

app.get('/health', (_req, res) => res.json({ ok: true }))

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType)
  res.end(await register.metrics())
})

app.post('/upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No video file provided' })
    return
  }

  const videoId = randomUUID()
  const end = transcodeHistogram.startTimer()

  const manifestUrl = await packageCMAF({ inputPath: req.file.path, videoId })

  end()
  uploadCounter.inc()

  res.json({ videoId, manifestUrl })
})

await ensureBucket()
app.listen(3000, () => console.log('API listening on :3000'))
```

- [ ] **Step 2: Create api/Dockerfile**

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

- [ ] **Step 3: Commit**

```bash
git add phase5-production/api/src/index.ts phase5-production/api/Dockerfile
git commit -m "feat(phase5): add upload API and Prometheus metrics endpoint"
```

---

### Task 4: Monitoring Dashboard

**Files:**
- Create: `phase5-production/dashboard/index.html`
- Create: `phase5-production/nginx/nginx.conf`

**Interfaces:**
- Consumes: `GET http://localhost:3000/metrics` (Prometheus text)
- Produces: browser dashboard polling metrics every 5 seconds

- [ ] **Step 1: Create nginx/nginx.conf**

```nginx
server {
    listen 80;

    location / {
        root /usr/share/nginx/html;
        index index.html;
    }
}
```

- [ ] **Step 2: Create dashboard/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Stream Monitor</title>
  <style>
    body { margin: 0; background: #0d1117; color: #e6edf3; font-family: monospace; padding: 2rem; }
    h2 { color: #58a6ff; }
    .cards { display: flex; gap: 1.5rem; flex-wrap: wrap; margin: 1.5rem 0; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1.5rem 2rem; min-width: 180px; }
    .card .label { font-size: 0.75rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.05em; }
    .card .value { font-size: 2rem; font-weight: bold; color: #58a6ff; margin-top: 0.25rem; }
    #raw { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem; font-size: 0.8rem; max-height: 300px; overflow-y: auto; white-space: pre; color: #8b949e; }
    #updated { font-size: 0.75rem; color: #8b949e; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <h2>Stream Monitor</h2>
  <div class="cards">
    <div class="card"><div class="label">Total Uploads</div><div class="value" id="uploads">—</div></div>
    <div class="card"><div class="label">Avg Transcode (s)</div><div class="value" id="transcode-avg">—</div></div>
    <div class="card"><div class="label">Node.js Heap (MB)</div><div class="value" id="heap">—</div></div>
    <div class="card"><div class="label">Process Uptime (s)</div><div class="value" id="uptime">—</div></div>
  </div>
  <div id="updated"></div>
  <h3 style="color:#8b949e;font-size:0.85rem;margin-top:1.5rem;">Raw Metrics</h3>
  <div id="raw">Fetching…</div>

  <script>
    function parsePrometheus(text) {
      const result = {}
      for (const line of text.split('\n')) {
        if (line.startsWith('#') || !line.trim()) continue
        const match = line.match(/^(\w+)(?:\{[^}]*\})?\s+([\d.e+\-NaInf]+)/)
        if (match) result[match[1]] = parseFloat(match[2])
      }
      return result
    }

    async function refresh() {
      const res = await fetch('http://localhost:3000/metrics').catch(() => null)
      if (!res) { document.getElementById('raw').textContent = 'Cannot reach API on :3000'; return }
      const text = await res.text()
      const m = parsePrometheus(text)

      document.getElementById('uploads').textContent = m['vod_uploads_total'] ?? '0'
      const sum = m['vod_transcode_duration_seconds_sum']
      const count = m['vod_transcode_duration_seconds_count']
      document.getElementById('transcode-avg').textContent =
        count > 0 ? (sum / count).toFixed(1) : '—'
      document.getElementById('heap').textContent =
        m['nodejs_heap_size_used_bytes'] ? (m['nodejs_heap_size_used_bytes'] / 1e6).toFixed(1) : '—'
      document.getElementById('uptime').textContent =
        m['process_uptime_seconds'] ? Math.round(m['process_uptime_seconds']) : '—'

      document.getElementById('raw').textContent = text
      document.getElementById('updated').textContent = `Last updated: ${new Date().toLocaleTimeString()}`
    }

    refresh()
    setInterval(refresh, 5000)
  </script>
</body>
</html>
```

- [ ] **Step 3: Start the full stack**

```bash
cd phase5-production && docker compose up --build
```

- [ ] **Step 4: End-to-end smoke test**

1. Open `http://localhost:8080` — verify monitoring dashboard loads
2. Upload a video: `curl -F "video=@tests/fixtures/sample.mp4" http://localhost:3000/upload`
3. Copy the `manifestUrl` from the response and open it in VLC or paste into an HLS player to verify CMAF segments play
4. Refresh dashboard — verify upload counter incremented and transcode time shows

- [ ] **Step 5: Commit**

```bash
git add phase5-production/dashboard/ phase5-production/nginx/
git commit -m "feat(phase5): add monitoring dashboard — completes phase 5"
```
