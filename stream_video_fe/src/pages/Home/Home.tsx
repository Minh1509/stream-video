import { useCallback, useEffect, useMemo, useState } from 'react'
import { getVideos } from '../../apis/video.api'
import EmptyState from '../../components/EmptyState'
import ErrorState from '../../components/ErrorState'
import Loading from '../../components/Loading'
import UploadWidget from '../../components/UploadWidget'
import VideoGrid from '../../components/VideoGrid'
import VideoPlayerModal from '../../components/VideoPlayerModal'
import MainLayout from '../../layouts/MainLayout'
import type { Video } from '../../types/video.type'

type Status = 'loading' | 'success' | 'error'

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([])
  const [status, setStatus] = useState<Status>('loading')
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
        v.description.toLowerCase().includes(keyword)
    )
  }, [videos, search])

  return (
    <MainLayout searchValue={search} onSearchChange={setSearch}>
      <section className='mb-8'>
        <h1 className='text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl'>
          Khám phá video
        </h1>
        <p className='mt-1 text-slate-500'>Chọn một video bất kỳ để bắt đầu xem.</p>
      </section>

      {status === 'loading' && <Loading />}

      {status === 'error' && <ErrorState onRetry={() => fetchVideos()} />}

      {status === 'success' && filtered.length === 0 && <EmptyState />}

      {status === 'success' && filtered.length > 0 && (
        <VideoGrid videos={filtered} onSelect={setSelected} />
      )}

      <VideoPlayerModal video={selected} onClose={() => setSelected(null)} />

      <UploadWidget onUploaded={() => fetchVideos()} />
    </MainLayout>
  )
}
