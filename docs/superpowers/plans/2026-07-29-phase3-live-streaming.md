# Phase 3: Live Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a live streaming server — accept RTMP from OBS, transcode in real-time via FFmpeg, package into live HLS, and serve the stream to browser viewers.

**Architecture:** Node Media Server handles RTMP ingest; on stream start it spawns FFmpeg to transcode to HLS live segments; Nginx serves segments with correct headers; browser player polls the manifest.

**Tech Stack:** Node.js 20+, TypeScript 5+, node-media-server 2.x, FFmpeg 6+, Nginx, HLS.js 1.x, Docker Compose.

## Global Constraints

- RTMP ingest port: 1935
- HLS segment duration: 2 seconds
- Live HLS playlist: 3-segment rolling window (`hls_list_size=3`)
- Segment format: MPEG-TS (.ts)
- HLS served on port 8080 via Nginx, server API on port 3000
- OBS stream key: `live` (stream to `rtmp://localhost:1935/live/live`)

---

### Task 1: Project Scaffold

**Files:**
- Create: `phase3-live/docker-compose.yml`
- Create: `phase3-live/server/package.json`
- Create: `phase3-live/server/tsconfig.json`
- Create: `phase3-live/server/Dockerfile`
- Create: `phase3-live/nginx/nginx.conf`
- Create: `phase3-live/player/index.html`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
version: '3.9'
services:
  server:
    build: ./server
    ports:
      - "1935:1935"
      - "3000:3000"
    volumes:
      - hls_data:/data/hls
    environment:
      - HLS_DIR=/data/hls

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

- [ ] **Step 3: Create server/package.json**

```json
{
  "name": "phase3-live-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "node-media-server": "^2.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 4: Create server/tsconfig.json**

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

- [ ] **Step 5: Create server/Dockerfile**

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

- [ ] **Step 6: Commit**

```bash
git add phase3-live/
git commit -m "feat(phase3): scaffold live streaming project"
```

---

### Task 2: RTMP Ingest + Live Transcoder

**Files:**
- Create: `phase3-live/server/src/transcoder.ts`
- Create: `phase3-live/server/src/rtmp-server.ts`
- Create: `phase3-live/server/src/index.ts`

**Interfaces:**
- Produces: `startLiveTranscode(opts: LiveTranscodeOptions): ChildProcess`
- `LiveTranscodeOptions`: `{ streamKey: string, rtmpUrl: string, hlsDir: string }`
- Produces: `createRtmpServer(hlsDir: string): NodeMediaServer`

- [ ] **Step 1: Create src/transcoder.ts**

```ts
import { spawn, ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'

export interface LiveTranscodeOptions {
  streamKey: string
  rtmpUrl: string
  hlsDir: string
}

export function buildFFmpegArgs(opts: LiveTranscodeOptions): string[] {
  const outDir = path.join(opts.hlsDir, opts.streamKey)
  return [
    '-i', opts.rtmpUrl,
    '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency',
    '-b:v', '2500k',
    '-c:a', 'aac', '-b:a', '128k',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '3',
    '-hls_flags', 'delete_segments+append_list',
    '-hls_segment_filename', path.join(outDir, 'seg%03d.ts'),
    path.join(outDir, 'index.m3u8'),
  ]
}

export function startLiveTranscode(opts: LiveTranscodeOptions): ChildProcess {
  const outDir = path.join(opts.hlsDir, opts.streamKey)
  fs.mkdirSync(outDir, { recursive: true })

  const proc = spawn('ffmpeg', ['-y', ...buildFFmpegArgs(opts)], { stdio: 'pipe' })

  proc.stderr?.on('data', (c: Buffer) => {
    process.stdout.write(`[ffmpeg:${opts.streamKey}] ${c.toString()}`)
  })

  proc.on('close', (code) => {
    console.log(`[ffmpeg:${opts.streamKey}] exited ${code}`)
  })

  return proc
}
```

- [ ] **Step 2: Create src/rtmp-server.ts**

```ts
import NodeMediaServer from 'node-media-server'
import { startLiveTranscode } from './transcoder.js'
import { ChildProcess } from 'child_process'

export function createRtmpServer(hlsDir: string): NodeMediaServer {
  const nms = new NodeMediaServer({
    rtmp: { port: 1935, chunk_size: 60000, gop_cache: true, ping: 30, ping_timeout: 60 },
    http: { port: 8000, mediaroot: hlsDir, allow_origin: '*' },
  })

  const activeStreams = new Map<string, ChildProcess>()

  nms.on('prePublish', (_id: string, streamPath: string) => {
    const streamKey = streamPath.split('/').pop() ?? 'unknown'
    const rtmpUrl = `rtmp://127.0.0.1:1935${streamPath}`

    console.log(`[RTMP] Stream started: ${streamKey}`)
    const proc = startLiveTranscode({ streamKey, rtmpUrl, hlsDir })
    activeStreams.set(streamKey, proc)
  })

  nms.on('donePublish', (_id: string, streamPath: string) => {
    const streamKey = streamPath.split('/').pop() ?? 'unknown'
    console.log(`[RTMP] Stream ended: ${streamKey}`)
    activeStreams.get(streamKey)?.kill('SIGTERM')
    activeStreams.delete(streamKey)
  })

  return nms
}
```

- [ ] **Step 3: Create src/index.ts**

```ts
import { createRtmpServer } from './rtmp-server.js'

const HLS_DIR = process.env.HLS_DIR ?? '/tmp/hls'
const nms = createRtmpServer(HLS_DIR)
nms.run()

console.log('RTMP server listening on :1935')
```

- [ ] **Step 4: Commit**

```bash
git add phase3-live/server/src/
git commit -m "feat(phase3): add RTMP ingest and live transcoder"
```

---

### Task 3: Live Player Page

**Files:**
- Create: `phase3-live/player/index.html`

- [ ] **Step 1: Create player/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Live Stream</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js"></script>
  <style>
    body { margin: 0; background: #111; color: #eee; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; padding: 2rem; }
    video { width: 100%; max-width: 900px; background: #000; }
    #controls { margin-bottom: 1rem; display: flex; gap: 0.5rem; align-items: center; }
    #status { font-size: 0.85rem; color: #aaa; margin-top: 0.5rem; }
    input[type=text] { padding: 0.4rem; width: 300px; background: #222; color: #eee; border: 1px solid #444; }
    button { padding: 0.4rem 1rem; cursor: pointer; }
  </style>
</head>
<body>
  <h2>Live Stream Viewer</h2>
  <div id="controls">
    <input type="text" id="stream-key" placeholder="Stream key" value="live">
    <button id="watch-btn">Watch</button>
  </div>
  <div id="status">Enter a stream key and click Watch.</div>
  <video id="video" controls autoplay muted></video>

  <script>
    const video = document.getElementById('video')
    const status = document.getElementById('status')
    let hls

    document.getElementById('watch-btn').addEventListener('click', () => {
      const key = document.getElementById('stream-key').value.trim()
      if (!key) { status.textContent = 'Enter a stream key.'; return }

      const url = `http://localhost:8080/hls/${key}/index.m3u8`
      status.textContent = `Connecting to ${url}…`
      loadHLS(url)
    })

    function loadHLS(url) {
      if (hls) hls.destroy()

      if (!Hls.isSupported()) {
        video.src = url
        status.textContent = 'Using native HLS'
        return
      }

      hls = new Hls({ liveSyncDurationCount: 3, liveMaxLatencyDurationCount: 5 })
      hls.loadSource(url)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        status.textContent = 'Live — playing'
        video.play()
      })

      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) status.textContent = `Fatal error: ${data.type}`
      })
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Start stack**

```bash
cd phase3-live && docker compose up --build
```

- [ ] **Step 3: Configure OBS and smoke test**

In OBS → Settings → Stream:
- Service: Custom
- Server: `rtmp://localhost:1935/live`
- Stream Key: `live`

Start streaming in OBS, open `http://localhost:8080`, enter key `live`, click Watch. Verify live video appears within ~6 seconds.

- [ ] **Step 4: Commit**

```bash
git add phase3-live/player/index.html
git commit -m "feat(phase3): add live player — completes phase 3 demo"
```
