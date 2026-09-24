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
  { key: 'owner', label: 'Managing Director', short: 'here’s the whole business at a glance', blurb: 'Admin · sees everything: pipeline, forecast, analytics, settings', accent: '#13927B' },
  { key: 'finance', label: 'Finance', short: 'here’s the money', blurb: 'Forecast, payments, delivery & sales analytics', accent: '#0E9F6E' },
  { key: 'operations', label: 'Operations', short: 'here’s the week ahead', blurb: 'Installs, DNO, surveys, portals & delivery analytics', accent: '#E8721A' },
  { key: 'sales', label: 'Sales adviser', short: 'here’s your pipeline', blurb: 'Leads, deals, showroom & design (no forecast or analytics)', accent: '#1FAE94' },

  { key: 'engineer', label: 'Installer', short: 'here’s your day', blurb: 'Your installs, surveys & tasks only', accent: '#B01B4F' },
]

export const roleByKey = (key: UserRole): RoleDef => ROLES.find((r) => r.key === key) ?? ROLES[0]
