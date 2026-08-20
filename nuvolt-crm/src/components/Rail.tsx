import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Grid, Bars, Bolt, Person, Building, Calendar, Envelope, Pie, Gear, ChevronRight, Box, Flow, Megaphone, Sparkle, Video, Robot } from './icons'
import { classNames } from '../lib/format'

const nav = [
  { to: '/', icon: Grid, label: 'Home', end: true },
  { to: '/agents', icon: Robot, label: 'Agents' },
  { to: '/deals', icon: Bars, label: 'Deals' },
  { to: '/leads', icon: Bolt, label: 'Leads', badge: 8 },
  { to: '/people', icon: Person, label: 'People' },
  { to: '/organisations', icon: Building, label: 'Organisations' },
  { to: '/activities', icon: Calendar, label: 'Activities', badge: 6 },
  { to: '/meetings', icon: Video, label: 'Meetings' },
  { to: '/inbox', icon: Envelope, label: 'Sales Inbox' },
  { to: '/projects', icon: Flow, label: 'Projects' },
  { to: '/campaigns', icon: Megaphone, label: 'Campaigns' },
  { to: '/products', icon: Box, label: 'Products' },
  { to: '/insights', icon: Pie, label: 'Insights' },
]

export function Rail() {
  const [expanded, setExpanded] = useState(() => {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem('simplr.rail') : null
    return v ? v === '1' : true
  })
  useEffect(() => {
    localStorage.setItem('simplr.rail', expanded ? '1' : '0')
  }, [expanded])

  return (
    <nav
      className={classNames(
        'shrink-0 bg-rail flex flex-col py-4 transition-[width] duration-200 ease-out overflow-hidden',
        expanded ? 'w-[228px] px-3' : 'w-[76px] px-0 items-center',
      )}
    >
      {/* brand + toggle */}
      <div className={classNames('flex items-center mb-5', expanded ? 'px-1.5 gap-2.5' : 'flex-col')}>
        <NavLink to="/" className="w-[34px] h-[34px] rounded-[10px] bg-accent-gradient text-white flex items-center justify-center font-bold text-[15px] shrink-0">
          S
        </NavLink>
        {expanded && <span className="text-white font-bold text-[16px] tracking-[-0.01em] flex-1">Simplr</span>}
        <button
          onClick={() => setExpanded((e) => !e)}
          title={expanded ? 'Collapse' : 'Expand'}
          className={classNames(
            'text-rail-idle hover:text-white transition-colors rounded-lg hover:bg-white/5',
            expanded ? 'w-7 h-7 flex items-center justify-center' : 'w-7 h-7 flex items-center justify-center mt-3',
          )}
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
            'group relative flex items-center mb-2 transition-all duration-150',
            expanded ? 'h-10 rounded-[10px] px-2.5 gap-3' : 'w-11 h-11 rounded-[12px] justify-center',
            isActive ? 'bg-accent-gradient text-white shadow-primary' : 'text-white bg-white/[0.06] hover:bg-white/10 ring-1 ring-inset ring-white/10',
          )
        }
      >
        <Sparkle size={19} className="shrink-0" />
        {expanded && <span className="text-[13.5px] font-semibold flex-1 truncate">Simplr AI</span>}
        {expanded && <span className="eyebrow text-[9px] bg-white/20 rounded px-1.5 py-0.5">AI</span>}
        {!expanded && (
          <span className="pointer-events-none absolute left-[52px] px-2 py-1 rounded-md bg-ink text-white text-[12px] font-medium opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 whitespace-nowrap z-50 shadow-modal">
            Simplr AI
          </span>
        )}
      </NavLink>

      {/* nav */}
      <div className={classNames('flex flex-col gap-0.5', !expanded && 'items-center gap-1.5')}>
        {nav.map(({ to, icon: Icon, label, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={expanded ? undefined : label}
            className={({ isActive }) =>
              classNames(
                'group relative flex items-center transition-colors duration-150',
                expanded ? 'h-10 rounded-[10px] px-2.5 gap-3' : 'w-11 h-11 rounded-[12px] justify-center',
                isActive ? 'bg-white/10 text-white' : 'text-rail-idle hover:text-white/90 hover:bg-white/5',
              )
            }
          >
            <Icon size={19} className="shrink-0" />
            {expanded && <span className="text-[13.5px] font-medium flex-1 truncate">{label}</span>}
            {badge != null &&
              (expanded ? (
                <span className="text-[11px] font-bold text-white bg-accent rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">{badge}</span>
              ) : (
                <span className="absolute top-1 right-1 text-[10px] font-bold text-white bg-accent rounded-full min-w-[15px] h-[15px] px-0.5 flex items-center justify-center">{badge}</span>
              ))}
            {!expanded && (
              <span className="pointer-events-none absolute left-[52px] px-2 py-1 rounded-md bg-ink text-white text-[12px] font-medium opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 whitespace-nowrap z-50 shadow-modal">
                {label}
              </span>
            )}
          </NavLink>
        ))}
      </div>

      {/* footer */}
      <div className={classNames('mt-auto flex flex-col gap-1', !expanded && 'items-center')}>
        <NavLink
          to="/settings"
          title={expanded ? undefined : 'Settings'}
          className={({ isActive }) =>
            classNames(
              'flex items-center transition-colors duration-150',
              expanded ? 'h-10 rounded-[10px] px-2.5 gap-3' : 'w-11 h-11 rounded-[12px] justify-center',
              isActive ? 'bg-white/10 text-white' : 'text-rail-idle hover:text-white/90 hover:bg-white/5',
            )
          }
        >
          <Gear size={19} className="shrink-0" />
          {expanded && <span className="text-[13.5px] font-medium">Settings</span>}
        </NavLink>
        <div className={classNames('flex items-center', expanded ? 'px-2.5 py-1.5 gap-2.5' : 'justify-center mt-1')}>
          <div className="w-[34px] h-[34px] rounded-full bg-[#2A3546] text-[#C6CEDB] flex items-center justify-center text-[12px] font-semibold shrink-0">
            JM
          </div>
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
