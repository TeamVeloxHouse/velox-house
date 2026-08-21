import type { ReactNode } from 'react'
import { ChevronRight, Search } from './icons'
import { NotificationsBell } from './NotificationsBell'

export function TopBar({
  title,
  crumbs,
  center,
  actions,
}: {
  title: string
  crumbs?: string[]
  center?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="h-[68px] shrink-0 bg-surface border-b border-border flex items-center gap-3.5 px-7">
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-[18px] font-bold text-ink truncate">{title}</h1>
        {crumbs && crumbs.length > 0 && (
          <div className="flex items-center gap-2 text-[13px] text-muted-2b">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-2">
                <ChevronRight size={13} className="text-input-border" />
                <span className={i === crumbs.length - 1 ? 'text-ink-3' : ''}>{c}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      {center && <div className="ml-4">{center}</div>}
      <div className="ml-auto flex items-center gap-2.5">
        {actions}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('simplr-open-palette'))}
          className="w-9 h-9 rounded-control border border-border bg-surface flex items-center justify-center text-muted-b hover:text-ink-3 hover:bg-control transition-colors"
          title="Search (⌘K)"
        >
          <Search size={17} />
        </button>
        <NotificationsBell />
      </div>
    </header>
  )
}
