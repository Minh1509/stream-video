# Phase 4: WebRTC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time video broadcast system — one publisher streams from browser, multiple viewers watch with sub-second latency via an SFU architecture.

**Architecture:** Node.js signaling server coordinates WebRTC negotiation over WebSocket; mediasoup acts as SFU (receives publisher's track, forwards to all viewers without decode/re-encode); React-based browser pages for publisher and viewer.

**Tech Stack:** Node.js 20+, TypeScript 5+, mediasoup 3.x, ws (WebSocket), Express, React 18 (CDN), Docker Compose.

## Global Constraints

- SFU: mediasoup 3.x (Node.js native, no separate process)
- Signaling: WebSocket on port 3000
- No P2P — all media flows through the SFU
- STUN server: stun:stun.l.google.com:19302 (no TURN needed for localhost)
- Docker Compose must start the full stack with `docker compose up`

---

### Task 1: Project Scaffold

**Files:**
- Create: `phase4-webrtc/docker-compose.yml`
- Create: `phase4-webrtc/server/package.json`
- Create: `phase4-webrtc/server/tsconfig.json`
- Create: `phase4-webrtc/server/src/index.ts`
- Create: `phase4-webrtc/client/publisher.html`
- Create: `phase4-webrtc/client/viewer.html`

**Interfaces:**
- Produces: `docker compose up` starts server on port 3000, static files on port 8080

- [ ] **Step 1: Create docker-compose.yml**

```yaml
version: '3.9'
services:
  server:
    build: ./server
    ports:
      - "3000:3000"
      - "40000-40100:40000-40100/udp"   # mediasoup RTP port range
    environment:
      - ANNOUNCED_IP=127.0.0.1

  nginx:
    image: nginx:1.25-alpine
    ports:
      - "8080:80"
    volumes:
      - ./client:/usr/share/nginx/html:ro
```

- [ ] **Step 2: Create server/package.json**

```json
{
  "name": "phase4-webrtc-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "mediasoup": "^3.14.0",
    "ws": "^8.16.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "@types/ws": "^8.5.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 3: Create server/tsconfig.json**

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

- [ ] **Step 4: Create server/Dockerfile**

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache python3 make g++ linux-headers
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
```

- [ ] **Step 5: Commit**

```bash
git add phase4-webrtc/
git commit -m "feat(phase4): scaffold WebRTC project"
```

---

### Task 2: mediasoup Worker + Router

**Files:**
- Create: `phase4-webrtc/server/src/media-server.ts`

**Interfaces:**
- Produces: `createMediaServer(): Promise<MediaServer>`
- `MediaServer`: `{ router: Router, createWebRtcTransport(): Promise<WebRtcTransport> }`

- [ ] **Step 1: Create src/media-server.ts**

```ts
import * as mediasoup from 'mediasoup'
import type { Router, Worker, WebRtcTransport } from 'mediasoup/node/lib/types.js'

const RTP_CAPABILITIES = {
  codecs: [
    {
      kind: 'video' as const,
      mimeType: 'video/VP8',
      clockRate: 90000,
      parameters: {},
    },
    {
      kind: 'audio' as const,
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 2,
    },
  ],
}

const TRANSPORT_OPTIONS = {
  listenInfos: [
    {
      protocol: 'udp' as const,
      ip: '0.0.0.0',
      announcedAddress: process.env.ANNOUNCED_IP ?? '127.0.0.1',
      portRange: { min: 40000, max: 40100 },
    },
  ],
}

export interface MediaServer {
  router: Router
  createWebRtcTransport(): Promise<WebRtcTransport>
}

export async function createMediaServer(): Promise<MediaServer> {
  const worker: Worker = await mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: 40000,
    rtcMaxPort: 40100,
  })

  worker.on('died', () => {
    console.error('mediasoup worker died — exiting')
    process.exit(1)
  })

  const router: Router = await worker.createRouter({ mediaCodecs: RTP_CAPABILITIES.codecs })

  return {
    router,
    createWebRtcTransport: () => router.createWebRtcTransport(TRANSPORT_OPTIONS),
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add phase4-webrtc/server/src/media-server.ts
git commit -m "feat(phase4): add mediasoup worker and router"
```

---

### Task 3: Signaling Server

**Files:**
- Create: `phase4-webrtc/server/src/signaling.ts`
- Modify: `phase4-webrtc/server/src/index.ts`

**Interfaces:**
- Consumes: `MediaServer` from `media-server.ts`
- Signaling messages (client → server): `getRouterRtpCapabilities`, `createTransport`, `connectTransport`, `produce`, `consume`
- Signaling messages (server → client): responses to above + `newProducer` broadcast

- [ ] **Step 1: Create src/signaling.ts**

```ts
import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import type { MediaServer } from './media-server.js'
import type { Producer, Consumer } from 'mediasoup/node/lib/types.js'

interface Client {
  ws: WebSocket
  producerTransport?: any
  consumerTransport?: any
  producer?: Producer
  consumers: Map<string, Consumer>
}

export function attachSignaling(wss: WebSocketServer, media: MediaServer) {
  const clients = new Map<string, Client>()
  let broadcastProducer: Producer | null = null

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    const id = Math.random().toString(36).slice(2)
    const client: Client = { ws, consumers: new Map() }
    clients.set(id, client)

    ws.on('close', () => {
      client.producer?.close()
      client.producerTransport?.close()
      client.consumerTransport?.close()
      clients.delete(id)
    })

    ws.on('message', async (raw: Buffer) => {
      const { type, data, requestId } = JSON.parse(raw.toString())

      const reply = (result: unknown) =>
        ws.send(JSON.stringify({ requestId, result }))

      const replyError = (message: string) =>
        ws.send(JSON.stringify({ requestId, error: message }))

      try {
        switch (type) {
          case 'getRouterRtpCapabilities':
            reply(media.router.rtpCapabilities)
            break

          case 'createTransport': {
            const transport = await media.createWebRtcTransport()
            if (data.role === 'producer') {
              client.producerTransport = transport
            } else {
              client.consumerTransport = transport
            }
            reply({
              id: transport.id,
              iceParameters: transport.iceParameters,
              iceCandidates: transport.iceCandidates,
              dtlsParameters: transport.dtlsParameters,
            })
            break
          }

          case 'connectTransport': {
            const transport = data.role === 'producer'
              ? client.producerTransport
              : client.consumerTransport
            await transport.connect({ dtlsParameters: data.dtlsParameters })
            reply({})
            break
          }

          case 'produce': {
            const producer = await client.producerTransport.produce({
              kind: data.kind,
              rtpParameters: data.rtpParameters,
            })
            client.producer = producer
            broadcastProducer = producer
            reply({ id: producer.id })

            // Notify all existing viewers
            for (const [otherId, other] of clients) {
              if (otherId !== id && other.ws.readyState === WebSocket.OPEN) {
                other.ws.send(JSON.stringify({ type: 'newProducer', producerId: producer.id }))
              }
            }
            break
          }

          case 'consume': {
            if (!broadcastProducer) { replyError('No active stream'); break }
            if (!media.router.canConsume({ producerId: broadcastProducer.id, rtpCapabilities: data.rtpCapabilities })) {
              replyError('Cannot consume'); break
            }
            const consumer = await client.consumerTransport.consume({
              producerId: broadcastProducer.id,
              rtpCapabilities: data.rtpCapabilities,
              paused: true,
            })
            client.consumers.set(consumer.id, consumer)
            reply({
              id: consumer.id,
              producerId: broadcastProducer.id,
              kind: consumer.kind,
              rtpParameters: consumer.rtpParameters,
            })
            break
          }

          case 'resumeConsumer': {
            const consumer = client.consumers.get(data.consumerId)
            await consumer?.resume()
            reply({})
            break
          }
        }
      } catch (err: any) {
        replyError(err.message)
      }
    })

    // If a stream is already live, tell the new viewer
    if (broadcastProducer) {
      ws.send(JSON.stringify({ type: 'newProducer', producerId: broadcastProducer.id }))
    }
  })
}
```

- [ ] **Step 2: Wire into src/index.ts**

```ts
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { createMediaServer } from './media-server.js'
import { attachSignaling } from './signaling.js'

const httpServer = createServer((_req, res) => {
  res.writeHead(200)
  res.end('WebRTC signaling server')
})

const wss = new WebSocketServer({ server: httpServer })
const media = await createMediaServer()
attachSignaling(wss, media)

httpServer.listen(3000, () => console.log('Signaling server on :3000'))
```

- [ ] **Step 3: Commit**

```bash
git add phase4-webrtc/server/src/
git commit -m "feat(phase4): add WebSocket signaling server"
```

---

### Task 4: Publisher + Viewer Browser Pages

**Files:**
- Create: `phase4-webrtc/client/publisher.html`
- Create: `phase4-webrtc/client/viewer.html`

**Interfaces:**
- Publisher: gets webcam, sends to SFU via WebRTC
- Viewer: receives stream from SFU, plays in video element

- [ ] **Step 1: Create client/publisher.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Publisher</title>
  <script src="https://cdn.jsdelivr.net/npm/mediasoup-client@3/dist/mediasoup-client.min.js"></script>
  <style>
    body { background: #111; color: #eee; font-family: sans-serif; padding: 2rem; }
    video { width: 480px; background: #000; display: block; margin: 1rem 0; }
    button { padding: 0.5rem 1.5rem; margin-right: 0.5rem; cursor: pointer; }
    #status { color: #aaa; font-size: 0.85rem; }
  </style>
</head>
<body>
  <h2>Publisher</h2>
  <video id="preview" autoplay muted playsinline></video>
  <button id="start-btn">Start Camera</button>
  <button id="publish-btn" disabled>Publish</button>
  <div id="status">Click "Start Camera" first.</div>

  <script>
    const WS_URL = 'ws://localhost:3000'
    const status = document.getElementById('status')
    let device, sendTransport, ws, stream

    function request(type, data = {}) {
      return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).slice(2)
        ws.send(JSON.stringify({ type, data, requestId }))
        const handler = (event) => {
          const msg = JSON.parse(event.data)
          if (msg.requestId === requestId) {
            ws.removeEventListener('message', handler)
            msg.error ? reject(new Error(msg.error)) : resolve(msg.result)
          }
        }
        ws.addEventListener('message', handler)
      })
    }

    document.getElementById('start-btn').addEventListener('click', async () => {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      document.getElementById('preview').srcObject = stream
      document.getElementById('publish-btn').disabled = false
      status.textContent = 'Camera ready. Click Publish.'
    })

    document.getElementById('publish-btn').addEventListener('click', async () => {
      ws = new WebSocket(WS_URL)
      await new Promise(r => ws.addEventListener('open', r))

      device = new mediasoupClient.Device()
      const caps = await request('getRouterRtpCapabilities')
      await device.load({ routerRtpCapabilities: caps })

      const params = await request('createTransport', { role: 'producer' })
      sendTransport = device.createSendTransport(params)

      sendTransport.on('connect', ({ dtlsParameters }, cb, eb) =>
        request('connectTransport', { role: 'producer', dtlsParameters }).then(cb).catch(eb))

      sendTransport.on('produce', ({ kind, rtpParameters }, cb, eb) =>
        request('produce', { kind, rtpParameters }).then(({ id }) => cb({ id })).catch(eb))

      for (const track of stream.getTracks()) {
        await sendTransport.produce({ track })
      }

      status.textContent = 'Publishing live!'
    })
  </script>
</body>
</html>
```

- [ ] **Step 2: Create client/viewer.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Viewer</title>
  <script src="https://cdn.jsdelivr.net/npm/mediasoup-client@3/dist/mediasoup-client.min.js"></script>
  <style>
    body { background: #111; color: #eee; font-family: sans-serif; padding: 2rem; }
    video { width: 720px; background: #000; display: block; margin: 1rem 0; }
    button { padding: 0.5rem 1.5rem; cursor: pointer; }
    #status { color: #aaa; font-size: 0.85rem; }
  </style>
</head>
<body>
  <h2>Viewer</h2>
  <button id="watch-btn">Watch</button>
  <video id="video" autoplay playsinline></video>
  <div id="status">Click Watch to connect.</div>

  <script>
    const WS_URL = 'ws://localhost:3000'
    const status = document.getElementById('status')
    const video = document.getElementById('video')
    let device, recvTransport, ws

    function request(type, data = {}) {
      return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).slice(2)
        ws.send(JSON.stringify({ type, data, requestId }))
        const handler = (event) => {
          const msg = JSON.parse(event.data)
          if (msg.requestId === requestId) {
            ws.removeEventListener('message', handler)
            msg.error ? reject(new Error(msg.error)) : resolve(msg.result)
          }
        }
        ws.addEventListener('message', handler)
      })
    }

    async function consume(producerId) {
      const params = await request('createTransport', { role: 'consumer' })
      recvTransport = device.createRecvTransport(params)

      recvTransport.on('connect', ({ dtlsParameters }, cb, eb) =>
        request('connectTransport', { role: 'consumer', dtlsParameters }).then(cb).catch(eb))

      const consumerParams = await request('consume', { rtpCapabilities: device.rtpCapabilities })
      const consumer = await recvTransport.consume(consumerParams)

      const mediaStream = new MediaStream([consumer.track])
      video.srcObject = mediaStream

      await request('resumeConsumer', { consumerId: consumer.id })
      status.textContent = 'Watching live!'
    }

    document.getElementById('watch-btn').addEventListener('click', async () => {
      ws = new WebSocket(WS_URL)
      await new Promise(r => ws.addEventListener('open', r))

      device = new mediasoupClient.Device()
      const caps = await request('getRouterRtpCapabilities')
      await device.load({ routerRtpCapabilities: caps })

      ws.addEventListener('message', (event) => {
        const msg = JSON.parse(event.data)
        if (msg.type === 'newProducer') consume(msg.producerId)
      })

      status.textContent = 'Connected — waiting for publisher…'
    })
  </script>
</body>
</html>
```

- [ ] **Step 3: Start stack**

```bash
cd phase4-webrtc && docker compose up --build
```

- [ ] **Step 4: End-to-end smoke test**

1. Open `http://localhost:8080/publisher.html` — click Start Camera, then Publish
2. Open `http://localhost:8080/viewer.html` in another tab — click Watch
3. Verify viewer sees publisher's webcam with sub-second latency

- [ ] **Step 5: Commit**

```bash
git add phase4-webrtc/client/
git commit -m "feat(phase4): add publisher and viewer pages — completes phase 4 demo"
```
