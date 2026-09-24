/* Placeholder sample data for the The Solar House prototype.
   All figures are sample values; currency + relative dates are derived in the UI. */

export type Health = 'Healthy' | 'At risk' | 'Stalled' | 'No next step'
// Stage names are now free-form — pipelines are configurable and per-industry.
// The list below stays as the seeded default pipeline / fallback.
export type StageName = string

export const stages: StageName[] = ['Qualified', 'Contact Made', 'Demo Scheduled', 'Proposal Made', 'Negotiations Started']
export const stageColors = ['#57C9B4', '#57C9B4', '#13927B', '#13927B', '#0E7C66']

export type Deal = {
  id: string
  name: string
  org: string
  subtitle: string
  value: number
  stage: StageName
  closeDate: string
  owner: string
  health: Health
  chips: { label: string; tone: 'accent' | 'warning' | 'neutral' | 'positive' | 'negative' }[]
  won?: boolean
}

export const deals: Deal[] = [
  { id: 'd1', name: 'Substation upgrade — Phase 2', org: 'Meridian Power', subtitle: 'Grid infrastructure', value: 148000, stage: 'Qualified', closeDate: 'Sep 30, 2026', owner: 'Jordan Miles', health: 'Healthy', chips: [{ label: 'Inbound', tone: 'accent' }] },
  { id: 'd2', name: 'EV charger rollout', org: 'Harbour Logistics', subtitle: 'Fleet electrification', value: 92000, stage: 'Qualified', closeDate: 'Oct 12, 2026', owner: 'Priya Nair', health: 'No next step', chips: [{ label: 'No next step', tone: 'warning' }] },
  { id: 'd3', name: 'Solar + storage install', org: 'Brightleaf Farms', subtitle: 'Renewables', value: 210000, stage: 'Contact Made', closeDate: 'Oct 3, 2026', owner: 'Jordan Miles', health: 'Healthy', chips: [{ label: 'Call today', tone: 'accent' }] },
  { id: 'd4', name: 'Backup generator retrofit', org: 'St. Aidan Hospital', subtitle: 'Critical power', value: 176000, stage: 'Contact Made', closeDate: 'Nov 8, 2026', owner: 'Marcus Webb', health: 'At risk', chips: [{ label: 'Stalled 14d', tone: 'negative' }] },
  { id: 'd5', name: 'LED lighting programme', org: 'Cavendish Retail', subtitle: 'Efficiency', value: 64000, stage: 'Demo Scheduled', closeDate: 'Sep 26, 2026', owner: 'Priya Nair', health: 'Healthy', chips: [{ label: 'Qualified', tone: 'positive' }] },
  { id: 'd6', name: 'HV cabling contract', org: 'Northgate Rail', subtitle: 'Infrastructure', value: 320000, stage: 'Demo Scheduled', closeDate: 'Dec 1, 2026', owner: 'Jordan Miles', health: 'Healthy', chips: [{ label: 'Multi-year', tone: 'accent' }] },
  { id: 'd7', name: 'Metering & monitoring', org: 'Ashford Utilities', subtitle: 'IoT / metering', value: 118000, stage: 'Proposal Made', closeDate: 'Sep 22, 2026', owner: 'Marcus Webb', health: 'At risk', chips: [{ label: 'Redlines in legal', tone: 'warning' }] },
  { id: 'd8', name: 'Campus microgrid', org: 'Fenwick University', subtitle: 'Microgrid', value: 268000, stage: 'Proposal Made', closeDate: 'Oct 20, 2026', owner: 'Priya Nair', health: 'Healthy', chips: [{ label: 'Champion engaged', tone: 'positive' }] },
  { id: 'd9', name: 'Data-centre UPS refresh', org: 'Cirrus Hosting', subtitle: 'Critical power', value: 415000, stage: 'Negotiations Started', closeDate: 'Sep 18, 2026', owner: 'Jordan Miles', health: 'Healthy', chips: [{ label: 'Redlines in legal', tone: 'warning' }, { label: 'Verbal yes', tone: 'positive' }] },
  { id: 'd10', name: 'Wind farm connection', org: 'Gale Renewables', subtitle: 'Grid connection', value: 512000, stage: 'Negotiations Started', closeDate: 'Oct 5, 2026', owner: 'Marcus Webb', health: 'At risk', chips: [{ label: 'Budget review', tone: 'warning' }] },
  { id: 'd11', name: 'Emergency lighting audit', org: 'Kingsway Offices', subtitle: 'Compliance', value: 38000, stage: 'Negotiations Started', closeDate: 'Sep 15, 2026', owner: 'Priya Nair', health: 'Healthy', won: true, chips: [{ label: 'Won', tone: 'positive' }] },
]

export type Lead = {
  id: string
  name: string
  role: string
  company: string
  source: string
  owner: string
  created: string
  score: number
}
export const leads: Lead[] = [
  { id: 'l1', name: 'Elena Voss', role: 'Facilities Director', company: 'Meridian Power', source: 'Website form', owner: 'Jordan Miles', created: '2h ago', score: 88 },
  { id: 'l2', name: 'Tom Reyes', role: 'Operations Lead', company: 'Harbour Logistics', source: 'LinkedIn', owner: 'Priya Nair', created: '5h ago', score: 76 },
  { id: 'l3', name: 'Dana Kirk', role: 'Estates Manager', company: 'Brightleaf Farms', source: 'Referral', owner: 'Jordan Miles', created: 'Yesterday', score: 71 },
  { id: 'l4', name: 'Owen Pryce', role: 'Head of Engineering', company: 'St. Aidan Hospital', source: 'Trade show', owner: 'Marcus Webb', created: 'Yesterday', score: 64 },
  { id: 'l5', name: 'Ruth Bello', role: 'Procurement', company: 'Cavendish Retail', source: 'Cold email', owner: 'Priya Nair', created: '2 days ago', score: 58 },
  { id: 'l6', name: 'Sam Idris', role: 'Sustainability Lead', company: 'Fenwick University', source: 'Website form', owner: 'Priya Nair', created: '3 days ago', score: 82 },
  { id: 'l7', name: 'Callum Reed', role: 'CTO', company: 'Cirrus Hosting', source: 'Inbound call', owner: 'Jordan Miles', created: '3 days ago', score: 91 },
  { id: 'l8', name: 'Nadia Frost', role: 'Project Manager', company: 'Northgate Rail', source: 'LinkedIn', owner: 'Marcus Webb', created: '4 days ago', score: 49 },
]

export type Person = {
  id: string
  name: string
  role: string
  org: string
  phone: string
  owner: string
  deals: number
  lastActivity: string
}
export const people: Person[] = [
  { id: 'p1', name: 'Elena Voss', role: 'Facilities Director', org: 'Meridian Power', phone: '+44 20 7946 0821', owner: 'Jordan Miles', deals: 2, lastActivity: 'Call · 2h ago' },
  { id: 'p2', name: 'Callum Reed', role: 'CTO', org: 'Cirrus Hosting', phone: '+44 161 496 0114', owner: 'Jordan Miles', deals: 1, lastActivity: 'Email · 4h ago' },
  { id: 'p3', name: 'Sam Idris', role: 'Sustainability Lead', org: 'Fenwick University', phone: '+44 191 498 0330', owner: 'Priya Nair', deals: 1, lastActivity: 'Meeting · Yesterday' },
  { id: 'p4', name: 'Owen Pryce', role: 'Head of Engineering', org: 'St. Aidan Hospital', phone: '+44 113 496 2201', owner: 'Marcus Webb', deals: 1, lastActivity: 'Note · 2 days ago' },
  { id: 'p5', name: 'Dana Kirk', role: 'Estates Manager', org: 'Brightleaf Farms', phone: '+44 1223 400 118', owner: 'Jordan Miles', deals: 1, lastActivity: 'Email · 3 days ago' },
  { id: 'p6', name: 'Nadia Frost', role: 'Project Manager', org: 'Northgate Rail', phone: '+44 121 496 7788', owner: 'Marcus Webb', deals: 1, lastActivity: 'Call · 5 days ago' },
  { id: 'p7', name: 'Ruth Bello', role: 'Procurement', org: 'Cavendish Retail', phone: '+44 20 7946 5540', owner: 'Priya Nair', deals: 1, lastActivity: 'Email · 6 days ago' },
]

export type Org = {
  id: string
  name: string
  industry: string
  people: number
  openValue: number
  wonLifetime: number
  owner: string
  relationship: 'Expanding' | 'At risk' | 'New' | 'Stable' | 'Renewal due'
}
export const orgs: Org[] = [
  { id: 'o1', name: 'Meridian Power', industry: 'Utilities', people: 6, openValue: 240000, wonLifetime: 890000, owner: 'Jordan Miles', relationship: 'Expanding' },
  { id: 'o2', name: 'Cirrus Hosting', industry: 'Data centres', people: 4, openValue: 415000, wonLifetime: 1240000, owner: 'Jordan Miles', relationship: 'Renewal due' },
  { id: 'o3', name: 'Fenwick University', industry: 'Education', people: 8, openValue: 268000, wonLifetime: 320000, owner: 'Priya Nair', relationship: 'New' },
  { id: 'o4', name: 'St. Aidan Hospital', industry: 'Healthcare', people: 5, openValue: 176000, wonLifetime: 540000, owner: 'Marcus Webb', relationship: 'At risk' },
  { id: 'o5', name: 'Northgate Rail', industry: 'Transport', people: 7, openValue: 320000, wonLifetime: 2100000, owner: 'Jordan Miles', relationship: 'Stable' },
  { id: 'o6', name: 'Harbour Logistics', industry: 'Logistics', people: 3, openValue: 92000, wonLifetime: 180000, owner: 'Priya Nair', relationship: 'Expanding' },
  { id: 'o7', name: 'Gale Renewables', industry: 'Renewables', people: 4, openValue: 512000, wonLifetime: 0, owner: 'Marcus Webb', relationship: 'New' },
]

export type Product = {
  id: string
  name: string
  sku: string
  category: string
  unitPrice: number
  billing: string
  openDeals: number
  active: boolean
}
export const products: Product[] = [
  { id: 'pr1', name: 'HV Switchgear Unit', sku: 'HV-SG-400', category: 'Hardware', unitPrice: 42000, billing: 'One-off', openDeals: 4, active: true },
  { id: 'pr2', name: 'Grid Monitoring Licence', sku: 'SW-MON-01', category: 'Software', unitPrice: 1200, billing: 'Annual', openDeals: 9, active: true },
  { id: 'pr3', name: 'Battery Storage Module', sku: 'BS-MOD-250', category: 'Hardware', unitPrice: 28500, billing: 'One-off', openDeals: 6, active: true },
  { id: 'pr4', name: 'Install & Commission', sku: 'SVC-INST', category: 'Service', unitPrice: 18000, billing: 'Project', openDeals: 11, active: true },
  { id: 'pr5', name: 'Maintenance Retainer', sku: 'SVC-MNT', category: 'Service', unitPrice: 950, billing: 'Monthly', openDeals: 5, active: true },
  { id: 'pr6', name: 'Legacy PLC Controller', sku: 'HW-PLC-90', category: 'Hardware', unitPrice: 6400, billing: 'One-off', openDeals: 0, active: false },
]

export const owners = ['Jordan Miles', 'Priya Nair', 'Marcus Webb']

export type TaskItem = { id: string; label: string; meta: string; done: boolean; tone?: 'warning' | 'accent' }
export const todayTasks: TaskItem[] = [
  { id: 't1', label: 'Call Callum Reed — UPS refresh', meta: 'Cirrus Hosting · due 10:00', done: false, tone: 'accent' },
  { id: 't2', label: 'Send revised quote', meta: 'Ashford Utilities · overdue', done: false, tone: 'warning' },
  { id: 't3', label: 'Prep microgrid proposal', meta: 'Fenwick University · due 14:00', done: false },
  { id: 't4', label: 'Follow up on redlines', meta: 'Cirrus Hosting · due 16:00', done: true },
  { id: 't5', label: 'Confirm site survey', meta: 'Brightleaf Farms', done: false },
]
