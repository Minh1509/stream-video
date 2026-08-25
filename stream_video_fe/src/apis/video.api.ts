import type { ApiResponse, Video } from '../types/video.type'
import { httpGet, httpPost, httpPostForm } from '../utils/http'

export function getVideos(signal?: AbortSignal): Promise<ApiResponse<Video[]>> {
  return httpGet<ApiResponse<Video[]>>('/videos', signal)
}

export function getVideoById(id: string, signal?: AbortSignal): Promise<ApiResponse<Video>> {
  return httpGet<ApiResponse<Video>>(`/videos/${id}`, signal)
}

export function uploadVideo(
  input: { title: string; description?: string; file: File },
  signal?: AbortSignal
): Promise<ApiResponse<Video>> {
  const form = new FormData()
  form.append('title', input.title)
  if (input.description) form.append('description', input.description)
  form.append('file', input.file)
  return httpPostForm<ApiResponse<Video>>('/videos', form, signal)
}

export function issueStreamToken(
  videoId: string,
  signal?: AbortSignal
): Promise<{ token: string }> {
  const accessKey = import.meta.env.VITE_STREAM_ACCESS_KEY as string
  return httpPost<{ token: string }>(
    `/videos/${videoId}/stream/token`,
    { accessKey },
    signal
  )
}
