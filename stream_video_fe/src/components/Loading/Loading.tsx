interface Props {
  count?: number
}

export default function Loading({ count = 8 }: Props) {
  return (
    <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className='overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm'>
          <div className='aspect-video w-full animate-pulse bg-slate-200' />
          <div className='flex flex-col gap-2 p-4'>
            <div className='h-4 w-3/4 animate-pulse rounded bg-slate-200' />
            <div className='h-3 w-full animate-pulse rounded bg-slate-100' />
            <div className='h-3 w-2/3 animate-pulse rounded bg-slate-100' />
          </div>
        </div>
      ))}
    </div>
  )
}
