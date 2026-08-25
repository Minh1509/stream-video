import type { Video } from '../../types/video.type'
import VideoCard from '../VideoCard'

interface Props {
  videos: Video[]
  onSelect: (video: Video) => void
}

export default function VideoGrid({ videos, onSelect }: Props) {
  return (
    <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} onClick={onSelect} />
      ))}
    </div>
  )
}
