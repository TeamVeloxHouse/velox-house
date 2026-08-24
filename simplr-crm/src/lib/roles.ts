import type { UserRole } from '../store/types'

// The Admin assigns each user a role; the role decides which widgets fill their
// home dashboard. Roles are generic across trades (a solar or roofing company
// both have a Finance Director, an Operations Manager, etc.).
export interface RoleDef {
  key: UserRole
  label: string
  short: string // greeting suffix, e.g. "Here's your finances"
  blurb: string
  accent: string // hex
}

export const ROLES: RoleDef[] = [
  { key: 'owner', label: 'Owner / Admin', short: 'here’s the whole business at a glance', blurb: 'Full view — pipeline, revenue, operations & team', accent: '#1D4ED8' },
  { key: 'finance', label: 'Finance Director', short: 'here’s the money', blurb: 'Revenue, invoices, cash, margin & forecast', accent: '#0E9F6E' },
  { key: 'operations', label: 'Operations Manager', short: 'here’s the week ahead', blurb: 'Schedule, installs, crews & delivery', accent: '#E8721A' },
  { key: 'sales', label: 'Sales Manager', short: 'here’s your pipeline', blurb: 'Deals, leads, quota & activities', accent: '#3B6BF5' },
  { key: 'marketing', label: 'Marketing', short: 'here’s what’s driving leads', blurb: 'Campaigns, lead sources & outreach', accent: '#7C5CFF' },
  { key: 'engineer', label: 'Field Engineer', short: 'here’s your day', blurb: 'Your jobs, surveys & installs', accent: '#B01B4F' },
]

export const roleByKey = (key: UserRole): RoleDef => ROLES.find((r) => r.key === key) ?? ROLES[0]
