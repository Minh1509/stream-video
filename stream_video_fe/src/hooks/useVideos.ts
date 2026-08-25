import { useCallback, useEffect, useMemo, useState } from 'react'
import { getVideos } from '../apis/video.api'
import type { Video } from '../types/video.type'

type FetchStatus = 'loading' | 'success' | 'error'

export interface VideosState {
  videos: Video[]
  filtered: Video[]
  status: FetchStatus
  search: string
  selected: Video | null
  setSearch: (value: string) => void
  setSelected: (video: Video | null) => void
  retry: () => void
}

export function useVideos(): VideosState {
  const [videos, setVideos] = useState<Video[]>([])
  const [status, setStatus] = useState<FetchStatus>('loading')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Video | null>(null)

  const fetchVideos = useCallback((signal?: AbortSignal) => {
    setStatus('loading')
    getVideos(signal)
      .then((res) => {
        setVideos(res.data)
        setStatus('success')
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        setStatus('error')
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchVideos(controller.signal)
    return () => controller.abort()
  }, [fetchVideos])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return videos
    return videos.filter(
      (v) =>
        v.title.toLowerCase().includes(keyword) ||
        v.description.toLowerCase().includes(keyword),
    )
  }, [videos, search])

  return {
    videos,
    filtered,
    status,
    search,
    selected,
    setSearch,
    setSelected,
    retry: () => fetchVideos(),
  }
}
