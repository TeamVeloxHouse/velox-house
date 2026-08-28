import type { Health, StageName } from '../data/mock'

export type ID = string

export type ActivityType = 'call' | 'meeting' | 'task' | 'email' | 'note' | 'change' | 'file'

export interface TaskFile { id: ID; name: string; kind?: string; size?: number }
export interface SubTask { id: ID; label: string; done: boolean }

export interface Activity {
  id: ID
  type: ActivityType
  subject: string
  body?: string
  dealId?: ID
  personId?: ID
  orgId?: ID
  jobId?: ID
  due?: string
  dueDate?: string // ISO yyyy-mm-dd — the machine-readable due date (drives Today/Yesterday buckets)
  done: boolean
  priority?: 'High' | 'Medium' | 'Low'
  who: string
  createdAt: number // epoch ms
  completedAt?: number // epoch ms — when it was ticked off
  source?: 'manual' | 'ai' | 'meeting' | 'email'
  // ── richer task fields ──
  assigneeIds?: ID[] // TeamMember ids this task is assigned to / shared with
  estimateMins?: number // planned time
  files?: TaskFile[]
  subtasks?: SubTask[]
}

export interface ProjectMilestone { key: string; label: string; done: boolean; date?: string }
export interface ProjectTask { id: ID; label: string; done: boolean }
export interface ProductLine { name: string; detail: string; value: number }

export type OrderStatus = 'draft' | 'ordered' | 'delivered'
export interface OrderItem { name: string; qty: number; unitCost: number }
export interface ProjectOrder {
  id: ID
  supplier: string
  items: OrderItem[]
  status: OrderStatus
  orderedDate?: string
  expectedDate?: string
  note?: string
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue'
export type InvoiceKind = 'deposit' | 'interim' | 'final' | 'other'
export interface ProjectInvoice {
  id: ID
  number: string
  kind: InvoiceKind
  amount: number
  status: InvoiceStatus
  issuedDate?: string
  dueDate?: string
  paidDate?: string
}

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
  orders?: ProjectOrder[]
  invoices?: ProjectInvoice[]
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

// Brand & Documents — a brand kit + templates that turn plain docs into branded collateral
export interface BrandKit {
  company: string
  primary: string // hex
  accent: string // hex
  font: string
  tone: string
  logoName?: string
}
export type DocKind = 'deck' | 'proposal' | 'onepager' | 'case-study' | 'letter' | 'report' | 'model' | 'certificate' | 'policy' | 'contract' | 'handover'
export type DocFormat = 'pptx' | 'docx' | 'pdf' | 'html' | 'xlsx'
export interface DocTemplate {
  id: ID
  name: string
  kind: DocKind
  format: DocFormat
  desc: string
}
export interface BrandDoc {
  id: ID
  title: string
  kind: DocKind
  format: DocFormat
  source: 'template' | 'upload'
  sourceName?: string
  createdAt: number
}

// AI Context — company playbooks that guide the agents on specific tasks (the "brain")
export type PlaybookScope = 'general' | 'sourcing' | 'outreach' | 'qualifying' | 'proposal' | 'delivery'
export interface Playbook {
  id: ID
  title: string
  scope: PlaybookScope
  body: string
  source: 'written' | 'uploaded'
  fileName?: string
  active: boolean
  updatedAt: number
}

export type CampaignStatus = 'Sending' | 'Live' | 'Complete' | 'Draft'
export interface EmailCampaign {
  id: ID
  name: string
  type: string
  sent: number
  opens: number
  clicks: number
  deals: number
  status: CampaignStatus
  createdAt: number
}

export type DocumentStatus = 'Draft' | 'Sent' | 'Viewed' | 'Signed' | 'Expired'
export interface CrmDocument {
  id: ID
  ref: string
  deal: string
  value: number
  status: DocumentStatus
  views: number
  sent: string
  createdAt: number
}

// ── Trade profiles (the per-industry config layer) ──
// One product, configured per trade. Selected at signup, editable in Settings.
export type TradeKey = 'solar' | 'hvac' | 'roofing' | 'windows' | 'ev' | 'insulation' | 'general'
// Modules that a trade profile can switch on/off for an account.
export type FeatureKey = 'jobs' | 'studio' | 'reach' | 'compliance' | 'inventory'
export type Features = Record<FeatureKey, boolean>

// ── Team roles (Admin assigns; each role gets a tailored home dashboard) ──
export type UserRole = 'owner' | 'finance' | 'operations' | 'sales' | 'marketing' | 'engineer'

// ── Jobs & Scheduling (the field-operations spine) ──
export type JobKind = 'survey' | 'showroom' | 'install' | 'service' | 'remedial'
export type JobStatus = 'unscheduled' | 'scheduled' | 'in-progress' | 'complete' | 'cancelled'
export interface Engineer {
  id: ID
  name: string
  skills: string // e.g. 'Lead installer · MCS' / 'Electrician' / 'Roofer'
  color: string // hex, for the swimlane + card accents
  initials: string
}
export interface Job {
  id: ID
  ref: string
  kind: JobKind
  title: string
  customer: string
  address: string
  dealId?: ID
  personId?: ID
  crew: ID[] // engineer ids assigned
  date?: string // ISO yyyy-mm-dd — undefined = unscheduled
  start?: string // 'HH:MM'
  durationMins: number
  status: JobStatus
  value?: number
  notes?: string
  createdAt: number
}

// A trade profile bundles the sensible defaults a given industry starts with.
export interface TradeJobType { key: JobKind; label: string; defaultMins: number }
export interface TradeProfile {
  key: TradeKey
  name: string
  tagline: string
  emoji: string
  accent: string // hex
  jobTypes: TradeJobType[]
  surveyChecklist: string[]
  compliance: string[]
  productCategories: string[]
  estimatorUnit: string // headline pricing unit, e.g. '£/kWp', '£/kW', '£/m²'
  features: Features
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
  createdAt?: number // epoch ms — for date filtering
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
  inPerson?: boolean // an in-the-room recording (vs. an online call)
  summary?: string // Ovi's post-meeting summary
  tasksDished?: number // how many action items were sent to people
}

export interface Agent {
  id: ID
  name: string
  desc: string
  runs: string
  on: boolean
  schedule?: string // e.g. 'Realtime', 'Every hour', 'Daily · 07:00'
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

// ── Team space — one internal chat + announcements board that spans every workspace ──
// Fixed ids so the seed, the AI engine and the UI all agree on "you" and the bot.
export const AI_MEMBER_ID = 'tm-ai'
export const YOU_MEMBER_ID = 'tm-you'

export type PresenceStatus = 'online' | 'away' | 'dnd' | 'offline'
export interface TeamMember {
  id: ID
  name: string
  role: string
  color: string // avatar accent
  status: PresenceStatus
  bot?: boolean // TellOvi AI
  boss?: boolean // your manager
  you?: boolean // the current viewer
  voiceEnrolled?: boolean // Ovi can recognise this person's voice in a room recording
}

export type ChannelKind = 'channel' | 'group' | 'dm'
export interface TeamChannel {
  id: ID
  name: string
  kind: ChannelKind
  topic?: string
  memberIds: ID[] // participants (the AI is included where it "sits inside")
  ai: boolean // TellOvi AI is a member here and will respond
  unread: number
}

// Rich, structured content the in-channel AI can post — accurate answers + visuals.
export type TeamAiBlock =
  | { type: 'text'; text: string }
  | { type: 'stats'; items: { label: string; value: string; tone?: 'positive' | 'negative' | 'muted' }[] }
  | { type: 'bars'; title?: string; items: { label: string; value: number; display: string; tone?: 'accent' | 'positive' | 'warning' }[] }
  | { type: 'tasks'; items: { label: string; meta: string }[] }
  | { type: 'agenda'; title: string; items: string[] }
  | { type: 'email'; to: string; subject: string; body: string }

export type TeamActionKind = 'task' | 'deck' | 'meeting' | 'email' | 'doc' | 'campaign'
export interface TeamActionRef {
  kind: TeamActionKind
  label: string
  to?: string // route the chip opens
}

export interface Reaction { emoji: string; by: ID[] }

export interface TeamMessage {
  id: ID
  channelId: ID
  authorId: ID // TeamMember id; the AI uses AI_MEMBER_ID
  text: string
  createdAt: number
  ai?: TeamAiBlock[] // structured AI content (answers / visuals)
  actions?: TeamActionRef[] // things the AI did off this message, as openable chips
  reactions?: Reaction[]
  pinned?: boolean
  handled?: boolean // an actionable teammate request the AI has already picked up
}

export type AnnouncementKind = 'win' | 'news' | 'update' | 'shoutout'
export interface Announcement {
  id: ID
  kind: AnnouncementKind
  title: string
  body: string
  authorId: ID
  createdAt: number
  value?: number // £ — for wins
  cheers: ID[] // member ids who cheered
  pinned?: boolean
}

// ── Departments — the whole-workforce layer (build what we own, connect the rest) ──
export type Dept = 'operations' | 'finance' | 'hr' | 'marketing' | 'delivery'

// HR / People
export interface Employee {
  id: ID
  name: string
  role: string
  dept: Dept | 'sales'
  startDate: string // ISO
  status: 'active' | 'probation' | 'leave'
  managerId?: ID
  color: string
}
export interface LeaveRequest {
  id: ID
  employeeId: ID
  type: 'holiday' | 'sick' | 'unpaid' | 'parental'
  from: string
  to: string
  days: number
  status: 'pending' | 'approved' | 'declined'
  note?: string
  createdAt: number
}
export interface Policy {
  id: ID
  title: string
  category: 'Employment' | 'Health & Safety' | 'IT & Data' | 'Finance' | 'Conduct'
  owner: string
  updatedAt: number
  status: 'current' | 'review-due' | 'draft'
}
export interface Certification {
  id: ID
  employeeId: ID
  name: string // MCS, Gas Safe, NICEIC, CSCS, First Aid…
  issued: string
  expires: string // ISO — drives the expiry warnings
}

// Finance
export interface Expense {
  id: ID
  date: string
  category: string
  vendor: string
  amount: number
  who: string
  status: 'pending' | 'approved' | 'reimbursed'
}

// Operations
export interface StockItem {
  id: ID
  name: string
  sku: string
  qty: number
  reorderAt: number
  unitCost: number
  supplier: string
}

// Marketing
export interface Review {
  id: ID
  author: string
  rating: number // 1–5
  text: string
  source: 'Google' | 'Trustpilot' | 'Checkatrade'
  date: string
  responded: boolean
}

// ── TellOvi Marketing — brand & content operations hub ──
export type BrandAssetType = 'logo' | 'template' | 'header' | 'deck' | 'pdf' | 'guideline' | 'font'
export interface BrandAsset {
  id: ID
  name: string
  type: BrandAssetType
  format: string // 'SVG' | 'PNG' | 'PPTX' | 'DOCX' | 'PDF' | 'OTF' …
  tags: string[]
  version: string // e.g. 'v3'
  updatedAt: number
  note?: string
  latest: boolean
}
export type MessagingCategory = 'tagline' | 'boilerplate' | 'value-prop' | 'tone' | 'banned'
export interface MessagingSnippet {
  id: ID
  label: string
  category: MessagingCategory
  text: string
}
export type MediaSource = 'upload' | 'canva' | 'claude-design' | 'figma'
export interface MediaAsset {
  id: ID
  name: string
  type: 'image' | 'video' | 'graphic'
  tags: string[]
  source: MediaSource
  when: string
  license?: string
  expiry?: string
}
export type ContentStatus = 'idea' | 'brief' | 'draft' | 'review' | 'approved' | 'scheduled' | 'published'
export interface ContentItem {
  id: ID
  title: string
  channel: string // 'LinkedIn' | 'Instagram' | 'Blog' | 'Email' | 'X' …
  campaign?: string
  status: ContentStatus
  owner: string
  date: string
  note?: string
}
export type RequestStatus = 'new' | 'found' | 'in-progress' | 'done'
export interface MarketingRequest {
  id: ID
  from: string
  ask: string
  status: RequestStatus
  assetId?: ID
  when: string
  note?: string
}
export type ConnectorKind = 'design' | 'social' | 'storage' | 'analytics' | 'email'
export interface MarketingConnector {
  id: ID
  name: string
  kind: ConnectorKind
  connected: boolean
  account?: string
  note?: string
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
  playbooks: Playbook[]
  brandKit: BrandKit
  docTemplates: DocTemplate[]
  brandDocs: BrandDoc[]
  products: import('../data/mock').Product[]
  documents: CrmDocument[]
  emailCampaigns: EmailCampaign[]
  customFields: CustomField[]
  // Trade profile + field operations
  activeTrade: TradeKey
  features: Features
  onboarded: boolean
  engineers: Engineer[]
  jobs: Job[]
  // The role of the person currently viewing (drives their home dashboard)
  currentRole: UserRole
  // Team space
  teamMembers: TeamMember[]
  teamChannels: TeamChannel[]
  teamMessages: TeamMessage[]
  announcements: Announcement[]
  // Departments (whole-workforce layer)
  employees: Employee[]
  leaveRequests: LeaveRequest[]
  policies: Policy[]
  certifications: Certification[]
  expenses: Expense[]
  stock: StockItem[]
  reviews: Review[]
  // TellOvi Marketing — brand & content operations
  brandAssets: BrandAsset[]
  messaging: MessagingSnippet[]
  mediaAssets: MediaAsset[]
  contentItems: ContentItem[]
  mktRequests: MarketingRequest[]
  mktConnectors: MarketingConnector[]
  toasts: Toast[]
  railExpanded: boolean
}
