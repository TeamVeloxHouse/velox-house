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
  const glassBtn = 'sh-hdr-btn w-9 shrink-0 flex items-center justify-center'
  return (
    // The header is one solid band (colours in index.css .sh-topbar): it frames the grey page with
    // the sidebar and makes "where am I, and which view of this page" the most obvious thing.
    <header className="sh-topbar shrink-0 relative z-10 px-7">
      <div className="h-[64px] flex items-center gap-3.5 relative">
        <button onClick={() => (canBack ? nav(-1) : nav('/'))} title="Back" aria-label="Back" className={classNames(glassBtn, '-ml-1')}>
          <ChevronRight size={17} className="rotate-180" />
        </button>
        <div className="flex items-center gap-2.5 min-w-0">
          {identity && (
            // one identity tile for every page: navy with the teal icon — echoes the sidebar's active tile
            <span className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0 bg-[#15223B] text-[#62E4CC] shadow-[0_4px_12px_-4px_rgba(21,34,59,0.5)]">
              <identity.icon size={18} />
            </span>
          )}
          <h1 className="sh-hdr-title text-[19px] font-bold tracking-[-0.015em] truncate">{title}</h1>
          {crumbs && crumbs.length > 0 && (
            <div className="sh-hdr-muted flex items-center gap-2 text-[13px]">
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-2">
                  <ChevronRight size={13} className="opacity-60" />
                  <span className={i === crumbs.length - 1 ? 'sh-hdr-crumb-on font-medium' : ''}>{c}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        {center && <div className="sh-hdr-ctrls ml-4 flex items-center gap-2.5">{center}</div>}
        <div className="sh-hdr-ctrls ml-auto flex items-center gap-2.5">
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
                    'relative h-11 px-3.5 flex items-center gap-2 text-[13.5px] whitespace-nowrap transition-colors duration-150',
                    on ? 'sh-tab sh-tab-on font-bold' : 'sh-tab font-semibold',
                  )}
                >
                  <span className="sh-tab-bg absolute inset-x-1 top-1.5 bottom-1.5 rounded-[9px] transition-colors" />
                  {t.icon && <span className="sh-tab-icon relative"><t.icon size={16} /></span>}
                  <span className="relative">{t.label}</span>
                  {t.count != null && t.count > 0 && (
                    <span className="sh-tab-count relative text-[11px] font-bold rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center">{t.count}</span>
                  )}
                  <span className={classNames('sh-tab-bar absolute left-2 right-2 bottom-0 h-[3px] rounded-t-full transition-all', on ? 'opacity-100' : 'opacity-0')} />
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </header>
  )
}
