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
  identity,
}: {
  /** Coloured icon tile beside the title — gives each tool a recognisable identity. */
  identity?: { icon: SVGIcon; accent: string }
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
          {identity && (
            <span className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white shrink-0 mr-0.5" style={{ background: identity.accent, boxShadow: `0 4px 12px -4px ${identity.accent}88` }}>
              <identity.icon size={18} />
            </span>
          )}
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
        // Tabs read as destinations: a recessed track, each tab a pill with icon + count, the active
        // one lifted white with the page's accent — obvious at a glance, consistent CRM-wide.
        <nav className="pb-3 -mt-1 overflow-x-auto no-scrollbar">
          <div className="inline-flex items-center gap-1 p-1 rounded-[12px] bg-[#E9EDF2] border border-[#DDE3EA]">
            {tabs.items.map((t) => {
              const on = t.id === tabs.value
              const accent = identity?.accent ?? '#0E7A66'
              return (
                <button
                  key={t.id}
                  onClick={() => tabs.onChange(t.id)}
                  className={classNames(
                    'h-9 px-3.5 rounded-[9px] flex items-center gap-2 text-[13.5px] whitespace-nowrap transition-all duration-150',
                    on ? 'bg-white font-bold shadow-[0_1px_3px_rgba(11,18,32,0.14),0_4px_10px_-4px_rgba(11,18,32,0.12)]' : 'text-ink-3 font-semibold hover:bg-white/70 hover:text-ink',
                  )}
                  style={on ? { color: accent } : undefined}
                >
                  {t.icon && <t.icon size={16} />}
                  {t.label}
                  {t.count != null && t.count > 0 && (
                    <span className={classNames('text-[11px] font-bold rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center', on ? 'text-white' : 'bg-white text-ink-3 border border-[#DDE3EA]')} style={on ? { background: accent } : undefined}>{t.count}</span>
                  )}
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </header>
  )
}
