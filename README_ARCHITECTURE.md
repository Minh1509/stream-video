# Kiến Trúc & Luồng Xử Lý Video Streaming HLS AES-128

---

## 1. Sơ Đồ Luồng Hoạt Động (End-to-End Diagram)

```
[1. Upload] ----> [2. Queue] ----> [3. FFmpeg AES-128] ----> [4. Upload S3 & DB]
   Multer           BullMQ             TranscodeService          AwsS3 + TypeORM
                                              |
                                              v
                                      Lưu Key vào DB (Postgres)
---------------------------------------------------------------------------------------
[5. Play Click] --> [6. Stream Token] --> [7. Fetch m3u8] --> [8. Get Key] --> [9. Play]
   React FE          VideosController        hls.js (S3)       VideosService    hls.js (RAM)
```

---

## 2. Chi Tiết Các Bước (Service & Thư Viện Xử Lý)

### 🔹 BACKEND (`stream_video_be`)

* **Bước 1: Upload Video**
  * `VideosController` dùng **`MulterModule` (Thư viện)** nhận file mp4 và lưu tạm vào đĩa.
* **Bước 2: Hàng đợi Transcode**
  * `VideosService` & `TranscodeProcessor` dùng **`BullMQ` + `Redis` (Thư viện)** xử lý ngầm không gây nghẽn Thread NestJS.
* **Bước 3: Transcode & Mã hóa AES-128**
  * `TranscodeService` + `FfmpegService`: **Code tự viết** sinh 16-byte key (`crypto.randomBytes`) và xóa file khóa tạm; **`FFmpeg` (Tool)** chia nhỏ video 360p/720p/1080p và mã hóa tất cả `.ts`.
* **Bước 4: Upload S3 & Lưu DB**
  * `TranscodeProcessor` + `AwsS3Service`: **`@aws-sdk/client-s3` (Thư viện)** upload folder HLS lên S3; **TypeORM (Code tự viết)** lưu Hex Key vào PostgreSQL DB.
* **Bước 6: Cấp Stream Token**
  * `VideosController` dùng **`@nestjs/jwt` (Thư viện + Code tự viết)** cấp JWT Token (hạn 2h) khi FE gửi `POST /videos/:id/stream/token`.
* **Bước 8: Cấp Khóa Giải Mã**
  * `VideosController` & `VideosService`: **Code tự viết** nhận `GET /stream/key?token=xxx`, verify JWT, đọc Key từ DB và trả về 16-byte nhị phân (`application/octet-stream`).

---

### 🔹 FRONTEND (`stream_video_fe`)

* **Bước 5: Người dùng bấm xem Video**
  * `Home.tsx` & `VideoCard.tsx`: **Code tự viết (React)** mở Modal `VideoPlayerModal`.
* **Bước 6: Xin Stream Token**
  * `useHlsPlayer` + `video.api.ts`: **Code tự viết** gọi `POST /stream/token` kèm `AbortController` chống memory leak.
* **Bước 7: Tải Playlist `master.m3u8`**
  * `useHlsPlayer`: **`hls.js` (Thư viện tự động)** nạp `master.m3u8` từ S3 và đọc nhãn `#EXT-X-KEY`.
* **Bước 8: Tự động đính kèm Token xin Key**
  * `useHlsPlayer` (`xhrSetup`): **Code tự viết** tự động nối `?token=xxx` mỗi khi `hls.js` gọi `/stream/key`.
* **Bước 9: Giải mã & Phát Video**
  * `VideoPlayerModal` + `<video>`: **`hls.js` (Thư viện tự động)** tải 16-byte key về RAM, tải các `.ts` từ S3 và giải mã trực tiếp trên RAM để chiếu lên màn hình.

---

## 3. Các Cải Tiến Đề Xuất

1. **Redis Cache Khóa Giải Mã (Thay cho query Postgres ở Bước 8):**
   * Giúp hệ thống phục vụ hàng triệu request lấy key cùng lúc mà không làm treo Database.
2. **S3 Presigned URL (Thay cho public S3 URL ở Bước 9):**
   * Chặn người ngoài tải trực tiếp file `.ts` từ S3 gây tốn chi phí băng thông Cloud.
3. **DRM Widevine/FairPlay (Thay cho HLS AES-128 ở Bước 3 & 9):**
   * Mã hóa ở tầng phần cứng CDM, chống 100% trích xuất Key từ RAM và chống quay màn hình.
