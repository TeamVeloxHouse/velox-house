import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { classNames } from '../lib/format'

type SVGIcon = ComponentType<{ size?: number; className?: string; style?: CSSProperties }>

export type SubNavItem = { label: string; icon?: SVGIcon; count?: number; badge?: string }
export type SubNavGroup = { heading?: string; items: SubNavItem[] }

/** Contextual left sub-sidebar (Leads / Projects / Inbox / Insights style). */
export function SubSidebar({
  groups,
  active,
  onSelect,
  top,
  width = 232,
  footer,
}: {
  groups: SubNavGroup[]
  active: string
  onSelect?: (label: string) => void
  top?: ReactNode
  width?: number
  footer?: ReactNode
}) {
  return (
    <aside className="shrink-0 bg-surface border-r border-border flex flex-col overflow-y-auto" style={{ width }}>
      <div className="p-3 flex-1 flex flex-col gap-4">
        {top && <div>{top}</div>}
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.heading && <div className="eyebrow text-muted-3 px-2.5 mb-1.5">{g.heading}</div>}
            <div className="flex flex-col gap-0.5">
              {g.items.map((it) => {
                const on = it.label === active
                return (
                  <button
                    key={it.label}
                    onClick={() => onSelect?.(it.label)}
                    className={classNames(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-left transition-colors',
                      on ? 'bg-accent-wash-2 text-accent-700 font-semibold' : 'text-ink-3 hover:bg-control',
                    )}
                  >
                    {it.icon && <it.icon size={17} className={on ? 'text-accent' : 'text-muted-2'} />}
                    <span className="flex-1 truncate">{it.label}</span>
                    {it.badge && <span className="text-[10px] font-bold text-accent bg-accent-wash px-1.5 py-0.5 rounded">{it.badge}</span>}
                    {it.count != null && <span className={on ? 'text-accent-700' : 'text-muted-3'}>{it.count}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {footer && <div className="p-3 border-t border-divider">{footer}</div>}
    </aside>
  )
}

/** Icon view-switcher used in section toolbars. */
export function ViewSwitch<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; icon: SVGIcon; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex bg-control rounded-control p-[3px] gap-0.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          title={t.label}
          className={classNames(
            'h-[30px] w-9 rounded-[7px] flex items-center justify-center transition-colors',
            value === t.id ? 'bg-white text-accent shadow-[0_1px_2px_rgba(11,18,32,0.08)]' : 'text-muted-b hover:text-ink-3',
          )}
        >
          <t.icon size={16} />
        </button>
      ))}
    </div>
  )
}

/** Pill filter row (activity type / period style). */
export function PillTabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { id: string; label: string; icon?: SVGIcon; color?: string }[]
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <div className={classNames('flex items-center gap-1 flex-wrap', className)}>
      {tabs.map((t) => {
        const on = t.id === value
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={classNames(
              'h-8 px-3 rounded-lg text-[13px] font-medium flex items-center gap-1.5 transition-colors',
              on ? 'bg-accent-wash text-accent' : 'text-muted-b hover:bg-control hover:text-ink-3',
            )}
          >
            {t.icon && <t.icon size={14} style={t.color ? { color: t.color } : undefined} />}
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
