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
  const glassBtn =
    'w-9 h-9 shrink-0 rounded-[10px] bg-white/60 backdrop-blur border border-white/80 shadow-[0_1px_2px_rgba(10,59,52,0.08)] flex items-center justify-center text-[#2F5A50] hover:bg-white hover:text-accent-700 transition-colors'
  return (
    // The header is a soft mint band: it separates the dark sidebar from the grey/white page body
    // and makes "where am I, and which view of this page" the most obvious thing on screen.
    <header className="sh-topbar shrink-0 relative z-10 px-7">
      <div className="h-[64px] flex items-center gap-3.5 relative">
        <button onClick={() => (canBack ? nav(-1) : nav('/'))} title="Back" aria-label="Back" className={classNames(glassBtn, '-ml-1')}>
          <ChevronRight size={17} className="rotate-180" />
        </button>
        <div className="flex items-center gap-2.5 min-w-0">
          {identity && (
            <span
              className="w-9 h-9 rounded-[11px] flex items-center justify-center text-white shrink-0 ring-1 ring-white/40"
              style={{ background: `linear-gradient(140deg, ${identity.accent}CC 0%, ${identity.accent} 60%)`, boxShadow: `0 6px 14px -6px ${identity.accent}AA, inset 0 1px 0 rgba(255,255,255,0.35)` }}
            >
              <identity.icon size={18} />
            </span>
          )}
          <h1 className="text-[19px] font-bold text-[#0B2A24] tracking-[-0.015em] truncate">{title}</h1>
          {crumbs && crumbs.length > 0 && (
            <div className="flex items-center gap-2 text-[13px] text-[#4E7A70]">
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-2">
                  <ChevronRight size={13} className="text-[#8DB8AD]" />
                  <span className={i === crumbs.length - 1 ? 'text-[#2F5A50] font-medium' : ''}>{c}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        {center && <div className="ml-4">{center}</div>}
        <div className="ml-auto flex items-center gap-2.5">
          {actions}
          <button onClick={() => window.dispatchEvent(new CustomEvent('simplr-open-palette'))} className={glassBtn} title="Search (⌘K)">
            <Search size={17} />
          </button>
          <NotificationsBell />
        </div>
      </div>
      {tabs && (
        // Tabs sit on the band's bottom edge like a modern app bar: the active view gets a solid
        // accent underline and full-strength label, the rest are quieter — no boxed-in track.
        <nav className="relative -mt-1 overflow-x-auto no-scrollbar">
          <div className="flex items-end gap-1">
            {tabs.items.map((t) => {
              const on = t.id === tabs.value
              return (
                <button
                  key={t.id}
                  onClick={() => tabs.onChange(t.id)}
                  className={classNames(
                    'group relative h-11 px-3.5 flex items-center gap-2 text-[13.5px] whitespace-nowrap transition-colors duration-150',
                    on ? 'text-[#0B2A24] font-bold' : 'text-[#4E7A70] font-semibold hover:text-[#0B2A24]',
                  )}
                >
                  <span className={classNames('absolute inset-x-1 top-1.5 bottom-1.5 rounded-[9px] transition-colors', on ? 'bg-white/70 shadow-[0_1px_2px_rgba(10,59,52,0.06)]' : 'group-hover:bg-white/45')} />
                  {t.icon && <span className={classNames('relative', on ? 'text-accent' : '')}><t.icon size={16} /></span>}
                  <span className="relative">{t.label}</span>
                  {t.count != null && t.count > 0 && (
                    <span className={classNames('relative text-[11px] font-bold rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center', on ? 'bg-accent text-white' : 'bg-white/70 text-[#2F5A50]')}>{t.count}</span>
                  )}
                  <span className={classNames('absolute left-2 right-2 bottom-0 h-[3px] rounded-t-full transition-all', on ? 'bg-accent-gradient opacity-100' : 'opacity-0')} />
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </header>
  )
}
