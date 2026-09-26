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
  leadId?: ID
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
  // ── scheduling detail (lib/activityTaxonomy — fixed lists so it can be reported on) ──
  purpose?: string
  location?: string
  startTime?: string // HH:MM
  reminder?: string
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

// ── DNO Autopilot (distribution-network-operator application, per project) ──
export type DnoForm = 'G98' | 'G99-A' | 'G99-B' | 'G100'
export type DnoStatus = 'draft' | 'validated' | 'submitted' | 'reviewing' | 'info' | 'approved' | 'installed' | 'pto' | 'rejected'
export interface PvString { id: ID; panels: number; watts: number; inverterId: string }
export interface DnoDevice {
  id: ID
  kind: 'inverter' | 'battery' | 'ev' | 'ashp'
  make: string
  model: string
  capacityKw: number
  powerFactor?: number // inverters only
  typeTestRef?: string // ENA type-test / EREC register reference
  onRegister: boolean
}
export type ExportScheme = 'none' | 'fixed' | 'dynamic'
// Transient AI-run progress the whole app can watch (drives the animated status pill).
export interface DnoRun { active: boolean; index: number; total: number; step: string; steps: string[] }
export interface DnoSig { by: string; dataUrl?: string; signedAt: string }
export type DnoDocKind = 'pre-install' | 'post-install' | 'sld' | 'supplementary'
export interface DnoDoc { id: ID; name: string; kind: DnoDocKind; pages: number; generatedAt: string }
export interface DnoMessage { id: ID; from: 'installer' | 'dno'; body: string; at: string }
export interface DnoEvent { id: ID; label: string; at: string; note?: string }
export interface DnoApplication {
  form: DnoForm
  classification: string // e.g. "G99 Type A"
  aggregateRcA: number // aggregate rated current per phase (A)
  meetsSgi: boolean // Small Generating Installation criteria
  rationale: string // printed plain-English reason
  dnoRegion: string // resolved from MPAN distributor id
  mpan?: string
  phase: 1 | 3
  strings: PvString[]
  devices: DnoDevice[]
  exportScheme?: ExportScheme
  exportLimitKw?: number // present ⇒ G100 overlay
  // Site details (CLRD parity — pre-filled from survey, editable)
  installLocation?: string
  isolatorLocation?: string
  preExisting?: boolean
  run?: DnoRun // transient AI-run progress
  status: DnoStatus
  reference?: string // DNO job reference once approved (e.g. SSEN-4821973)
  signatures: { installer?: DnoSig; client?: DnoSig }
  documents: DnoDoc[]
  messages: DnoMessage[]
  events: DnoEvent[]
  proposedInstallDate?: string
  actualInstallDate?: string
  submittedAt?: string
  decisionAt?: string
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
  dno?: DnoApplication
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
  portalId?: ID // raised from a customer's portal (a support request)
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

// ── Configurable pipelines (stages are account data, not hard-coded) ──
export interface PipelineStage {
  id: ID
  name: string
  probability: number // typical win % at this stage — seeds deal confidence & forecast
  color: string // hex
}
export interface Pipeline {
  id: ID
  name: string
  stages: PipelineStage[]
}

/* ── Customer journey (Solar House) — the full lead→install→portal lifecycle on every deal ── */
export type Showroom = 'cardiff' | 'cheltenham' | 'melksham'
export type JourneyKey = 'enquiry' | 'contacted' | 'consultation' | 'proposal' | 'survey' | 'signed' | 'dno' | 'install' | 'handover'
export interface JourneyStep {
  key: JourneyKey
  at: number // when the stage started (or is booked for, if in the future)
  done?: number // when it was completed
  by?: string // who did it
  notes?: string
  data?: Record<string, string | number>
}
/* Post-sale delivery detail — everything ops needs between contract and handover. */
export interface DeliveryOrder { supplier: string; items: string; status: 'to-order' | 'ordered' | 'delivered'; orderedAt?: number; eta?: number; deliveredAt?: number; value: number }
export interface DeliveryPayment { label: string; amount: number; status: 'paid' | 'due' | 'overdue' | 'not-due'; at?: number }
export interface DeliverySnag { text: string; status: 'open' | 'fixed'; at: number }
export interface Delivery {
  kit: { item: string; qty: number; detail: string }[]
  orders: DeliveryOrder[]
  scaffold: { company: string; status: 'not-booked' | 'booked' | 'up' | 'down'; upAt?: number; downAt?: number }
  team?: string
  installDays: number
  checklist: { label: string; done: boolean }[]
  commissioning: Record<string, string>
  payments: DeliveryPayment[]
  snags: DeliverySnag[]
}

export interface Journey {
  delivery?: Delivery // present once the contract is signed
  showroom: Showroom
  source: string
  address: string
  postcode: string
  phone: string
  email: string
  property: { type: string; bedrooms: number; roofAspect: string; annualKwh: number; monthlyBill: number; heating: string; hasEv: boolean }
  system?: { kwp: number; panels: number; panelModel: string; inverter: string; batteryKwh: number; batteryModel?: string; evCharger: boolean; price: number; finance: string }
  steps: JourneyStep[]
  nextAction?: { label: string; due: number }
}

export interface Deal {
  id: ID
  journey?: Journey // Solar House: the customer's full lifecycle
  name: string
  org: string
  orgId?: ID
  subtitle: string
  value: number
  pipelineId?: ID // which pipeline this deal lives in (undefined = the default)
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
  quoted?: boolean // a proposal/quote has gone out — lifts the deal into the commit forecast
  custom?: Record<string, string>
  solar?: import('../lib/solar').SolarDesign
  mockupImage?: string // data URL — the proposal's "solar on your roof" showroom image
  mockupSource?: 'ai' | 'streetview' | 'illustrated'
  energyBill?: EnergyBill
}

/** A customer-supplied energy bill, used to give them a real savings figure instead of the
 *  modelled default. Entered by hand (annual or monthly spend); a file can be attached for the
 *  sales team's reference but is not parsed — no OCR is wired up. */
export interface EnergyBill {
  annualCost?: number // £/yr, as told to us by the customer
  fileName?: string
  addedAt: number
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

// Where a lead sits in its qualification lifecycle before it becomes a deal.
export type LeadStatus = 'new' | 'working' | 'nurturing' | 'qualified' | 'unqualified'
export const LEAD_STATUSES: LeadStatus[] = ['new', 'working', 'nurturing', 'qualified', 'unqualified']

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
  status: LeadStatus
  email?: string
  phone?: string
  value?: number // estimated opportunity value, £
  referredByPortal?: ID // a referral raised by an existing customer from their portal
  archived?: boolean
  converted?: boolean
  // ── residential detail (Solar House) ──
  address?: string
  postcode?: string
  monthlyBill?: number
  interest?: string // e.g. "Solar + battery", "Battery only", "EV charger"
  notes?: string
  batch?: { id: ID; label: string; receivedAt: number; file?: string } // CSV import batch (e.g. Solar on Steroids)
  pushedDealId?: ID // the pipeline deal it became
  contactedAt?: number
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
  aiDrafted?: boolean // an Ovi-drafted reply awaiting approval
  replyToId?: ID // the inbound email this is a reply to
  handled?: boolean // Ovi has drafted/handled a reply for this inbound email
}

/* ── Unified inbox — every customer conversation, across every channel, in one thread ── */
export type CommsChannel = 'email' | 'whatsapp' | 'sms' | 'call' | 'web' | 'social' | 'portal'
export type CommsStage = 'new-lead' | 'assessment' | 'quoted' | 'survey' | 'installing' | 'customer'
export interface CommsMessage {
  id: ID
  channel: CommsChannel
  dir: 'in' | 'out' | 'note' // note = internal, never sent
  author: string
  body: string
  at: number // epoch ms
  subject?: string // email only
  callSecs?: number // call only; 0 = missed
  voicemail?: string // transcript
}
export interface Conversation {
  id: ID
  name: string
  phone?: string
  email?: string
  address?: string
  stage: CommsStage
  source?: string // how they first reached us
  assignee?: string // team member name
  status: 'open' | 'snoozed' | 'done'
  unread: boolean
  starred?: boolean
  dealId?: ID
  valueHint?: number // likely system value, £
  messages: CommsMessage[]
}

// Inbox auto-reply mode: off · draft for approval · auto-send.
export type AutoReplyMode = 'off' | 'draft' | 'send'

export interface Meeting {
  id: ID
  title: string
  platform: 'Teams' | 'Google Meet' | 'Zoom'
  when: string
  date?: string // ISO yyyy-mm-dd — for the calendar
  start?: string // 'HH:MM'
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
  bot?: boolean // Ovi
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
  ai: boolean // Ovi is a member here and will respond
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

// ── Solar House Marketing — brand & content operations hub ──
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

// ── Editable dashboard widgets (build-your-own, computed live from deals) ──
export type WidgetMetric = 'open' | 'weighted' | 'won' | 'count'
export type WidgetGroup = 'stage' | 'owner' | 'health'
export type WidgetChart = 'bar' | 'donut' | 'table'
export interface DashboardWidget {
  id: ID
  title: string
  metric: WidgetMetric
  groupBy: WidgetGroup
  chart: WidgetChart
}

// ── Customer portal — what a customer sees after a proposal, + its analytics ──
export interface CustomerPortal {
  id: ID
  dealId?: ID
  customer: string
  email: string
  address: string
  systemKwp: number
  systemCost: number
  annualSavings: number
  installDate?: string
  status: 'invited' | 'active'
  invitedAt: number
  lastActiveAt?: number
  // ── System make-up (drives targeted offers + the energy flow) ──
  hasBattery?: boolean
  hasEv?: boolean
  // ── Live monitoring: which brand's app/portal this customer uses + a deep link into it ──
  monitoringPlatform?: string // Tesla · SolarEdge · GivEnergy · Enphase · SolisCloud · FoxESS…
  monitoringUrl?: string
  // ── The post-acceptance journey the customer follows (ordered; first not-done = current) ──
  journey?: PortalMilestone[]
}
// A step in the customer's install journey. Ordered; the first not-`done` step is the "current" one.
export type PortalMilestoneKey =
  | 'accepted' | 'survey' | 'design' | 'dno-submitted' | 'dno-approved' | 'scheduled' | 'installed' | 'commissioned' | 'handover'
export interface PortalMilestone {
  key: PortalMilestoneKey
  label: string
  blurb: string // customer-friendly one-liner shown under the step
  done: boolean
  at?: number // when it was completed / booked
  date?: string // an ISO date this step points at (e.g. the booked install date → drives the countdown)
}
// An offer surfaced inside a customer's portal — pushed by the team or auto-suggested from missing kit.
export type PortalOfferKind = 'battery' | 'ev' | 'upgrade' | 'service' | 'referral' | 'general'
export interface PortalOffer {
  id: ID
  portalId?: ID // a specific customer; omit + global:true for everyone
  global?: boolean
  kind: PortalOfferKind
  title: string
  blurb: string
  cta: string // button label
  savingHint?: string // e.g. "Save ~£320/yr"
  createdAt: number
  status: 'active' | 'interested' | 'dismissed'
}
/* ── Portal builder — the customer portal is configured, drafted and published in-app ── */
export type PortalSectionId = 'Overview' | 'Progress' | 'Energy' | 'Savings' | 'Documents' | 'Community' | 'Support' | 'Resources' | 'Refer a friend'
export interface PortalSectionConfig { id: PortalSectionId; label: string; visible: boolean; blurb?: string }
export interface PortalConfig {
  brandColor: string
  welcomeTitle: string // {first} is replaced with the customer's first name
  welcomeBody: string
  sections: PortalSectionConfig[] // order = nav order
  askOvi: boolean
  referralReward: number // £ per referral that goes ahead
  supportPhone: string
  supportEmail: string
  reviewLink: string
}
export interface PortalVersion { id: ID; at: number; by: string; note: string; config: PortalConfig }
export interface PortalTemplate { live: PortalConfig; draft: PortalConfig; versions: PortalVersion[]; draftUpdatedAt?: number }

export type PortalEventKind ='view' | 'click' | 'download' | 'chat' | 'video' | 'login'
export interface PortalEvent {
  id: ID
  portalId: ID
  section: string // Proposal · Energy · Documents · Resources · Ask Ovi
  label: string // the specific thing viewed / clicked
  kind: PortalEventKind
  at: number
  dwellMs?: number // how long they spent
}
export type ResourceType = 'video' | 'manual' | 'case-study' | 'guide'
export interface PortalResource {
  id: ID
  type: ResourceType
  title: string
  manufacturer?: string // Tesla · SolarEdge · GivEnergy…
  desc: string
  content?: string // the searchable body Ovi reads (manual text, troubleshooting steps)
  duration?: string // videos
  global: boolean // in every customer's portal vs. a specific one
  portalId?: ID
}

// ── Showroom experience — a guided, in-person proposal-builder presentation ──
// One live session per walk-in: their details + bill, the design we build WITH them,
// and where it lands (a won deal + a provisioned portal).
export interface ShowroomDesign {
  systemKwp: number
  panels: number
  hasBattery: boolean
  batteryKwh: number // usable kWh
  hasEv: boolean // they have / want an EV
  addEvCharger: boolean
  price?: number // quoted price from a Design Studio design (else the showroom's own itemised pricing)
  annualGenKwh?: number // MCS generation from a Design Studio design (else kWp × a typical yield)
}
export interface ShowroomSession {
  id: ID
  createdAt: number
  name: string
  email: string
  phone?: string
  address: string
  postcode?: string
  // their current energy picture (from the bill they bring in)
  monthlySpend: number // £/month on electricity
  annualKwh: number // annual consumption
  tariffPence: number // import unit rate, p/kWh
  occupancy: 'home_all_day' | 'in_half_day' | 'out_all_day'
  evMilesPerYear?: number
  // the proposal being built live with them
  design: ShowroomDesign
  status: 'draft' | 'presented' | 'won' | 'lost'
  dealId?: ID
  portalId?: ID
  presenter?: string
  designId?: ID // the Design Studio design this proposal was pushed from
  mockupImage?: string // data URL — "solar on your roof" showroom image for the Home slide
  mockupSource?: 'ai' | 'streetview' | 'illustrated'
  billFileName?: string // an attached energy bill, kept for reference — not parsed
  signature?: string // data URL — captured at accept, kept on the session for the record
  // ── booking — which showroom slot this session is/was scheduled into ──
  location?: string // which showroom, e.g. 'Cheltenham' | 'Cardiff' | 'Melksham'
  scheduledDate?: string // ISO yyyy-mm-dd
  scheduledTime?: string // 'HH:mm', 24hr — the slot start
  bookingStatus?: 'scheduled' | 'completed' | 'no-show' | 'cancelled'
  leadId?: ID // the lead this booking was made from, if any
}

// ── Commercial Solar Finder ────────────────────────────────────────────────
// A saved area/pin scan (a "campaign") and the scored building prospects it produced. Prospects move
// through a pipeline from first scan all the way to a won deal (which hands off to a CRM deal/project).
export type SolarProspectStatus =
  | 'prospected' | 'researched' | 'contacted' | 'replied' | 'meeting' | 'proposal' | 'won' | 'lost'

export const SOLAR_STATUSES: SolarProspectStatus[] = ['prospected', 'researched', 'contacted', 'replied', 'meeting', 'proposal', 'won', 'lost']

export interface SolarContact {
  id: ID
  name: string
  title: string
  email?: string
  hasEmail?: boolean // PDL knows an email exists but doesn't return it on this plan
  linkedin?: string
  seniority?: string
  revealed: boolean // false until a PDL credit is spent to reveal (then cached forever)
}

export interface SolarProspect {
  id: ID
  campaignId: ID
  tool: string // which Tool produced this (e.g. 'commercial-solar') — drives the cross-tool database
  company: string
  address: string
  domain?: string
  center?: { lat: number; lng: number }
  category?: string
  distanceM?: number // from the dropped pin
  roofSegments?: { box: import('../lib/solar').SegBox }[] // roof-plane boxes (Google Solar) — fallback outline
  roofFootprint?: { lat: number; lng: number }[] // true building outline (OSM) — the accurate roof trace
  // Roof + calculation snapshot (denormalised so lists render without recompute).
  systemKwp: number // the recommended (best-payback) system size
  roofMaxKwp?: number // the roof's full capacity
  roofAreaM2?: number // measured usable roof area
  panels: number
  annualGenKwh: number
  year1Saving: number
  lifetimeSaving: number
  paybackYears: number
  npv: number
  co2PerYearTonnes: number
  selfConsumptionPct?: number
  demandOffsetPct?: number
  roofMeasured: boolean // true = real Google Solar
  roofPending?: boolean // company found but roof not yet measured (Company & People Search)
  imageUrl?: string
  roofZoom?: number // zoom used for the tile (so the overlay matches)
  epcRating?: string | null
  score: number
  reasons: string[]
  status: SolarProspectStatus
  contacts: SolarContact[]
  contactsRevealed: boolean // whether a PDL credit has been spent on this company
  calc?: import('../lib/commercialModel').CommercialCalc // full detail for the single-site page
  dealId?: ID // set when converted to a CRM deal
  createdAt: number
  updatedAt: number
}

export interface SolarCampaign {
  id: ID
  name: string // editable
  tool?: string // which Tool produced it
  createdAt: number
  // Search parameters (so a campaign can be re-run / understood later).
  industry?: string
  area?: string
  pin?: { lat: number; lng: number }
  radiusM?: number
  targetKwp: number
  jobTitles?: string[]
  count?: number
  scanned: number // buildings looked at
  status: 'draft' | 'scanning' | 'complete'
}

/* ── Design Studio ──────────────────────────────────────────────────────────
 * A Design is the spatial PV design that lives on a deal (Find→Engage→Design→Close→Deliver).
 * Roof planes and obstacles are georeferenced (lat/lng) so panel placement + stringing stay true
 * to the real roof; later phases fill in panels, strings, inverters and the yield/BOM snapshot. */
export type PanelOrientation = 'portrait' | 'landscape'
/** How the array is mounted: flush to a pitched roof, or tilted up on a flat roof (single/dual). */
export type RackingType = 'flush' | 'single-tilt' | 'dual-tilt'
export interface DesignPanel {
  id: ID
  corners: { lat: number; lng: number }[] // the panel rectangle on the roof (4 geo corners)
  string?: number // which electrical string this panel belongs to
}
export interface DesignPlane {
  id: ID
  name: string
  polygon: { lat: number; lng: number }[] // the plane outline, editable
  pitchDeg: number // roof slope, 0 = flat
  azimuthDeg: number // degrees from north (0 = N, 90 = E, 180 = S, 270 = W)
  areaM2: number
  source: 'google' | 'manual'
  moduleId?: string // which module fills this plane (defaults to the design's module)
  orientation?: PanelOrientation
  arrayAngleDeg?: number // rotate the packing grid off the roof's dominant edge (Pylon-style array rotation)
  panels?: DesignPanel[] // the laid-out array (Phase 2)
  // ── Array / racking depth (OpenSolar-style "Panel Group" settings) ──
  racking?: RackingType // default 'flush'
  tiltDeg?: number // mounting tilt for single/dual-tilt racking on flat roofs
  groundClearanceM?: number // gap under the array (flat-roof ballast frames)
  rowGapM?: number // gap between panel rows (m); wider = less inter-row shading
  panelGapM?: number // gap between panels within a row (m); the column margin
  setbackM?: number // per-plane fire-setback override (defaults to design.setbackM)
  optimisers?: boolean // module-level power electronics on this array
  pitchSource?: 'measured' | 'assumed' // assumed = pane split from the outline alone (no height data) — check the pitch on site
}
export type DesignObstacleKind = 'chimney' | 'skylight' | 'hvac' | 'keepout'
export interface DesignObstacle {
  id: ID
  kind: DesignObstacleKind
  polygon: { lat: number; lng: number }[]
  source?: 'auto' | 'manual' // auto = detected from the DSM; manual = the user added/kept it
  heightM?: number // height proud of the roof (m), when detected
}
export type DesignStatus = 'draft' | 'confirmed'
export interface Design {
  id: ID
  name: string
  dealId?: ID // the deal this design wins (design attaches to the deal, not the install)
  prospectId?: ID // the solar prospect it was started from, if any
  address: string
  center?: { lat: number; lng: number }
  status: DesignStatus
  planes: DesignPlane[]
  obstacles: DesignObstacle[]
  moduleWatts: number // chosen module wattage (default 440 W)
  setbackM: number // fire-code perimeter kept clear of panels
  // Real building height (metres to the eave) for the 3D model — from OSM tags or Google, editable.
  eaveHeightM?: number
  heightSource?: 'osm' | 'google' | 'manual'
  // Snapshot — filled in as the panel/electrical/yield phases land.
  systemKwp?: number
  panels?: number
  annualKwh?: number
  // Energy modelling (consumption offset / self-consumption / bill savings)
  annualConsumptionKwh?: number // household/site annual demand (kWh)
  occupancy?: 'home_all_day' | 'in_half_day' | 'out_all_day'
  batteryKwh?: number // usable battery capacity (kWh), 0 = none
  horizon?: { id: ID; label: string; bearingDeg: number; distanceM: number; heightM: number; widthM: number }[] // off-roof obstructions (trees, buildings) for the MCS sun-path shade factor
  shadeOverrides?: Record<ID, number> // per-plane shade factor set by the surveyor
  finance?: Record<string, number> // per-design overrides of lib/finance DEFAULT_FINANCE (price rise, SEG, discount rate…)
  priceOverride?: number // quoted price (£) when the adviser sets one, instead of the Studio pricing formula
  // Electrical design (lib/electrical.ts): inverter, strings per MPPT, AC/DC cable runs for voltage rise
  electrical?: {
    inverterId: string
    strings: { id: ID; planeId: ID; mppt: number; panelIds: ID[] }[]
    acCableM?: number; acCableMm2?: number; dcCableM?: number; dcCableMm2?: number; ze?: number; exportLimitKw?: number
  }
  notes?: { id: ID; lat: number; lng: number; text: string; at: number }[] // pinned site notes (access, scaffold, cable route…)
  // Detected roof model (lib/roofPanes.ts): the building outline + per-edge roles, so the panes can be re-split (gable ⇄ hip)
  roofModel?: { outline: { lat: number; lng: number }[]; roles: ('eave' | 'gable' | 'party')[]; source: 'google' | 'osm'; measured: boolean }
  createdAt: number
  updatedAt: number
}

/* ── Site Survey ──────────────────────────────────────────────────────────
 * The on-site survey a field surveyor fills on their phone (Solar + Battery + EV + Heat pump).
 * It lands in the CRM on submit, completes the survey Job, and pre-fills DNO site details + design.
 * Answers are stored flat (keyed by field id, e.g. 'elec.mainFuse') against the data-driven spec in
 * lib/survey.ts, so adding a question is a spec edit — no schema change. Roof is repeatable per face. */
export type SurveyStatus = 'draft' | 'submitted' | 'reviewed'
export type SurveyProductKey = 'solar' | 'battery' | 'ev' | 'ashp' | 'hotwater'
export interface SurveyPhoto {
  id: ID
  section: string // section key the shot belongs to
  key: string // stable slot key (e.g. 'consumer-unit')
  label: string
  required?: boolean
  captured: boolean // simulated capture — no real upload yet
  name?: string // filename once "taken"
}
export interface RoofFace {
  id: ID
  name: string // e.g. 'Rear (main)'
  orientationDeg?: number // degrees from north (0 = N, 180 = S)
  pitchDeg?: number
  covering?: string // Slate / Concrete tile / Clay tile / Metal / Felt / EPDM
  coveringAge?: string
  condition?: string // Good / Fair / Poor
  widthM?: number
  heightM?: number
  obstructions?: string // chimney, rooflight, vent, dormer…
  notes?: string
}
export interface SiteSurvey {
  id: ID
  ref: string // SUR-xxxx
  jobId?: ID // the survey Job this fulfils
  dealId?: ID
  projectId?: ID
  personId?: ID
  address: string
  customer: string
  surveyor: string
  products: SurveyProductKey[] // which product modules are in scope
  status: SurveyStatus
  answers: Record<string, string> // keyed by spec field id
  roof: RoofFace[]
  photos: SurveyPhoto[]
  surveyorNote?: string
  createdAt: number
  updatedAt: number
  submittedAt?: number
}

export interface State {
  deals: Deal[]
  pipelines: Pipeline[]
  activePipelineId: ID
  dashboardWidgets: DashboardWidget[]
  portals: CustomerPortal[]
  portalEvents: PortalEvent[]
  portalResources: PortalResource[]
  portalOffers: PortalOffer[]
  showroom: ShowroomSession[]
  people: Person[]
  orgs: Org[]
  leads: Lead[]
  activities: Activity[]
  emails: EmailMsg[]
  conversations: Conversation[] // unified inbox (Solar House)
  portalTemplate: PortalTemplate // portal builder: live + draft + history
  inboxAutoReply: AutoReplyMode
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
  // Solar House Marketing — brand & content operations
  brandAssets: BrandAsset[]
  messaging: MessagingSnippet[]
  mediaAssets: MediaAsset[]
  contentItems: ContentItem[]
  mktRequests: MarketingRequest[]
  mktConnectors: MarketingConnector[]
  // Commercial Solar Finder
  solarCampaigns: SolarCampaign[]
  solarProspects: SolarProspect[]
  // Design Studio
  designs: Design[]
  // Field site surveys
  surveys: SiteSurvey[]
  toasts: Toast[]
  railExpanded: boolean
}
