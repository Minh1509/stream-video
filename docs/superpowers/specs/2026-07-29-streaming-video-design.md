# Lộ trình học Streaming Video

**Ngày:** 2026-07-29  
**Mục tiêu:** Học streaming video toàn diện — nắm vững protocol và build sản phẩm thực tế  
**Trình độ:** Experienced developer  
**Stack:** Node.js / TypeScript, FFmpeg, Nginx, React  

---

## Tổng quan

Lộ trình Protocol-first: học từ protocol lên, implement từng layer, mỗi giai đoạn kết thúc bằng working demo.

```
[1] Foundations     → Media fundamentals + FFmpeg
[2] VOD Pipeline    → File upload → transcode → HLS → serve
[3] Live Streaming  → RTMP ingest → transcode → HLS live
[4] WebRTC          → Real-time, peer-to-peer / SFU
[5] Production      → Scalability, CDN, adaptive bitrate, monitoring
```

**Thời gian ước tính:** 12–16 tuần (part-time ~10h/tuần)

---

## Stack xuyên suốt

| Layer | Tool |
|---|---|
| Encode/decode | FFmpeg |
| Ingest/API server | Node.js + TypeScript |
| HTTP delivery | Nginx |
| Player | React + HLS.js hoặc Video.js |
| Môi trường | Docker |

---

## Giai đoạn 1 — Foundations (2 tuần)

**Mục tiêu:** Hiểu video ở mức bit, không dùng abstraction.

### Nội dung
- Codec fundamentals: H.264, H.265, VP9 — keyframes, B/P frames, GOP size
- Container formats: MP4, MKV, TS — phân biệt codec vs container
- FFmpeg từ dòng lệnh: probe, transcode, clip, filter graph
- TypeScript wrapper gọi FFmpeg child process, parse stderr output

### Demo cuối giai đoạn
CLI tool: nhận video input → output nhiều resolution (1080p / 720p / 480p)

---

## Giai đoạn 2 — VOD Pipeline (3 tuần)

**Mục tiêu:** Hiểu HLS/DASH từ spec đến implementation.

### Nội dung
- HLS spec (RFC 8216): master manifest, media manifest (.m3u8), segments (.ts), EXT-X tags
- DASH: MPD structure, segment template, so sánh với HLS
- Build pipeline: upload → FFmpeg transcode → tạo HLS segments → serve qua HTTP
- Node.js HLS packaging server (tự viết, không dùng cloud service)
- React player dùng HLS.js, handle adaptive bitrate switching

### Demo cuối giai đoạn
Mini VOD platform: upload video, xem được trên browser với adaptive bitrate (ABR)

---

## Giai đoạn 3 — Live Streaming (3 tuần)

**Mục tiêu:** Hiểu RTMP protocol và live HLS pipeline.

### Nội dung
- RTMP protocol: handshake (C0/C1/C2/S0/S1/S2), message format, chunk stream
- Nginx-RTMP module hoặc Node Media Server làm ingest point
- Live transcoding: RTMP → FFmpeg → HLS segments liên tục
- Latency trade-offs: segment duration vs end-to-end latency
- Low-Latency HLS (LL-HLS): partial segments, preload hints

### Demo cuối giai đoạn
Stream từ OBS → ingest server → transcode → xem live trên browser

---

## Giai đoạn 4 — WebRTC (3 tuần)

**Mục tiêu:** Real-time streaming dưới 1 giây.

### Nội dung
- WebRTC stack: ICE framework, STUN/TURN servers, DTLS handshake, SRTP media
- Signaling server: Node.js + WebSocket, SDP offer/answer flow
- Topology: P2P vs MCU vs SFU — trade-offs về latency, scale, server load
- SFU implementation dùng mediasoup (Node.js native)
- Khi nào dùng WebRTC vs HLS — latency vs scale trade-off

### Demo cuối giai đoạn
Video broadcast real-time: một publisher → nhiều viewers qua SFU

---

## Giai đoạn 5 — Production Hardening (2–4 tuần)

**Mục tiêu:** Từ demo lên production-ready architecture.

### Nội dung
- CDN integration: origin pull model, edge caching strategy cho HLS segments
- Adaptive bitrate algorithms: throughput-based, BOLA (buffer-based)
- Packaging optimization: CMAF với fMP4 segments thay TS (tương thích HLS + DASH)
- Monitoring: stream health metrics, viewer QoE, error tracking
- Horizontal scaling: stateless ingest servers, shared segment storage (MinIO/S3)

### Demo cuối giai đoạn
Platform chạy được với multiple concurrent viewers, có monitoring dashboard

---

## Kiến trúc tổng thể (production target)

```
OBS / Browser
     │ RTMP / WebRTC
     ▼
Ingest Server (Node.js)
     │
     ▼
Transcoder (FFmpeg workers)
     │ HLS segments / WebRTC media
     ▼
Storage (MinIO / S3)    ←──── CDN Edge ────→ Viewers
     │
     ▼
API Server (Node.js)
     │
     ▼
React Player (HLS.js / mediasoup-client)
```

---

## Tài nguyên tham khảo

- [HLS spec - RFC 8216](https://datatracker.ietf.org/doc/html/rfc8216)
- [DASH spec - ISO/IEC 23009](https://www.iso.org/standard/83314.html)
- [WebRTC spec - W3C](https://www.w3.org/TR/webrtc/)
- FFmpeg docs: https://ffmpeg.org/documentation.html
- mediasoup docs: https://mediasoup.org/documentation/
- HLS.js: https://github.com/video-dev/hls.js
