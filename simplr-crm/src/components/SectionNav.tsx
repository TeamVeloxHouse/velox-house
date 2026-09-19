import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { classNames } from '../lib/format'
import { useState_ } from '../store/store'
import { STAGES, stageForPath, stageById, BRAND_GRAD } from './nav-config'

// The horizontal flow within an area: its pages, read left-to-right, tinted with
// the area's accent so every section feels distinct while staying one brand.
export function SectionNav() {
  const location = useLocation()
  const { features, teamChannels } = useState_()
  const teamUnread = teamChannels.reduce((s, c) => s + c.unread, 0)
  const stage = stageById(stageForPath(location.pathname))
  const isOvi = stage.id === 'ovi'
  const railRef = useRef<HTMLDivElement>(null)

  // Keep the active tab in view when the area or route changes.
  useEffect(() => {
    const el = railRef.current?.querySelector('[data-active="true"]') as HTMLElement | null
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [location.pathname, stage.id])

  const groups = stage.groups
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.feature || features[it.feature]) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="h-[52px] shrink-0 bg-card-sheen border-b border-border flex items-stretch px-5 gap-1 relative z-20">
      {/* area identity */}
      <div className="flex items-center gap-2.5 pr-4 mr-1 shrink-0">
        <span
          className="w-8 h-8 rounded-[9px] flex items-center justify-center text-white shrink-0"
          style={{ background: isOvi ? BRAND_GRAD : stage.accent }}
        >
          <stage.icon size={17} />
        </span>
        <div className="min-w-0 hidden sm:block">
          <div className="eyebrow text-[9.5px] leading-none mb-0.5" style={{ color: stage.accent }}>Area</div>
          <div className="text-[14px] font-bold text-ink leading-none tracking-[-0.01em]">{stage.name}</div>
        </div>
      </div>
      <div className="w-px bg-divider my-3 shrink-0" />

      {/* section tabs */}
      <div ref={railRef} className="flex items-stretch gap-0.5 overflow-x-auto no-scrollbar min-w-0 pl-2">
        {groups.map((g, gi) => (
          <div key={g.label} className="flex items-stretch gap-0.5 shrink-0">
            {gi > 0 && <div className="w-px bg-divider my-3.5 mx-1.5 shrink-0" />}
            {g.items.map((it) => {
              const badge = it.to === '/team' && teamUnread > 0 ? teamUnread : it.badge
              return (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.end}
                  className={({ isActive }) => classNames('relative flex items-center gap-2 px-3 rounded-lg text-[13px] whitespace-nowrap transition-colors self-center h-9', isActive ? 'font-semibold' : 'font-medium text-muted-b hover:text-ink-3 hover:bg-control')}
                  style={({ isActive }) => (isActive ? { color: stage.accent, background: stage.wash } : undefined)}
                >
                  {({ isActive }) => (
                    <span data-active={isActive} className="flex items-center gap-2">
                      <it.icon size={16} className="shrink-0" />
                      {it.label}
                      {badge != null && (
                        <span
                          className="text-[10.5px] font-bold rounded-full min-w-[17px] h-[17px] px-1 flex items-center justify-center text-white"
                          style={{ background: isActive ? stage.accent : '#98A1B0' }}
                        >{badge}</span>
                      )}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
