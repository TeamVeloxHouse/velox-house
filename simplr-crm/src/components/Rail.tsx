import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Gear, ChevronRight } from './icons'
import { classNames } from '../lib/format'
import { useState_ } from '../store/store'
import { STAGES, stageForPath, BRAND_GRAD, type Stage } from './nav-config'

// The rail is now a single-axis *area* switcher. The pages inside an area live in
// the top SectionNav, so this stays slim, calm and premium — one tap per area.

function Tooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-[60px] px-2 py-1 rounded-md bg-ink text-white text-[12px] font-medium opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 whitespace-nowrap z-50 shadow-modal">{label}</span>
  )
}

export function Rail() {
  const location = useLocation()
  const nav = useNavigate()
  const { features, teamChannels } = useState_()
  const teamUnread = teamChannels.reduce((s, c) => s + c.unread, 0)
  const activeId = stageForPath(location.pathname)

  const areas = STAGES.filter((s) => !s.feature || features[s.feature])

  const [expanded, setExpanded] = useState(() => (typeof localStorage !== 'undefined' ? localStorage.getItem('simplr.rail') !== '0' : true))
  useEffect(() => { localStorage.setItem('simplr.rail', expanded ? '1' : '0') }, [expanded])

  // Surface unread on the area that owns the Team inbox.
  const badgeFor = (s: Stage) => (s.groups.some((g) => g.items.some((it) => it.to === '/team')) && teamUnread > 0 ? teamUnread : undefined)

  function AreaButton({ s }: { s: Stage }) {
    const on = s.id === activeId
    const isOvi = s.id === 'ovi'
    return (
      <button
        key={s.id}
        onClick={() => nav(s.to)}
        title={expanded ? undefined : s.name}
        className={classNames(
          'group relative flex items-center transition-all duration-150',
          expanded ? 'h-11 rounded-[11px] px-2 gap-3' : 'w-12 h-12 rounded-[13px] justify-center',
          on ? 'text-white' : 'text-rail-idle hover:text-white hover:bg-white/[0.06]',
        )}
        style={on ? { background: isOvi ? BRAND_GRAD : s.accent, boxShadow: `0 6px 16px ${s.accent}44` } : undefined}
      >
        {/* active accent tick on the far left when expanded */}
        <span
          className={classNames('absolute -left-3 w-[3px] rounded-full transition-all duration-200', expanded ? 'block' : 'hidden')}
          style={{ height: on ? 20 : 0, background: isOvi ? '#7C3AED' : s.accent }}
        />
        <span className="relative shrink-0 flex items-center justify-center">
          <s.icon size={20} />
          {badgeFor(s) != null && (
            <span className="absolute -top-1.5 -right-1.5 text-[10px] font-bold text-white bg-negative rounded-full min-w-[15px] h-[15px] px-0.5 flex items-center justify-center ring-2 ring-rail">{badgeFor(s)}</span>
          )}
        </span>
        {expanded && (
          <span className="min-w-0 flex-1 text-left">
            <span className={classNames('block text-[13.5px] leading-tight truncate', on ? 'font-semibold' : 'font-medium')}>{s.name}</span>
            {on && <span className="block text-[11px] leading-tight truncate text-white/70 mt-0.5">{s.desc}</span>}
          </span>
        )}
        {!expanded && <Tooltip label={s.name} />}
      </button>
    )
  }

  return (
    <nav className={classNames('shrink-0 bg-rail flex flex-col py-4 transition-[width] duration-200 ease-out overflow-visible', expanded ? 'w-[224px] px-3.5' : 'w-[76px] px-0 items-center')}>
      {/* brand + collapse */}
      <div className={classNames('flex items-center mb-5', expanded ? 'gap-2.5 px-1' : 'flex-col')}>
        <span className="w-[36px] h-[36px] rounded-[11px] flex items-center justify-center text-white font-bold text-[16px] shrink-0" style={{ background: BRAND_GRAD }}>S</span>
        {expanded && (
          <span className="min-w-0 flex-1">
            <span className="block text-white font-bold text-[15px] tracking-[-0.01em] leading-tight">TellOvi</span>
            <span className="block text-[11px] text-rail-idle leading-tight">Business OS</span>
          </span>
        )}
        <button
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? 'Collapse' : 'Expand'}
          className={classNames('text-rail-idle hover:text-white rounded-lg hover:bg-white/5 w-7 h-7 flex items-center justify-center shrink-0', !expanded && 'mt-3')}
        >
          <ChevronRight size={16} className={expanded ? 'rotate-180' : ''} />
        </button>
      </div>

      {/* areas */}
      <div className="flex-1 overflow-y-auto overflow-x-visible -mx-1.5 px-1.5 flex flex-col gap-1.5">
        {areas.map((s) => <AreaButton key={s.id} s={s} />)}
      </div>

      {/* footer */}
      <div className={classNames('mt-3 pt-3 border-t border-white/10 flex flex-col gap-1.5', !expanded && 'items-center')}>
        <NavLink to="/settings" title={expanded ? undefined : 'Settings'} className={({ isActive }) => classNames('group relative flex items-center transition-colors', expanded ? 'h-10 rounded-[11px] px-2 gap-3' : 'w-12 h-12 rounded-[13px] justify-center', isActive ? 'text-white bg-white/[0.08]' : 'text-rail-idle hover:text-white hover:bg-white/[0.06]')}>
          <Gear size={20} className="shrink-0" />
          {expanded && <span className="text-[13.5px] font-medium">Settings</span>}
          {!expanded && <Tooltip label="Settings" />}
        </NavLink>
        <div className={classNames('flex items-center', expanded ? 'px-2 py-1.5 gap-2.5' : 'justify-center mt-1')}>
          <div className="w-[34px] h-[34px] rounded-full bg-[#2A3546] text-[#C6CEDB] flex items-center justify-center text-[12px] font-semibold shrink-0">JM</div>
          {expanded && <div className="min-w-0"><div className="text-[13px] font-semibold text-white truncate">Jordan Miles</div><div className="text-[11px] text-rail-idle truncate">Account executive</div></div>}
        </div>
      </div>
    </nav>
  )
}
