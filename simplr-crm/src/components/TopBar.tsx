import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight, Search } from './icons'
import { NotificationsBell } from './NotificationsBell'
import { classNames } from '../lib/format'

type SVGIcon = (p: { size?: number; className?: string }) => JSX.Element
export type HeaderTab = { id: string; label: string; icon?: SVGIcon; count?: number }

// Page header. Row 1 is identity + actions (title, search, bell). Optional row 2
// holds the page's own steps/tabs, so they never compete with the chrome above.
export function TopBar({
  title,
  crumbs,
  center,
  actions,
  tabs,
}: {
  title: string
  crumbs?: string[]
  center?: ReactNode
  actions?: ReactNode
  tabs?: { items: HeaderTab[]; value: string; onChange: (id: string) => void }
}) {
  const nav = useNavigate()
  const loc = useLocation()
  const canBack = loc.key !== 'default' // false only on a cold-loaded first page
  return (
    <header className="shrink-0 bg-card-sheen border-b border-border shadow-chrome relative z-10 px-7">
      <div className="h-[64px] flex items-center gap-3.5">
        <button
          onClick={() => (canBack ? nav(-1) : nav('/'))}
          title="Back"
          aria-label="Back"
          className="w-9 h-9 -ml-1 shrink-0 rounded-control border border-border bg-surface flex items-center justify-center text-muted-b hover:text-ink-3 hover:bg-control transition-colors"
        >
          <ChevronRight size={17} className="rotate-180" />
        </button>
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
      </div>
      {tabs && (
        <nav className="flex items-stretch gap-1 -mb-px overflow-x-auto no-scrollbar">
          {tabs.items.map((t) => {
            const on = t.id === tabs.value
            return (
              <button
                key={t.id}
                onClick={() => tabs.onChange(t.id)}
                className={classNames(
                  'h-11 px-3 flex items-center gap-2 text-[13px] whitespace-nowrap border-b-2 transition-colors',
                  on ? 'border-accent text-accent font-semibold' : 'border-transparent text-muted-b font-medium hover:text-ink-3',
                )}
              >
                {t.icon && <t.icon size={15} />}
                {t.label}
                {t.count != null && t.count > 0 && (
                  <span className={classNames('text-[10.5px] font-bold rounded-full min-w-[18px] h-[18px] px-1.5 flex items-center justify-center', on ? 'bg-accent text-white' : 'bg-control text-muted-b')}>{t.count}</span>
                )}
              </button>
            )
          })}
        </nav>
      )}
    </header>
  )
}
