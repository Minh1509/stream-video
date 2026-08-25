import type { ApiResponse, Video } from '../types/video.type'
import { httpGet, httpPostForm } from '../utils/http'

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
