import EmptyState from '../../components/EmptyState'
import ErrorState from '../../components/ErrorState'
import Loading from '../../components/Loading'
import UploadWidget from '../../components/UploadWidget'
import VideoGrid from '../../components/VideoGrid'
import VideoPlayerModal from '../../components/VideoPlayerModal'
import { useVideos } from '../../hooks/useVideos'
import MainLayout from '../../layouts/MainLayout'

export default function Home() {
  const { filtered, status, search, selected, setSearch, setSelected, retry } = useVideos()

  return (
    <MainLayout searchValue={search} onSearchChange={setSearch}>
      <section className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Khám phá video
        </h1>
        <p className="mt-1 text-slate-500">Chọn một video bất kỳ để bắt đầu xem.</p>
      </section>

      {status === 'loading' && <Loading />}
      {status === 'error' && <ErrorState onRetry={retry} />}
      {status === 'success' && filtered.length === 0 && <EmptyState />}
      {status === 'success' && filtered.length > 0 && (
        <VideoGrid videos={filtered} onSelect={setSelected} />
      )}

      <VideoPlayerModal video={selected} onClose={() => setSelected(null)} />
      <UploadWidget onUploaded={retry} />
    </MainLayout>
  )
}
