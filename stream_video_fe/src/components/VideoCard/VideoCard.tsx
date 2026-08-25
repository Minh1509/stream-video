import { useState } from 'react'
import type { Video } from '../../types/video.type'
import { formatDuration } from '../../utils/format'

interface Props {
  video: Video
  onClick: (video: Video) => void
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  processing: { label: 'Đang xử lý', className: 'bg-yellow-400/90 text-yellow-900' },
  failed: { label: 'Thất bại', className: 'bg-red-500/90 text-white' },
}

export default function VideoCard({ video, onClick }: Props) {
  const [imgError, setImgError] = useState(false)
  const isReady = video.status === 'ready'
  const badge = STATUS_BADGE[video.status]

  return (
    <button
      type="button"
      onClick={() => isReady && onClick(video)}
      disabled={!isReady}
      aria-disabled={!isReady}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition
        ${isReady ? 'hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
        {imgError ? (
          <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        ) : (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        )}

        {isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
            <span className="flex h-14 w-14 scale-90 items-center justify-center rounded-full bg-white/90 text-indigo-600 opacity-0 shadow-lg transition group-hover:scale-100 group-hover:opacity-100">
              <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-6 w-6">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </div>
        )}

        {badge && (
          <span className={`absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}>
            {badge.label}
          </span>
        )}

        {isReady && video.duration > 0 && (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
            {formatDuration(video.duration)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="line-clamp-2 font-semibold leading-snug text-slate-900">{video.title}</h3>
        <p className="line-clamp-2 text-sm text-slate-500">{video.description}</p>
      </div>
    </button>
  )
}
