interface Props {
  message?: string
  onRetry?: () => void
}

export default function ErrorState({ message = 'Đã có lỗi xảy ra khi tải video.', onRetry }: Props) {
  return (
    <div className='flex flex-col items-center justify-center gap-4 rounded-2xl border border-red-100 bg-red-50 px-6 py-16 text-center'>
      <span className='flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-500'>
        <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2} className='h-7 w-7'>
          <circle cx='12' cy='12' r='9' />
          <path d='M12 8v4' strokeLinecap='round' />
          <path d='M12 16h.01' strokeLinecap='round' />
        </svg>
      </span>
      <div>
        <p className='font-semibold text-slate-900'>Không tải được danh sách</p>
        <p className='mt-1 text-sm text-slate-500'>{message}</p>
      </div>
      {onRetry && (
        <button
          type='button'
          onClick={onRetry}
          className='rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400'
        >
          Thử lại
        </button>
      )}
    </div>
  )
}
