import {
  Grid, Bars, Bolt, Person, Calendar, Envelope, Pie, Box, Sparkle,
  Video, Robot, Target, Layers, File, Sun, Radar, Check, Dollar, Wrench,
  Users, Sliders, MapPin, Home,
} from './icons'
import type { FeatureKey, UserRole } from '../store/types'

// ── One nav model ────────────────────────────────────────────────────────────
// The sidebar lists areas; each area lists its pages. The Solar House app is deliberately kept to
// what's needed to RUN the business: leads → sales → design → delivery → customers. Finance, HR,
// marketing and operations back-office pages still exist in the code but are out of the app.
//
// Access: `roles` lists who may see an item (omitted = everyone). The Managing Director ('owner')
// is the admin and sees everything; other roles get a focused view.

export type NavItem = {
  to: string
  icon: (p: { size?: number; className?: string }) => JSX.Element
  label: string
  end?: boolean
  badge?: number
  feature?: FeatureKey
  roles?: UserRole[]
}
export type NavGroup = { label: string; items: NavItem[] }

export type Stage = {
  id: string
  name: string
  desc: string
  icon: (p: { size?: number; className?: string }) => JSX.Element
  to: string // default landing page for the area
  accent: string
  wash: string
  feature?: FeatureKey
  roles?: UserRole[]
  groups: NavGroup[]
}

export const BRAND_GRAD = 'linear-gradient(135deg,#1FAE94 0%,#159C86 100%)'

// Who sees what
const MD: UserRole[] = ['owner']
const MGMT: UserRole[] = ['owner', 'finance']
const SELLING: UserRole[] = ['owner', 'sales']
const OPS: UserRole[] = ['owner', 'operations', 'engineer']
const NOT_INSTALLER: UserRole[] = ['owner', 'finance', 'operations', 'sales']

export const STAGES: Stage[] = [
  {
    id: 'mywork', name: 'My Work', desc: 'Your day, tasks & meetings', icon: Check, to: '/',
    accent: '#159C86', wash: '#E8FAF5',
    groups: [
      { label: 'Me', items: [
        { to: '/', icon: Grid, label: 'My Day', end: true },
        { to: '/tasks', icon: Check, label: 'My Tasks' },
        { to: '/meetings', icon: Video, label: 'Meetings', roles: NOT_INSTALLER },
        { to: '/team', icon: Users, label: 'Team chat' },
      ] },
    ],
  },
  {
    id: 'inbox', name: 'Inbox', desc: 'Every customer conversation', icon: Envelope, to: '/inbox',
    accent: '#13927B', wash: '#E3F4EF', roles: NOT_INSTALLER,
    groups: [{ label: 'Inbox', items: [{ to: '/inbox', icon: Envelope, label: 'Inbox' }] }],
  },
  {
    id: 'ovi', name: 'Ovi', desc: 'Your AI operator', icon: Sparkle, to: '/ai',
    accent: '#159C86', wash: '#E8FAF5',
    groups: [
      { label: 'Operator', items: [
        { to: '/ai', icon: Robot, label: 'Ask Ovi' },
        { to: '/agents', icon: Robot, label: 'Automations', roles: MD },
      ] },
    ],
  },
  {
    id: 'leads', name: 'Leads', desc: 'New homeowners & targeting', icon: Radar, to: '/leads',
    accent: '#1FAE94', wash: '#E6F8F2', roles: SELLING,
    groups: [
      { label: 'Leads', items: [
        { to: '/leads', icon: Bolt, label: 'Lead inbox', badge: 8 },
        { to: '/tools/database', icon: Layers, label: 'All prospects', feature: 'reach' },
        { to: '/tools', icon: Grid, label: 'Lead tools', feature: 'reach', end: true },
      ] },
    ],
  },
  {
    id: 'close', name: 'Sales', desc: 'Pipeline & customers', icon: Target, to: '/deals',
    accent: '#059669', wash: '#E7F6F1', roles: NOT_INSTALLER,
    groups: [
      { label: 'Sales', items: [
        { to: '/deals', icon: Bars, label: 'Deals' },
        { to: '/forecast', icon: Target, label: 'Forecast', roles: MGMT },
        { to: '/insights', icon: Pie, label: 'Insights', roles: MGMT },
      ] },
    ],
  },
  {
    id: 'design', name: 'Design', desc: 'Solar design, pricing & proposals', icon: Sun, to: '/design',
    accent: '#0E9A82', wash: '#E7F7F2', roles: SELLING,
    groups: [
      { label: 'Design', items: [
        { to: '/design', icon: Sun, label: 'Design Studio', feature: 'studio', end: true },
        { to: '/design/whole-home', icon: Sparkle, label: 'Whole-home', feature: 'studio' },
        { to: '/studio/ev', icon: Bolt, label: 'EV charging', feature: 'studio' },
        { to: '/studio/proposals', icon: Layers, label: 'Proposals', feature: 'studio' },
        { to: '/studio/pricing', icon: Dollar, label: 'Pricing & finance', feature: 'studio', roles: MD },
        { to: '/products', icon: Box, label: 'Products', roles: MD },
        { to: '/studio/brand', icon: File, label: 'Brand & documents', feature: 'studio', roles: MD },
      ] },
    ],
  },
  {
    id: 'deliver', name: 'Delivery', desc: 'Contract to handover', icon: Wrench, to: '/installs',
    accent: '#0A8F79', wash: '#E6F5F0', roles: ['owner', 'finance', 'operations', 'engineer'],
    groups: [
      { label: 'Delivery', items: [
        { to: '/installs', icon: Wrench, label: 'Installs', end: true },
        { to: '/studio/surveys', icon: MapPin, label: 'Site surveys', roles: OPS },
        { to: '/studio/dno', icon: Bolt, label: 'DNO applications', roles: ['owner', 'operations'] },
        { to: '/installs/analytics', icon: Pie, label: 'Delivery analytics', roles: ['owner', 'finance', 'operations'] },
      ] },
    ],
  },
  {
    id: 'customers', name: 'Customers', desc: 'Showroom, portals & aftercare', icon: Users, to: '/showroom',
    accent: '#0FA98F', wash: '#E8FAF5', roles: NOT_INSTALLER,
    groups: [
      { label: 'Showroom', items: [
        { to: '/showroom', icon: Sun, label: 'Showroom', end: true, roles: SELLING },
        { to: '/showroom/calendar', icon: Calendar, label: 'Booking calendar', roles: SELLING },
        { to: '/showroom/analytics', icon: Pie, label: 'Showroom analytics', roles: MGMT },
      ] },
      { label: 'Portals & aftercare', items: [
        { to: '/customers', icon: Users, label: 'Customer portals', end: true },
        { to: '/customers/analytics', icon: Pie, label: 'Portal analytics', roles: ['owner', 'operations'] },
        { to: '/customers/builder', icon: Sliders, label: 'Portal builder', roles: MD },
        { to: '/customers/support', icon: Wrench, label: 'Support requests' },
        { to: '/customers/resources', icon: File, label: 'Resources & manuals' },
      ] },
    ],
  },
]

export const stageById = (id: string) => STAGES.find((s) => s.id === id) ?? STAGES[0]

const rootFallbacks: [string, string][] = [
  ['/reach', 'inbox'], ['/activities', 'mywork'],
  ['/tools', 'leads'], ['/design', 'design'], ['/studio', 'design'], ['/installs', 'deliver'], ['/customers', 'customers'], ['/showroom', 'customers'],
]

/** Which area owns a path — the stage with the longest matching nav item, else a root fallback. */
export function stageForPath(path: string): string {
  let best = '', bestLen = -1
  for (const s of STAGES) {
    for (const g of s.groups) for (const it of g.items) {
      const to = it.to
      const match = to === '/' ? path === '/' : path === to || path.startsWith(to + '/')
      if (match && to.length > bestLen) { best = s.id; bestLen = to.length }
    }
  }
  if (best) return best
  return rootFallbacks.find(([p]) => path.startsWith(p))?.[1] ?? 'close'
}

/** Can this role open this path? Uses the most specific nav item (and its area) that owns the path.
 *  Pages that aren't in the nav at all (e.g. a deal record) inherit their area's access. */
export function canAccess(path: string, role: UserRole): boolean {
  if (role === 'owner') return true
  if (path.startsWith('/settings')) return false
  let item: NavItem | undefined, area: Stage | undefined, bestLen = -1
  for (const s of STAGES) for (const g of s.groups) for (const it of g.items) {
    const match = it.to === '/' ? path === '/' : path === it.to || path.startsWith(it.to + '/')
    if (match && it.to.length > bestLen) { item = it; area = s; bestLen = it.to.length }
  }
  // /deals/:id — the customer record. Everyone may open it (installers need its Delivery tab).
  if (/^\/deals\/[^/]+/.test(path)) return true
  const okArea = !area?.roles || area.roles.includes(role)
  const okItem = !item?.roles || item.roles.includes(role)
  return okArea && okItem
}
