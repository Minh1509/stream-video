import React from 'react'
import SearchBar from '../../components/SearchBar'

interface Props {
  children?: React.ReactNode
  searchValue?: string
  onSearchChange?: (value: string) => void
}

export default function MainLayout({ children, searchValue, onSearchChange }: Props) {
  return (
    <div className='flex min-h-screen flex-col bg-slate-50 text-slate-900'>
      <header className='sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur'>
        <div className='mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8'>
          <a href='/' className='flex items-center gap-2 text-slate-900 hover:opacity-80'>
            <span className='flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white'>
              <svg viewBox='0 0 24 24' fill='currentColor' className='h-5 w-5'>
                <path d='M8 5v14l11-7z' />
              </svg>
            </span>
            <span className='text-lg font-bold tracking-tight'>StreamVideo</span>
          </a>

          {onSearchChange && (
            <div className='ml-auto w-full max-w-md'>
              <SearchBar value={searchValue ?? ''} onChange={onSearchChange} />
            </div>
          )}
        </div>
      </header>

      <main className='mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8'>{children}</main>

      <footer className='border-t border-slate-200 bg-white'>
        <div className='mx-auto max-w-7xl px-4 py-6 text-center text-sm text-slate-500 sm:px-6 lg:px-8'>
          © {new Date().getFullYear()} StreamVideo. Built for learning.
        </div>
      </footer>
    </div>
  )
}
