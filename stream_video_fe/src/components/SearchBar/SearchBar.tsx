interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function SearchBar({ value, onChange, placeholder = 'Tìm kiếm video...' }: Props) {
  return (
    <div className='relative'>
      <span className='pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400'>
        <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2} className='h-5 w-5'>
          <circle cx='11' cy='11' r='7' />
          <path d='m21 21-4.3-4.3' strokeLinecap='round' />
        </svg>
      </span>
      <input
        type='search'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label='Tìm kiếm video'
        className='w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100'
      />
    </div>
  )
}
