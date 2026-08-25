export type VideoStatus = 'processing' | 'ready' | 'failed'

export interface Video {
  id: string
  title: string
  description: string
  thumbnailUrl: string
  hlsMasterUrl: string
  status: VideoStatus
  duration: number
}

export interface ApiResponse<T> {
  data: T
}
