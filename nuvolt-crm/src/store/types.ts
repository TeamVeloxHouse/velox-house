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

export interface ProjectMilestone { key: string; label: string; done: boolean; date?: string }
export interface ProjectTask { id: ID; label: string; done: boolean }
export interface ProductLine { name: string; detail: string; value: number }
export interface StudioProject {
  id: ID
  dealId?: ID
  address: string
  customer: string
  owner: string
  value: number
  systemKwp?: number
  milestoneIndex: number
  milestones: ProjectMilestone[]
  tasks: ProjectTask[]
  products: ProductLine[]
  installDate?: string
  ptoDate?: string
  createdAt: number
}

export interface FinanceProduct {
  id: ID
  name: string
  provider: string
  apr: number // %
  termMonths: number
  depositPct: number
  type: 'loan' | 'lease' | 'ppa' | 'buy-now-pay-later'
}
export interface Adder {
  id: ID
  name: string
  amount: number // £
}
export interface StudioConfig {
  costPerKwp: number
  baseCost: number
  perPanel: number
  marginPct: number
  vatPct: number
  adders: Adder[]
  finance: FinanceProduct[]
  currency: string
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
  solar?: import('../lib/solar').SolarDesign
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
  kind: 'email' | 'meeting' | 'social'
  provider: string
  account?: string
  connected: boolean
  color: string
  protocol?: 'oauth' | 'imap' | 'api'
}

export interface Webhook {
  id: ID
  url: string
  events: string[]
  active: boolean
}

export interface ApiKey {
  id: ID
  label: string
  key: string
  created: string
}

export interface Integration {
  id: ID
  name: string
  category: string
  desc: string
  installed: boolean
  color: string
  initials: string
  domain?: string
  popular?: boolean
}

export interface SocialPost {
  id: ID
  channels: string[]
  body: string
  when: string
  status: 'scheduled' | 'posted' | 'draft'
}

export type SeqStepType = 'email' | 'wait' | 'call' | 'task' | 'linkedin'
export interface SeqStep {
  id: ID
  type: SeqStepType
  label: string
  day: number
}
export interface Sequence {
  id: ID
  name: string
  steps: SeqStep[]
  enrolled: number
  active: boolean
  replyRate: number
}

export interface LinkedInThread {
  id: ID
  name: string
  company: string
  headline: string
  kind: 'message' | 'connection'
  status: 'unread' | 'open' | 'pending' | 'accepted'
  preview: string
  time: string
  createdAt: number
  personId?: ID
  sequence?: string
}

export type ChannelStatus = 'pending' | 'due' | 'sent' | 'opened' | 'replied' | 'bounced' | 'connected' | 'skipped'
export interface Enrolment {
  id: ID
  sequenceId: ID
  name: string
  company: string
  channel: 'Email' | 'LinkedIn'
  stepIndex: number
  totalSteps: number
  stepLabel: string
  status: ChannelStatus
  nextDue: string
  personId?: ID
}

export interface ReachCampaign {
  id: ID
  name: string
  vertical: string
  audience: number
  sequence: string
  channels: string[]
  status: 'running' | 'draft' | 'complete' | 'scheduled'
  sent: number
  replies: number
  meetings: number
  createdBy: 'AI' | 'You'
  createdAt: number
}

export interface ScheduledTask {
  id: ID
  prompt: string
  cadence: string
  nextRun: string
  active: boolean
  lastResult?: string
  createdAt: number
}

export type AutoStepKind = 'trigger' | 'condition' | 'email' | 'task' | 'notify' | 'stage' | 'wait'
export interface AutoStep {
  id: ID
  kind: AutoStepKind
  title: string
  subtitle: string
}
export interface Automation {
  id: ID
  name: string
  active: boolean
  steps: AutoStep[]
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
  webhooks: Webhook[]
  apiKeys: ApiKey[]
  integrations: Integration[]
  socialPosts: SocialPost[]
  sequences: Sequence[]
  automations: Automation[]
  linkedinThreads: LinkedInThread[]
  enrolments: Enrolment[]
  reachCampaigns: ReachCampaign[]
  scheduledTasks: ScheduledTask[]
  studioConfig: StudioConfig
  projects: StudioProject[]
  customFields: CustomField[]
  toasts: Toast[]
  railExpanded: boolean
}
