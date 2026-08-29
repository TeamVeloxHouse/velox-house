import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Grid, Bars, Bolt, Person, Building, Calendar, Envelope, Pie, Gear, ChevronRight, ChevronDown,
  Box, Flow, Megaphone, Sparkle, Video, Robot, Target, Layers, File, Sun, Radar, Search, Send, Check, Clock, Dollar, Wrench, Users, Sliders, Star,
} from './icons'
import { classNames } from '../lib/format'
import { useState_ } from '../store/store'
import type { FeatureKey } from '../store/types'

type Item = { to: string; icon: (p: { size?: number; className?: string }) => JSX.Element; label: string; end?: boolean; badge?: number; feature?: FeatureKey }
type Group = { label: string; items: Item[] }

const crmGroups: Group[] = [
  { label: 'Workspace', items: [
    { to: '/', icon: Grid, label: 'Home', end: true },
    { to: '/tasks', icon: Check, label: 'My Tasks' },
    { to: '/team', icon: Users, label: 'Team' },
    { to: '/agents', icon: Robot, label: 'Automations' },
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
    { to: '/activities', icon: Bars, label: 'Activities', badge: 6 },
    { to: '/calendar', icon: Calendar, label: 'Calendar' },
    { to: '/meetings', icon: Video, label: 'Meetings' },
    { to: '/inbox', icon: Envelope, label: 'Sales Inbox' },
    { to: '/linkedin', icon: Person, label: 'LinkedIn' },
  ] },
  { label: 'Operations', items: [
    { to: '/jobs', icon: Wrench, label: 'Jobs', feature: 'jobs' },
  ] },
  { label: 'Deliver', items: [
    { to: '/projects', icon: Flow, label: 'Projects' },
    { to: '/products', icon: Box, label: 'Products' },
    { to: '/documents', icon: File, label: 'Documents' },
  ] },
  { label: 'Analyse', items: [{ to: '/insights', icon: Pie, label: 'Insights' }] },
]

const reachGroups: Group[] = [
  { label: 'Overview', items: [{ to: '/reach', icon: Grid, label: 'Overview', end: true }, { to: '/team', icon: Users, label: 'Team' }] },
  { label: 'Find', items: [
    { to: '/reach/finders', icon: Radar, label: 'Finders' },
    { to: '/reach/people-finder', icon: Person, label: 'People finder' },
    { to: '/reach/solar', icon: Sun, label: 'Solar finder' },
    { to: '/reach/prospects', icon: Search, label: 'B2B prospects' },
  ] },
  { label: 'Engage', items: [
    { to: '/reach/outreach', icon: Send, label: 'Outreach' },
    { to: '/reach/campaigns', icon: Megaphone, label: 'Campaigns' },
    { to: '/reach/email', icon: Envelope, label: 'Email' },
    { to: '/reach/linkedin', icon: Person, label: 'LinkedIn' },
  ] },
  { label: 'Automate', items: [
    { to: '/reach/schedules', icon: Clock, label: 'Scheduled tasks' },
  ] },
  { label: 'Measure', items: [{ to: '/reach/analytics', icon: Pie, label: 'Analytics' }] },
]

const studioGroups: Group[] = [
  { label: 'Overview', items: [{ to: '/studio', icon: Grid, label: 'Overview', end: true }, { to: '/team', icon: Users, label: 'Team' }] },
  { label: 'Design', items: [
    { to: '/studio/design', icon: Sun, label: 'Design Studio' },
    { to: '/studio/brand', icon: File, label: 'Brand & Documents' },
    { to: '/studio/templates', icon: File, label: 'Templates' },
  ] },
  { label: 'Sell', items: [
    { to: '/studio/proposals', icon: Layers, label: 'Proposals' },
    { to: '/studio/pricing', icon: Dollar, label: 'Pricing & finance' },
  ] },
  { label: 'Calculators', items: [
    { to: '/studio/ev', icon: Bolt, label: 'EV charging' },
  ] },
  { label: 'Deliver', items: [{ to: '/studio/delivery', icon: Flow, label: 'Delivery' }] },
  { label: 'Measure', items: [{ to: '/studio/analytics', icon: Pie, label: 'Analytics' }] },
]

// ── Department workspaces (the whole-workforce layer) — full apps, not CRM pages ──
const financeGroups: Group[] = [
  { label: 'Overview', items: [{ to: '/finance', icon: Grid, label: 'Overview', end: true }, { to: '/team', icon: Users, label: 'Team' }] },
  { label: 'Money', items: [
    { to: '/finance/invoices', icon: File, label: 'Invoices' },
    { to: '/finance/expenses', icon: Dollar, label: 'Expenses' },
  ] },
  { label: 'Plan', items: [
    { to: '/finance/forecasting', icon: Pie, label: 'Forecasting' },
    { to: '/finance/reports', icon: Layers, label: 'Reports' },
  ] },
]
const opsGroups: Group[] = [
  { label: 'Overview', items: [{ to: '/operations', icon: Grid, label: 'Overview', end: true }, { to: '/team', icon: Users, label: 'Team' }] },
  { label: 'Field', items: [
    { to: '/operations/schedule', icon: Calendar, label: 'Schedule' },
    { to: '/operations/stock', icon: Box, label: 'Stock' },
  ] },
  { label: 'Procure', items: [
    { to: '/operations/purchase-orders', icon: File, label: 'Purchase orders' },
    { to: '/operations/safety', icon: Check, label: 'Safety & RAMS' },
  ] },
]
const hrGroups: Group[] = [
  { label: 'Overview', items: [{ to: '/hr', icon: Grid, label: 'Overview', end: true }, { to: '/team', icon: Users, label: 'Team' }] },
  { label: 'People', items: [
    { to: '/hr/people', icon: Person, label: 'Directory' },
    { to: '/hr/leave', icon: Calendar, label: 'Leave' },
  ] },
  { label: 'Compliance', items: [
    { to: '/hr/policies', icon: File, label: 'Policies' },
    { to: '/hr/compliance', icon: Check, label: 'Certifications' },
  ] },
]
const marketingGroups: Group[] = [
  { label: 'Overview', items: [{ to: '/marketing', icon: Grid, label: 'Overview', end: true }, { to: '/team', icon: Users, label: 'Team' }] },
  { label: 'Brand', items: [
    { to: '/marketing/brand', icon: Layers, label: 'Brand Hub' },
    { to: '/marketing/assets', icon: Box, label: 'Assets' },
  ] },
  { label: 'Plan', items: [
    { to: '/marketing/content', icon: Calendar, label: 'Content' },
    { to: '/marketing/campaigns', icon: Megaphone, label: 'Campaigns' },
  ] },
  { label: 'Engage', items: [
    { to: '/marketing/social', icon: Send, label: 'Social' },
    { to: '/marketing/reviews', icon: Star, label: 'Reviews' },
    { to: '/marketing/requests', icon: Envelope, label: 'Requests' },
  ] },
  { label: 'Connect', items: [{ to: '/marketing/connectors', icon: Flow, label: 'Connectors' }] },
  { label: 'Measure', items: [{ to: '/marketing/reports', icon: Pie, label: 'Reports' }] },
]
const deliveryGroups: Group[] = [
  { label: 'Overview', items: [{ to: '/delivery', icon: Grid, label: 'Overview', end: true }, { to: '/team', icon: Users, label: 'Team' }] },
  { label: 'Field', items: [
    { to: '/delivery/installs', icon: Box, label: 'Installs' },
    { to: '/delivery/field', icon: Wrench, label: 'Field jobs' },
  ] },
  { label: 'Handover', items: [
    { to: '/delivery/certificates', icon: File, label: 'Certificates' },
    { to: '/delivery/service', icon: Flow, label: 'Service' },
  ] },
]

const workspaces = [
  { id: 'crm', name: 'TellOvi CRM', desc: 'Pipeline & customers', to: '/', icon: Bars, grad: 'linear-gradient(180deg,#3B6BF5 0%,#1D4ED8 100%)', feature: undefined as FeatureKey | undefined },
  { id: 'reach', name: 'TellOvi Reach', desc: 'Prospecting & outreach', to: '/reach', icon: Radar, grad: 'linear-gradient(180deg,#7C5CFF 0%,#5B29CC 100%)', feature: 'reach' as FeatureKey },
  { id: 'studio', name: 'TellOvi Studio', desc: 'Design & proposals', to: '/studio', icon: Sun, grad: 'linear-gradient(180deg,#F5A623 0%,#E8721A 100%)', feature: 'studio' as FeatureKey },
  { id: 'finance', name: 'TellOvi Finance', desc: 'Money & forecasting', to: '/finance', icon: Dollar, grad: 'linear-gradient(180deg,#10B981 0%,#0E7C66 100%)', feature: undefined as FeatureKey | undefined },
  { id: 'operations', name: 'TellOvi Operations', desc: 'Scheduling & stock', to: '/operations', icon: Sliders, grad: 'linear-gradient(180deg,#64748B 0%,#334155 100%)', feature: undefined as FeatureKey | undefined },
  { id: 'hr', name: 'TellOvi People', desc: 'HR & compliance', to: '/hr', icon: Person, grad: 'linear-gradient(180deg,#6366F1 0%,#4338CA 100%)', feature: undefined as FeatureKey | undefined },
  { id: 'marketing', name: 'TellOvi Marketing', desc: 'Brand & content ops', to: '/marketing', icon: Megaphone, grad: 'linear-gradient(180deg,#F43F5E 0%,#BE123C 100%)', feature: undefined as FeatureKey | undefined },
  { id: 'delivery', name: 'TellOvi Delivery', desc: 'Installs & handover', to: '/delivery', icon: Box, grad: 'linear-gradient(180deg,#06B6D4 0%,#0E7490 100%)', feature: undefined as FeatureKey | undefined },
]

// Path prefix → workspace id (longest-specific first; CRM is the fallback).
const wsPrefixes: [string, string][] = [
  ['/reach', 'reach'], ['/studio', 'studio'], ['/finance', 'finance'],
  ['/operations', 'operations'], ['/hr', 'hr'], ['/marketing', 'marketing'], ['/delivery', 'delivery'],
]
const groupsById: Record<string, Group[]> = {
  crm: crmGroups, reach: reachGroups, studio: studioGroups,
  finance: financeGroups, operations: opsGroups, hr: hrGroups, marketing: marketingGroups, delivery: deliveryGroups,
}
const activeFillById: Record<string, string> = {
  crm: 'bg-white/10', reach: 'bg-[#5B29CC]/25', studio: 'bg-[#E8721A]/30',
  finance: 'bg-[#0E7C66]/35', operations: 'bg-white/10', hr: 'bg-[#4338CA]/40', marketing: 'bg-[#BE123C]/30', delivery: 'bg-[#0E7490]/40',
}

function itemClasses(expanded: boolean, accent: string) {
  return (isActive: boolean) =>
    classNames(
      'group relative flex items-center transition-colors duration-150',
      expanded ? 'h-9 rounded-[9px] px-2.5 gap-3' : 'w-11 h-11 rounded-[12px] justify-center',
      isActive ? 'text-white' : 'text-rail-idle hover:text-white/90 hover:bg-white/5',
    ) + (isActive ? ` ${accent}` : '')
}

function Tooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-[52px] px-2 py-1 rounded-md bg-ink text-white text-[12px] font-medium opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 whitespace-nowrap z-50 shadow-modal">{label}</span>
  )
}

export function Rail() {
  const location = useLocation()
  const nav = useNavigate()
  const { features, teamChannels } = useState_()
  const teamUnread = teamChannels.reduce((s, c) => s + c.unread, 0)
  const wsId = wsPrefixes.find(([p]) => location.pathname.startsWith(p))?.[1] ?? 'crm'
  const ws = workspaces.find((w) => w.id === wsId) ?? workspaces[0]
  const isReach = wsId === 'reach'
  const isStudio = wsId === 'studio'
  // Trade profile decides which workspaces + nav items are switched on.
  const availableWorkspaces = workspaces.filter((w) => !w.feature || features[w.feature])
  const groups = (groupsById[wsId] ?? crmGroups)
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.feature || features[it.feature]).map((it) => (it.to === '/team' && teamUnread > 0 ? { ...it, badge: teamUnread } : it)) }))
    .filter((g) => g.items.length > 0)
  const activeFill = activeFillById[wsId] ?? 'bg-white/10'

  const [expanded, setExpanded] = useState(() => (typeof localStorage !== 'undefined' ? localStorage.getItem('simplr.rail') !== '0' : true))
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('simplr.railGroups') || '[]')) } catch { return new Set() }
  })
  const [switcher, setSwitcher] = useState(false)
  const swRef = useRef<HTMLDivElement>(null)
  useEffect(() => { localStorage.setItem('simplr.rail', expanded ? '1' : '0') }, [expanded])
  useEffect(() => { localStorage.setItem('simplr.railGroups', JSON.stringify([...collapsed])) }, [collapsed])
  useEffect(() => {
    const h = (e: MouseEvent) => { if (swRef.current && !swRef.current.contains(e.target as Node)) setSwitcher(false) }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [])

  function toggleGroup(label: string) {
    setCollapsed((c) => { const n = new Set(c); n.has(label) ? n.delete(label) : n.add(label); return n })
  }

  return (
    <nav className={classNames('shrink-0 bg-rail flex flex-col py-4 transition-[width] duration-200 ease-out overflow-visible', expanded ? 'w-[228px] px-3' : 'w-[76px] px-0 items-center')}>
      {/* workspace switcher */}
      <div ref={swRef} className={classNames('relative mb-4', !expanded && 'flex flex-col items-center')}>
        <div className={classNames('flex items-center', expanded ? 'gap-2' : 'flex-col')}>
          <button onClick={() => setSwitcher((o) => !o)} className={classNames('flex items-center min-w-0', expanded ? 'flex-1 gap-2.5 px-1.5 py-1 rounded-lg hover:bg-white/5' : 'justify-center')} title={ws.name}>
            <span className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center text-white font-bold text-[15px] shrink-0" style={{ background: ws.grad }}>S</span>
            {expanded && (
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-white font-bold text-[14px] tracking-[-0.01em] truncate">{ws.name}</span>
                <span className="block text-[11px] text-rail-idle truncate">{ws.desc}</span>
              </span>
            )}
            {expanded && <ChevronDown size={15} className="text-rail-idle shrink-0" />}
          </button>
          {expanded && (
            <button onClick={() => setExpanded(false)} title="Collapse" className="text-rail-idle hover:text-white rounded-lg hover:bg-white/5 w-7 h-7 flex items-center justify-center shrink-0"><ChevronRight size={16} className="rotate-180" /></button>
          )}
          {!expanded && (
            <button onClick={() => setExpanded(true)} title="Expand" className="text-rail-idle hover:text-white rounded-lg hover:bg-white/5 w-7 h-7 flex items-center justify-center mt-3"><ChevronRight size={16} /></button>
          )}
        </div>
        {switcher && (
          <div className={classNames('absolute z-[60] mt-2 bg-surface rounded-overlay shadow-modal border border-border overflow-hidden', expanded ? 'left-0 right-0' : 'left-[52px] top-0 w-56')}>
            <div className="px-3 py-2 eyebrow text-muted-3 border-b border-divider">Switch workspace</div>
            {availableWorkspaces.map((w) => {
              const on = w.id === ws.id
              return (
                <button key={w.id} onClick={() => { nav(w.to); setSwitcher(false) }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-control border-b border-divider last:border-0">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: w.grad }}><w.icon size={16} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-ink-2">{w.name}</span><span className="block text-[12px] text-muted-2">{w.desc}</span></span>
                  {on && <Check size={15} className="text-accent shrink-0" />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* featured: TellOvi AI (CRM only) */}
      {wsId === 'crm' && (
        <NavLink to="/ai" title={expanded ? undefined : 'TellOvi AI'} className={({ isActive }) => classNames('group relative flex items-center mb-3 transition-all duration-150', expanded ? 'h-10 rounded-[10px] px-2.5 gap-3' : 'w-11 h-11 rounded-[12px] justify-center', isActive ? 'bg-accent-gradient text-white shadow-primary' : 'text-white bg-white/[0.06] hover:bg-white/10 ring-1 ring-inset ring-white/10')}>
          <Sparkle size={19} className="shrink-0" />
          {expanded && <span className="text-[13.5px] font-semibold flex-1 truncate">TellOvi AI</span>}
          {expanded && <span className="eyebrow text-[9px] bg-white/20 rounded px-1.5 py-0.5">AI</span>}
          {!expanded && <Tooltip label="TellOvi AI" />}
        </NavLink>
      )}

      {/* featured: Reach AI operator (Reach only) */}
      {isReach && (
        <NavLink to="/reach/ai" title={expanded ? undefined : 'Reach AI'} className={({ isActive }) => classNames('group relative flex items-center mb-3 transition-all duration-150', expanded ? 'h-10 rounded-[10px] px-2.5 gap-3' : 'w-11 h-11 rounded-[12px] justify-center', isActive ? 'text-white shadow-primary' : 'text-white bg-white/[0.06] hover:bg-white/10 ring-1 ring-inset ring-white/10')} style={({ isActive }) => (isActive ? { background: 'linear-gradient(180deg,#7C5CFF 0%,#5B29CC 100%)' } : {})}>
          <Sparkle size={19} className="shrink-0" />
          {expanded && <span className="text-[13.5px] font-semibold flex-1 truncate">Reach AI</span>}
          {expanded && <span className="eyebrow text-[9px] bg-white/20 rounded px-1.5 py-0.5">Operator</span>}
          {!expanded && <Tooltip label="Reach AI" />}
        </NavLink>
      )}

      {/* grouped nav */}
      <div className="flex-1 overflow-y-auto overflow-x-visible -mx-1 px-1 flex flex-col gap-0.5">
        {groups.map((g, gi) => {
          const isCollapsed = collapsed.has(g.label)
          const single = g.items.length === 1 && (g.label === 'Overview' || g.label === 'Analyse' || g.label === 'Measure')
          return (
            <div key={g.label} className={classNames(!expanded && gi > 0 && 'w-full flex flex-col items-center')}>
              {expanded && !single ? (
                <button onClick={() => toggleGroup(g.label)} className="w-full flex items-center gap-1 px-2.5 pt-3 pb-1 group/head">
                  <span className="eyebrow text-[10px] text-rail-idle/70 group-hover/head:text-rail-idle flex-1 text-left transition-colors">{g.label}</span>
                  <ChevronDown size={13} className={classNames('text-rail-idle/60 transition-transform duration-150', isCollapsed && '-rotate-90')} />
                </button>
              ) : (
                !expanded && gi > 0 && <div className="w-8 h-px bg-white/10 my-2 mx-auto" />
              )}
              {(!isCollapsed || !expanded || single) && (
                <div className={classNames('flex flex-col gap-0.5', !expanded && 'items-center gap-1.5')}>
                  {g.items.map((it) => (
                    <NavLink key={it.to} to={it.to} end={it.end} title={expanded ? undefined : it.label} className={({ isActive }) => classNames(itemClasses(expanded, activeFill)(isActive))}>
                      <it.icon size={19} className="shrink-0" />
                      {expanded && <span className="text-[13.5px] font-medium flex-1 truncate">{it.label}</span>}
                      {it.badge != null && (expanded
                        ? <span className="text-[11px] font-bold text-white bg-accent rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">{it.badge}</span>
                        : <span className="absolute top-1 right-1 text-[10px] font-bold text-white bg-accent rounded-full min-w-[15px] h-[15px] px-0.5 flex items-center justify-center">{it.badge}</span>)}
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
        <NavLink to="/settings" title={expanded ? undefined : 'Settings'} className={({ isActive }) => classNames(itemClasses(expanded, activeFill)(isActive))}>
          <Gear size={19} className="shrink-0" />
          {expanded && <span className="text-[13.5px] font-medium">Settings</span>}
          {!expanded && <Tooltip label="Settings" />}
        </NavLink>
        <div className={classNames('flex items-center', expanded ? 'px-2.5 py-1.5 gap-2.5' : 'justify-center mt-1')}>
          <div className="w-[34px] h-[34px] rounded-full bg-[#2A3546] text-[#C6CEDB] flex items-center justify-center text-[12px] font-semibold shrink-0">JM</div>
          {expanded && <div className="min-w-0"><div className="text-[13px] font-semibold text-white truncate">Jordan Miles</div><div className="text-[11px] text-rail-idle truncate">Account executive</div></div>}
        </div>
      </div>
    </nav>
  )
}
