interface Props {
  title?: string
  message?: string
}

export default function EmptyState({
  title = 'Không tìm thấy video',
  message = 'Thử từ khóa khác xem sao.'
}: Props) {
  return (
    <div className='flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center'>
      <span className='flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400'>
        <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2} className='h-7 w-7'>
          <circle cx='11' cy='11' r='7' />
          <path d='m21 21-4.3-4.3' strokeLinecap='round' />
        </svg>
      </span>
      <div>
        <p className='font-semibold text-slate-900'>{title}</p>
        <p className='mt-1 text-sm text-slate-500'>{message}</p>
      </div>
    </div>
  )
}
