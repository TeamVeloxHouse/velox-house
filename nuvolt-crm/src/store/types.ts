import type { Health, StageName } from '../data/mock'

export type ID = string

export type ActivityType = 'call' | 'meeting' | 'task' | 'email' | 'note' | 'change' | 'file'

export interface Activity {
  id: ID
  type: ActivityType
  subject: string
  body?: string
  dealId?: ID
  personId?: ID
  orgId?: ID
  due?: string
  done: boolean
  priority?: 'High' | 'Medium' | 'Low'
  who: string
  createdAt: number // epoch ms
  source?: 'manual' | 'ai' | 'meeting' | 'email'
}

export type CustomEntity = 'deal' | 'person' | 'org'
export interface CustomField {
  id: ID
  entity: CustomEntity
  label: string
  type: 'text' | 'number' | 'select' | 'date' | 'url'
  options?: string[]
}

export interface Deal {
  id: ID
  name: string
  org: string
  orgId?: ID
  subtitle: string
  value: number
  stage: StageName
  closeDate: string
  owner: string
  health: Health
  chips: { label: string; tone: 'accent' | 'warning' | 'neutral' | 'positive' | 'negative' }[]
  personIds: ID[]
  probability: number
  won?: boolean
  lost?: boolean
  lostReason?: string
  custom?: Record<string, string>
}

export interface Person {
  id: ID
  name: string
  role: string
  org: string
  orgId?: ID
  phone: string
  email: string
  owner: string
  labels: string[]
  custom?: Record<string, string>
}

export interface Org {
  id: ID
  name: string
  industry: string
  people: number
  openValue: number
  wonLifetime: number
  owner: string
  relationship: 'Expanding' | 'At risk' | 'New' | 'Stable' | 'Renewal due'
  custom?: Record<string, string>
  enriched?: boolean
}

export interface Lead {
  id: ID
  name: string
  role: string
  company: string
  source: string
  owner: string
  created: string
  score: number
  archived?: boolean
  converted?: boolean
}

export interface EmailMsg {
  id: ID
  folder: 'inbox' | 'sent' | 'drafts' | 'outbox' | 'archive'
  from: string
  fromEmail: string
  to: string
  subject: string
  body: string
  dealId?: ID
  personId?: ID
  dealLabel?: string
  unread?: boolean
  time: string
  createdAt: number
}

export interface Meeting {
  id: ID
  title: string
  platform: 'Teams' | 'Google Meet' | 'Zoom'
  when: string
  dealOrg: string
  dealId?: ID
  personId?: ID
  attendees: string[]
  status: 'upcoming' | 'live' | 'recorded'
  bot: boolean
  duration?: string
  processed?: boolean // action items pushed to card
}

export interface Agent {
  id: ID
  name: string
  desc: string
  runs: string
  on: boolean
}

export interface AgentRun {
  id: ID
  agent: string
  kind: 'draft' | 'task' | 'risk' | 'enrich' | 'triage' | 'summary'
  title: string
  detail: string
  when: number
  status: 'pending' | 'approved' | 'dismissed'
  dealId?: ID
  personId?: ID
  emailTo?: string
  emailBody?: string
}

export interface Connection {
  id: ID
  kind: 'email' | 'meeting'
  provider: string
  account?: string
  connected: boolean
  color: string
}

export interface Toast {
  id: ID
  text: string
  tone: 'positive' | 'accent' | 'warning'
  actionLabel?: string
}

export interface State {
  deals: Deal[]
  people: Person[]
  orgs: Org[]
  leads: Lead[]
  activities: Activity[]
  emails: EmailMsg[]
  meetings: Meeting[]
  agents: Agent[]
  agentRuns: AgentRun[]
  connections: Connection[]
  customFields: CustomField[]
  toasts: Toast[]
  railExpanded: boolean
}
