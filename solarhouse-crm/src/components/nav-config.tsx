import {
  Grid, Bars, Bolt, Person, Building, Calendar, Envelope, Pie, Box, Flow, Megaphone, Sparkle,
  Video, Robot, Target, Layers, File, Sun, Radar, Send, Check, Clock, Dollar, Wrench,
  Users, Sliders, Star, MapPin, Home,
} from './icons'
import type { FeatureKey } from '../store/types'

// ── One nav model, two axes ──────────────────────────────────────────────────
// The LEFT RAIL owns the *areas* (lifecycle stages). The TOP NAV owns the *flow
// within an area* (its pages, read left-to-right). Both read from this file so
// they can never drift. Every route below already exists — this only regroups.

export type NavItem = {
  to: string
  icon: (p: { size?: number; className?: string }) => JSX.Element
  label: string
  end?: boolean
  badge?: number
  feature?: FeatureKey
}
export type NavGroup = { label: string; items: NavItem[] }

// Each stage carries its own restrained accent. The primary flow (Find→Design)
// walks blue→violet; Close/Deliver/Business get emerald/amber/slate so sections
// are instantly distinguishable, yet the whole set reads as one cool brand.
export type Stage = {
  id: string
  name: string
  desc: string
  icon: (p: { size?: number; className?: string }) => JSX.Element
  to: string // default landing page for the area
  accent: string // solid hue used only for the active indicator + tab underline
  wash: string // faint tint for the active-tab background
  feature?: FeatureKey
  groups: NavGroup[]
}

export const BRAND_GRAD = 'linear-gradient(135deg,#1FAE94 0%,#159C86 100%)'

export const STAGES: Stage[] = [
  // Personal — everyone in the company gets their own day here (not just sales).
  {
    id: 'mywork', name: 'My Work', desc: 'Your day, tasks & meetings', icon: Check, to: '/',
    accent: '#159C86', wash: '#E8FAF5',
    groups: [
      { label: 'Me', items: [
        { to: '/', icon: Grid, label: 'My Day', end: true },
        { to: '/tasks', icon: Check, label: 'My Tasks' },
        { to: '/meetings', icon: Video, label: 'Meetings' },
        { to: '/calendar', icon: Calendar, label: 'Calendar' },
        { to: '/team', icon: Users, label: 'Team chat' },
      ] },
    ],
  },
  // One inbox for every customer channel — a single link, not a section.
  {
    id: 'inbox', name: 'Inbox', desc: 'Every customer conversation', icon: Envelope, to: '/inbox',
    accent: '#13927B', wash: '#E3F4EF',
    groups: [{ label: 'Inbox', items: [{ to: '/inbox', icon: Envelope, label: 'Inbox' }] }],
  },
  {
    id: 'ovi', name: 'Ovi', desc: 'Your AI operator', icon: Sparkle, to: '/ai',
    accent: '#159C86', wash: '#E8FAF5',
    groups: [
      { label: 'Operator', items: [
        { to: '/ai', icon: Robot, label: 'Ask Ovi' },
        { to: '/agents', icon: Robot, label: 'Automations' },
      ] },
    ],
  },
  // Leads = where new homeowners come from (was Find): inbound leads + targeting tools.
  {
    id: 'leads', name: 'Leads', desc: 'New homeowners & targeting', icon: Radar, to: '/leads',
    accent: '#1FAE94', wash: '#E6F8F2',
    groups: [
      { label: 'Leads', items: [
        { to: '/leads', icon: Bolt, label: 'Lead inbox', badge: 8 },
        { to: '/tools/home-finder', icon: Home, label: 'Home Finder', feature: 'reach' },
        { to: '/tools/database', icon: Layers, label: 'All prospects', feature: 'reach' },
        { to: '/tools', icon: Grid, label: 'Lead tools', feature: 'reach', end: true },
      ] },
    ],
  },
  {
    id: 'design', name: 'Design', desc: 'Solar design & proposals', icon: Sun, to: '/design',
    accent: '#0E9A82', wash: '#E7F7F2',
    groups: [
      { label: 'Design', items: [
        { to: '/design', icon: Sun, label: 'Design Studio', feature: 'studio', end: true },
        { to: '/design/whole-home', icon: Sparkle, label: 'Whole-home', feature: 'studio' },
        { to: '/studio/proposals', icon: Layers, label: 'Proposals', feature: 'studio' },
        { to: '/studio/pricing', icon: Dollar, label: 'Pricing & finance', feature: 'studio' },
        { to: '/studio/ev', icon: Bolt, label: 'EV charging', feature: 'studio' },
        { to: '/studio/brand', icon: File, label: 'Brand & Documents', feature: 'studio' },
      ] },
    ],
  },
  {
    id: 'close', name: 'Sales', desc: 'Pipeline & customers', icon: Target, to: '/deals',
    accent: '#059669', wash: '#E7F6F1',
    groups: [
      { label: 'Sales', items: [
        { to: '/deals', icon: Bars, label: 'Deals' },
        { to: '/forecast', icon: Target, label: 'Forecast' },
        { to: '/people', icon: Person, label: 'Contacts' },
        { to: '/insights', icon: Pie, label: 'Insights' },
      ] },
    ],
  },
  {
    id: 'deliver', name: 'Deliver', desc: 'Install & customer care', icon: Wrench, to: '/studio/delivery',
    accent: '#0A8F79', wash: '#E6F5F0',
    groups: [
      { label: 'Install & handover', items: [
        { to: '/studio/delivery', icon: Flow, label: 'Delivery' },
        { to: '/studio/surveys', icon: MapPin, label: 'Site surveys' },
        { to: '/studio/dno', icon: Bolt, label: 'DNO applications' },
        { to: '/delivery/installs', icon: Box, label: 'Installs' },
        { to: '/delivery/field', icon: Wrench, label: 'Field jobs' },
        { to: '/delivery/certificates', icon: File, label: 'Certificates' },
        { to: '/jobs', icon: Wrench, label: 'Jobs', feature: 'jobs' },
      ] },
      { label: 'Projects', items: [
        { to: '/projects', icon: Flow, label: 'Projects' },
        { to: '/products', icon: Box, label: 'Products' },
        { to: '/documents', icon: File, label: 'Documents' },
      ] },
    ],
  },
  {
    id: 'customers', name: 'Customers', desc: 'Showroom, portals & aftercare', icon: Users, to: '/showroom',
    accent: '#0FA98F', wash: '#E8FAF5',
    groups: [
      { label: 'Sell & onboard', items: [
        { to: '/showroom', icon: Sun, label: 'Showroom', end: true },
        { to: '/showroom/calendar', icon: Calendar, label: 'Booking calendar' },
        { to: '/customers', icon: Users, label: 'Customer portals' },
      ] },
      { label: 'Aftercare', items: [
        { to: '/customers/support', icon: Wrench, label: 'Support requests' },
        { to: '/customers/resources', icon: File, label: 'Resources & manuals' },
      ] },
    ],
  },
  {
    id: 'business', name: 'Business', desc: 'Finance, ops & people', icon: Sliders, to: '/finance/invoices',
    accent: '#64748B', wash: '#EEF1F5',
    groups: [
      { label: 'Finance', items: [
        { to: '/finance/invoices', icon: File, label: 'Invoices' },
        { to: '/finance/expenses', icon: Dollar, label: 'Expenses' },
        { to: '/finance/forecasting', icon: Pie, label: 'Forecasting' },
        { to: '/finance/reports', icon: Layers, label: 'Reports' },
      ] },
      { label: 'Operations', items: [
        { to: '/operations/schedule', icon: Calendar, label: 'Schedule' },
        { to: '/operations/stock', icon: Box, label: 'Stock' },
        { to: '/operations/purchase-orders', icon: File, label: 'Purchase orders' },
        { to: '/operations/safety', icon: Check, label: 'Safety & RAMS' },
      ] },
      { label: 'People', items: [
        { to: '/hr/people', icon: Person, label: 'Directory' },
        { to: '/hr/leave', icon: Calendar, label: 'Leave' },
        { to: '/hr/policies', icon: File, label: 'Policies' },
        { to: '/hr/compliance', icon: Check, label: 'Certifications' },
      ] },
      { label: 'Marketing', items: [
        { to: '/marketing/brand', icon: Layers, label: 'Brand Hub' },
        { to: '/marketing/content', icon: Calendar, label: 'Content' },
        { to: '/marketing/campaigns', icon: Megaphone, label: 'Campaigns' },
        { to: '/marketing/social', icon: Send, label: 'Social' },
        { to: '/marketing/reviews', icon: Star, label: 'Reviews' },
        { to: '/marketing/reports', icon: Pie, label: 'Reports' },
      ] },
    ],
  },
]

export const stageById = (id: string) => STAGES.find((s) => s.id === id) ?? STAGES[0]

// Coarse section-root fallbacks when no nav item is an exact prefix (bare roots, detail pages).
const rootFallbacks: [string, string][] = [
  ['/reach', 'inbox'], ['/activities', 'mywork'],
  ['/tools', 'leads'], ['/design', 'design'], ['/studio', 'design'], ['/delivery', 'deliver'], ['/customers', 'customers'],
  ['/finance', 'business'], ['/operations', 'business'], ['/hr', 'business'], ['/marketing', 'business'],
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
