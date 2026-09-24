import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Gear, ChevronRight, ChevronDown, Search } from './icons'
import { classNames } from '../lib/format'
import { useState_, useActions } from '../store/store'
import { STAGES, stageForPath, BRAND_GRAD, type Stage, type NavGroup } from './nav-config'
import { ROLES, roleByKey } from '../lib/roles'
import type { UserRole } from '../store/types'
import { Dropdown } from './Dropdown'

// Apollo-style sidebar: every area is an expandable section holding its pages, so
// the whole app is reachable from one place and the page header stays clean.
// Collapsed, it shrinks to area icons with a hover flyout of that area's pages.

const LS_RAIL = 'simplr.rail'
const LS_OPEN = 'simplr.rail.open'
const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } }

export function Rail() {
  const location = useLocation()
  const { features, teamChannels, conversations, currentRole } = useState_()
  const teamUnread = teamChannels.reduce((s, c) => s + c.unread, 0)
  const activeId = stageForPath(location.pathname)
  const { setRole } = useActions()
  const allowed = (roles?: string[]) => !roles || roles.includes(currentRole)

  // Only what this role may see: areas and pages both carry optional `roles`.
  const areas = STAGES
    .filter((s) => (!s.feature || features[s.feature]) && allowed(s.roles))
    .map((s) => ({
      ...s,
      groups: s.groups
        .map((g) => ({ ...g, items: g.items.filter((it) => (!it.feature || features[it.feature]) && allowed(it.roles)) }))
        .filter((g) => g.items.length > 0),
    }))
    .filter((s) => s.groups.length > 0)

  const [expanded, setExpanded] = useState(() => read(LS_RAIL) !== '0')
  useEffect(() => write(LS_RAIL, expanded ? '1' : '0'), [expanded])

  const [open, setOpen] = useState<string[]>(() => {
    try { return JSON.parse(read(LS_OPEN) || 'null') ?? [activeId] } catch { return [activeId] }
  })
  useEffect(() => write(LS_OPEN, JSON.stringify(open)), [open])
  // Landing in an area always reveals its pages.
  useEffect(() => { setOpen((o) => (o.includes(activeId) ? o : [...o, activeId])) }, [activeId])
  const toggle = (id: string) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))

  const inboxUnread = conversations.filter((c) => c.unread).length
  const badgeFor = (to: string, badge?: number) => (to === '/team' && teamUnread > 0 ? teamUnread : to === '/inbox' ? inboxUnread || undefined : badge)
  const areaBadge = (s: Stage) => (s.to === '/inbox' ? inboxUnread || undefined : s.groups.some((g) => g.items.some((it) => it.to === '/team')) && teamUnread > 0 ? teamUnread : undefined)

  return (
    <nav
      className={classNames('shrink-0 flex flex-col py-4 transition-[width] duration-200 ease-out relative z-30', expanded ? 'w-[248px] px-3' : 'w-[72px] px-0 items-center')}
      style={{ background: 'linear-gradient(178deg,#15223B 0%,#0C1628 100%)' }}
    >
      {/* brand + collapse */}
      <div className={classNames('flex items-center mb-4', expanded ? 'gap-2.5 px-1.5' : 'flex-col')}>
        <img src="/solar-house-logo.png" alt="The Solar House" className={classNames('shrink-0 object-contain drop-shadow-[0_4px_10px_rgba(98,228,204,0.25)]', expanded ? 'w-[42px] h-[42px]' : 'w-[40px] h-[40px]')} />
        {expanded && (
          <span className="min-w-0 flex-1">
            <span className="block text-white font-bold text-[15px] tracking-[-0.01em] leading-tight">The Solar House</span>
            <span className="block text-[11px] text-rail-idle leading-tight">Powered by Ovi</span>
          </span>
        )}
        <button
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          className={classNames('text-rail-idle hover:text-white rounded-lg hover:bg-white/5 w-7 h-7 flex items-center justify-center shrink-0', !expanded && 'mt-3')}
        >
          <ChevronRight size={16} className={expanded ? 'rotate-180' : ''} />
        </button>
      </div>

      {/* search */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('simplr-open-palette'))}
        title="Search (⌘K)"
        className={classNames(
          'mb-3 flex items-center text-rail-idle hover:text-white bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06] transition-colors',
          expanded ? 'h-9 rounded-[10px] px-2.5 gap-2 w-full' : 'w-10 h-10 rounded-[11px] justify-center',
        )}
      >
        <Search size={15} className="shrink-0" />
        {expanded && <><span className="text-[13px]">Search</span><kbd className="ml-auto text-[10.5px] font-semibold bg-white/[0.08] rounded px-1.5 py-0.5">⌘K</kbd></>}
      </button>

      {/* areas */}
      <div className={classNames('flex-1 flex flex-col', expanded ? 'overflow-y-auto no-scrollbar -mx-1 px-1 gap-0.5' : 'gap-1.5 items-center')}>
        {areas.map((s) =>
          expanded && s.groups.flatMap((g) => g.items).length === 1 ? (
            <DirectLink key={s.id} s={s} badge={badgeFor(s.to)} />
          ) : expanded ? (
            <AreaSection key={s.id} s={s} active={s.id === activeId} open={open.includes(s.id)} onToggle={() => toggle(s.id)} badgeFor={badgeFor} />
          ) : (
            <AreaIcon key={s.id} s={s} active={s.id === activeId} badge={areaBadge(s)} badgeFor={badgeFor} />
          ),
        )}
      </div>

      {/* footer */}
      <div className={classNames('mt-3 pt-3 border-t border-white/10 flex flex-col gap-1', !expanded && 'items-center')}>
        {currentRole === 'owner' && (
          <NavLink
            to="/settings"
            title={expanded ? undefined : 'Settings'}
            className={({ isActive }) => classNames('flex items-center transition-colors', expanded ? 'h-9 rounded-[10px] px-2 gap-2.5' : 'w-10 h-10 rounded-[11px] justify-center', isActive ? 'text-white bg-white/[0.08]' : 'text-rail-idle hover:text-white hover:bg-white/[0.06]')}
          >
            <Gear size={18} className="shrink-0" />
            {expanded && <span className="text-[13px] font-medium">Settings</span>}
          </NavLink>
        )}
        <div className={classNames('flex items-center', expanded ? 'px-2 py-1.5 gap-2.5' : 'justify-center mt-1')}>
          <div className="w-[32px] h-[32px] rounded-full bg-[#2A3546] text-[#C6CEDB] flex items-center justify-center text-[12px] font-semibold shrink-0" title={roleByKey(currentRole).label}>JM</div>
          {expanded && (
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-white truncate">Jordan Miles</div>
              {/* Admin preview: see the app exactly as each role would */}
              <Dropdown value={currentRole} onChange={(e) => setRole(e.target.value as UserRole, true)} title="View the app as another role"
                className="w-full -ml-0.5 bg-transparent text-[11px] text-rail-idle hover:text-white outline-none cursor-pointer">
                {ROLES.map((r) => <option key={r.key} value={r.key} className="text-ink">{r.key === 'owner' ? `${r.label} (admin)` : `View as ${r.label}`}</option>)}
              </Dropdown>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

type BadgeFor = (to: string, badge?: number) => number | undefined

function AreaTile({ s, active, size = 26 }: { s: Stage; active: boolean; size?: number }) {
  return (
    <span
      className={classNames('rounded-[8px] flex items-center justify-center shrink-0 transition-colors', active ? 'text-white' : 'text-rail-idle group-hover:text-white')}
      style={{ width: size, height: size, background: active ? (s.id === 'ovi' ? BRAND_GRAD : s.accent) : 'transparent' }}
    >
      <s.icon size={size > 30 ? 19 : 16} />
    </span>
  )
}

/** An area with a single page (e.g. Inbox) — just a link, no expand/collapse. */
function DirectLink({ s, badge }: { s: Stage; badge?: number }) {
  return (
    <NavLink
      to={s.to}
      className={({ isActive }) => classNames('group h-9 rounded-[10px] px-1.5 flex items-center gap-2.5 transition-colors', isActive ? 'text-white' : 'text-[#B7C0CE] hover:text-white hover:bg-white/[0.04]')}
    >
      {({ isActive }) => (
        <>
          <AreaTile s={s} active={isActive} />
          <span className={classNames('flex-1 text-left text-[13.5px] truncate', isActive ? 'font-semibold' : 'font-medium')}>{s.name}</span>
          {badge != null && <span className="text-[10.5px] font-bold rounded-full min-w-[18px] h-[18px] px-1.5 flex items-center justify-center bg-[#62E4CC] text-[#15223B]">{badge}</span>}
        </>
      )}
    </NavLink>
  )
}

function AreaSection({ s, active, open, onToggle, badgeFor }: { s: Stage; active: boolean; open: boolean; onToggle: () => void; badgeFor: BadgeFor }) {
  return (
    <div className="flex flex-col">
      <button
        onClick={onToggle}
        className={classNames('group h-9 rounded-[10px] px-1.5 flex items-center gap-2.5 transition-colors', active ? 'text-white' : 'text-[#B7C0CE] hover:text-white hover:bg-white/[0.04]')}
      >
        <AreaTile s={s} active={active} />
        <span className={classNames('flex-1 text-left text-[13.5px] truncate', active ? 'font-semibold' : 'font-medium')}>{s.name}</span>
        <ChevronDown size={14} className={classNames('text-rail-idle transition-transform duration-150', !open && '-rotate-90')} />
      </button>
      {open && <PageList s={s} groups={s.groups} badgeFor={badgeFor} indent />}
    </div>
  )
}

function PageList({ s, groups, badgeFor, indent }: { s: Stage; groups: NavGroup[]; badgeFor: BadgeFor; indent?: boolean }) {
  const labelled = groups.length > 1
  return (
    <div className={classNames('flex flex-col pb-1.5', indent && 'ml-[18px] pl-3 border-l border-white/[0.07] mt-0.5 mb-1')}>
      {groups.map((g) => (
        <div key={g.label} className="flex flex-col">
          {labelled && <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5B6576] px-2 pt-2 pb-1">{g.label}</div>}
          {g.items.map((it) => {
            const badge = badgeFor(it.to, it.badge)
            return (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                className={({ isActive }) => classNames('relative h-8 rounded-[8px] px-2 flex items-center gap-2 text-[13px] transition-colors', isActive ? 'text-white bg-white/[0.08] font-semibold' : 'text-[#9AA4B4] hover:text-white hover:bg-white/[0.04]')}
              >
                {({ isActive }) => (
                  <>
                    {isActive && indent && <span className="absolute -left-[13px] top-1.5 bottom-1.5 w-[2px] rounded-full" style={{ background: s.id === 'ovi' ? '#1FAE94' : s.accent }} />}
                    <it.icon size={15} className="shrink-0 opacity-80" />
                    <span className="flex-1 truncate">{it.label}</span>
                    {badge != null && <span className="text-[10px] font-bold rounded-full min-w-[17px] h-[17px] px-1 flex items-center justify-center bg-white/[0.1] text-white">{badge}</span>}
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function AreaIcon({ s, active, badge, badgeFor }: { s: Stage; active: boolean; badge?: number; badgeFor: BadgeFor }) {
  return (
    <div className="group relative">
      <NavLink
        to={s.to}
        className={classNames('w-10 h-10 rounded-[11px] flex items-center justify-center transition-colors', !active && 'hover:bg-white/[0.06]')}
      >
        <span className="relative">
          <AreaTile s={s} active={active} size={34} />
          {badge != null && <span className="absolute -top-1 -right-1 text-[10px] font-bold text-white bg-negative rounded-full min-w-[15px] h-[15px] px-0.5 flex items-center justify-center ring-2 ring-rail">{badge}</span>}
        </span>
      </NavLink>
      {/* hover flyout — pl-2 bridges the gap so the pointer can travel into it */}
      <div className="absolute left-full top-0 pl-2 hidden group-hover:block z-50">
        <div className="w-[220px] rounded-xl p-2 shadow-modal border border-white/[0.08]" style={{ background: '#111A2C' }}>
          <div className="px-2 pt-1 pb-1.5 text-[13px] font-semibold text-white">{s.name}</div>
          <PageList s={s} groups={s.groups} badgeFor={badgeFor} />
        </div>
      </div>
    </div>
  )
}
