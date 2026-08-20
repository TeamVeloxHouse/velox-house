import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Grid, Bars, Bolt, Person, Building, Calendar, Envelope, Pie, Gear, ChevronRight, ChevronDown,
  Box, Flow, Megaphone, Sparkle, Video, Robot, Target, Layers, File,
} from './icons'
import { classNames } from '../lib/format'

type Item = { to: string; icon: (p: { size?: number; className?: string }) => JSX.Element; label: string; end?: boolean; badge?: number }
type Group = { label: string; items: Item[] }

const groups: Group[] = [
  { label: 'Workspace', items: [
    { to: '/', icon: Grid, label: 'Home', end: true },
    { to: '/agents', icon: Robot, label: 'Agents' },
  ] },
  { label: 'Pipeline', items: [
    { to: '/deals', icon: Bars, label: 'Deals' },
    { to: '/leads', icon: Bolt, label: 'Leads', badge: 8 },
    { to: '/forecast', icon: Target, label: 'Forecast' },
  ] },
  { label: 'Contacts', items: [
    { to: '/people', icon: Person, label: 'People' },
    { to: '/organisations', icon: Building, label: 'Organisations' },
  ] },
  { label: 'Engage', items: [
    { to: '/activities', icon: Calendar, label: 'Activities', badge: 6 },
    { to: '/meetings', icon: Video, label: 'Meetings' },
    { to: '/inbox', icon: Envelope, label: 'Sales Inbox' },
    { to: '/campaigns', icon: Megaphone, label: 'Campaigns' },
    { to: '/automation', icon: Layers, label: 'Automation' },
  ] },
  { label: 'Deliver', items: [
    { to: '/projects', icon: Flow, label: 'Projects' },
    { to: '/products', icon: Box, label: 'Products' },
    { to: '/documents', icon: File, label: 'Documents' },
  ] },
  { label: 'Analyse', items: [
    { to: '/insights', icon: Pie, label: 'Insights' },
  ] },
]

function itemClasses(expanded: boolean) {
  return (isActive: boolean) =>
    classNames(
      'group relative flex items-center transition-colors duration-150',
      expanded ? 'h-9 rounded-[9px] px-2.5 gap-3' : 'w-11 h-11 rounded-[12px] justify-center',
      isActive ? 'bg-white/10 text-white' : 'text-rail-idle hover:text-white/90 hover:bg-white/5',
    )
}

function Badge({ n, expanded }: { n: number; expanded: boolean }) {
  return expanded ? (
    <span className="text-[11px] font-bold text-white bg-accent rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">{n}</span>
  ) : (
    <span className="absolute top-1 right-1 text-[10px] font-bold text-white bg-accent rounded-full min-w-[15px] h-[15px] px-0.5 flex items-center justify-center">{n}</span>
  )
}

function Tooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-[52px] px-2 py-1 rounded-md bg-ink text-white text-[12px] font-medium opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 whitespace-nowrap z-50 shadow-modal">
      {label}
    </span>
  )
}

export function Rail() {
  const [expanded, setExpanded] = useState(() => {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem('simplr.rail') : null
    return v ? v === '1' : true
  })
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('simplr.railGroups')
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch {
      return new Set()
    }
  })
  useEffect(() => { localStorage.setItem('simplr.rail', expanded ? '1' : '0') }, [expanded])
  useEffect(() => { localStorage.setItem('simplr.railGroups', JSON.stringify([...collapsed])) }, [collapsed])

  function toggleGroup(label: string) {
    setCollapsed((c) => {
      const n = new Set(c)
      n.has(label) ? n.delete(label) : n.add(label)
      return n
    })
  }

  return (
    <nav
      className={classNames(
        'shrink-0 bg-rail flex flex-col py-4 transition-[width] duration-200 ease-out overflow-hidden',
        expanded ? 'w-[228px] px-3' : 'w-[76px] px-0 items-center',
      )}
    >
      {/* brand + toggle */}
      <div className={classNames('flex items-center mb-4', expanded ? 'px-1.5 gap-2.5' : 'flex-col')}>
        <NavLink to="/" className="w-[34px] h-[34px] rounded-[10px] bg-accent-gradient text-white flex items-center justify-center font-bold text-[15px] shrink-0">S</NavLink>
        {expanded && <span className="text-white font-bold text-[16px] tracking-[-0.01em] flex-1">Simplr</span>}
        <button
          onClick={() => setExpanded((e) => !e)}
          title={expanded ? 'Collapse' : 'Expand'}
          className={classNames('text-rail-idle hover:text-white transition-colors rounded-lg hover:bg-white/5 w-7 h-7 flex items-center justify-center', !expanded && 'mt-3')}
        >
          <ChevronRight size={16} className={classNames('transition-transform duration-200', expanded && 'rotate-180')} />
        </button>
      </div>

      {/* featured: Simplr AI */}
      <NavLink
        to="/ai"
        title={expanded ? undefined : 'Simplr AI'}
        className={({ isActive }) =>
          classNames(
            'group relative flex items-center mb-3 transition-all duration-150',
            expanded ? 'h-10 rounded-[10px] px-2.5 gap-3' : 'w-11 h-11 rounded-[12px] justify-center',
            isActive ? 'bg-accent-gradient text-white shadow-primary' : 'text-white bg-white/[0.06] hover:bg-white/10 ring-1 ring-inset ring-white/10',
          )
        }
      >
        <Sparkle size={19} className="shrink-0" />
        {expanded && <span className="text-[13.5px] font-semibold flex-1 truncate">Simplr AI</span>}
        {expanded && <span className="eyebrow text-[9px] bg-white/20 rounded px-1.5 py-0.5">AI</span>}
        {!expanded && <Tooltip label="Simplr AI" />}
      </NavLink>

      {/* grouped nav */}
      <div className="flex-1 overflow-y-auto -mx-1 px-1 flex flex-col gap-0.5">
        {groups.map((g, gi) => {
          const isCollapsed = collapsed.has(g.label)
          return (
            <div key={g.label} className={classNames(!expanded && gi > 0 && 'w-full flex flex-col items-center')}>
              {expanded ? (
                <button
                  onClick={() => toggleGroup(g.label)}
                  className="w-full flex items-center gap-1 px-2.5 pt-3 pb-1 group/head"
                >
                  <span className="eyebrow text-[10px] text-rail-idle/70 group-hover/head:text-rail-idle flex-1 text-left transition-colors">{g.label}</span>
                  <ChevronDown size={13} className={classNames('text-rail-idle/60 transition-transform duration-150', isCollapsed && '-rotate-90')} />
                </button>
              ) : (
                gi > 0 && <div className="w-8 h-px bg-white/10 my-2 mx-auto" />
              )}
              {(!isCollapsed || !expanded) && (
                <div className={classNames('flex flex-col gap-0.5', !expanded && 'items-center gap-1.5')}>
                  {g.items.map((it) => (
                    <NavLink key={it.to} to={it.to} end={it.end} title={expanded ? undefined : it.label} className={({ isActive }) => itemClasses(expanded)(isActive)}>
                      <it.icon size={19} className="shrink-0" />
                      {expanded && <span className="text-[13.5px] font-medium flex-1 truncate">{it.label}</span>}
                      {it.badge != null && <Badge n={it.badge} expanded={expanded} />}
                      {!expanded && <Tooltip label={it.label} />}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* footer */}
      <div className={classNames('mt-2 pt-2 border-t border-white/10 flex flex-col gap-1', !expanded && 'items-center')}>
        <NavLink to="/settings" title={expanded ? undefined : 'Settings'} className={({ isActive }) => itemClasses(expanded)(isActive)}>
          <Gear size={19} className="shrink-0" />
          {expanded && <span className="text-[13.5px] font-medium">Settings</span>}
          {!expanded && <Tooltip label="Settings" />}
        </NavLink>
        <div className={classNames('flex items-center', expanded ? 'px-2.5 py-1.5 gap-2.5' : 'justify-center mt-1')}>
          <div className="w-[34px] h-[34px] rounded-full bg-[#2A3546] text-[#C6CEDB] flex items-center justify-center text-[12px] font-semibold shrink-0">JM</div>
          {expanded && (
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-white truncate">Jordan Miles</div>
              <div className="text-[11px] text-rail-idle truncate">Account executive</div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
