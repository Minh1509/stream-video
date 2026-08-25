import { useRef, useState } from 'react'
import { uploadVideo } from '../../apis/video.api'

interface Props {
  onUploaded?: () => void
}

type State = 'idle' | 'submitting' | 'success' | 'error'

export default function UploadWidget({ onUploaded }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setTitle('')
    setDescription('')
    setFile(null)
    setState('idle')
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const close = () => {
    setOpen(false)
    reset()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề.')
      return
    }
    if (!file) {
      setError('Vui lòng chọn một file video.')
      return
    }

    setState('submitting')
    setError('')
    try {
      await uploadVideo({ title: title.trim(), description: description.trim(), file })
      setState('success')
      onUploaded?.()
      setTimeout(close, 1500)
    } catch {
      setState('error')
      setError('Tải lên thất bại. Vui lòng thử lại.')
    }
  }

  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        aria-label='Tải video lên'
        className='fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400'
      >
        <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2} className='h-5 w-5'>
          <path d='M12 5v14M5 12h14' strokeLinecap='round' />
        </svg>
        Tải lên
      </button>

      {open && (
        <div
          role='dialog'
          aria-modal='true'
          aria-label='Tải video lên'
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4'
          onClick={close}
        >
          <div
            className='w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-lg font-bold text-slate-900'>Tải video lên</h2>
              <button
                type='button'
                onClick={close}
                aria-label='Đóng'
                className='flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600'
              >
                <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2} className='h-5 w-5'>
                  <path d='M6 6l12 12M18 6L6 18' strokeLinecap='round' />
                </svg>
              </button>
            </div>

            {state === 'success' ? (
              <p className='py-8 text-center text-slate-600'>
                Đã tải lên. Video đang được xử lý và sẽ xuất hiện khi sẵn sàng.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className='space-y-4'>
                <div>
                  <label htmlFor='up-title' className='mb-1 block text-sm font-medium text-slate-700'>
                    Tiêu đề
                  </label>
                  <input
                    id='up-title'
                    type='text'
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className='w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'
                    placeholder='Tên video'
                  />
                </div>

                <div>
                  <label htmlFor='up-desc' className='mb-1 block text-sm font-medium text-slate-700'>
                    Mô tả
                  </label>
                  <textarea
                    id='up-desc'
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className='w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'
                    placeholder='Mô tả ngắn (không bắt buộc)'
                  />
                </div>

                <div>
                  <label htmlFor='up-file' className='mb-1 block text-sm font-medium text-slate-700'>
                    File video
                  </label>
                  <input
                    id='up-file'
                    ref={fileInputRef}
                    type='file'
                    accept='video/*'
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className='w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-600 hover:file:bg-indigo-100'
                  />
                </div>

                {error && <p className='text-sm text-red-600'>{error}</p>}

                <button
                  type='submit'
                  disabled={state === 'submitting'}
                  className='w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60'
                >
                  {state === 'submitting' ? 'Đang tải lên...' : 'Tải lên'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
