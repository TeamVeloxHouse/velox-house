import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { buildSeed } from './seed'
import type { State, Deal, Person, Lead, Org, Activity, EmailMsg, Toast, ID } from './types'
import type { StageName } from '../data/mock'

const KEY = 'simplr.state.v9'
let idc = 1000
export const uid = (p = 'x') => `${p}${Date.now().toString(36)}${idc++}`

/** Live snapshot so non-React code (the AI engine) can read current state. */
export const live: { state: State | null } = { state: null }

type Action =
  | { type: 'ADD_DEAL'; deal: Deal }
  | { type: 'UPDATE_DEAL'; id: ID; patch: Partial<Deal> }
  | { type: 'MOVE_STAGE'; id: ID; stage: StageName }
  | { type: 'MARK_WON'; id: ID }
  | { type: 'MARK_LOST'; id: ID; reason?: string }
  | { type: 'ADD_PERSON'; person: Person }
  | { type: 'ADD_LEAD'; lead: Lead }
  | { type: 'ARCHIVE_LEAD'; id: ID }
  | { type: 'CONVERT_LEAD'; id: ID; deal: Deal; person: Person }
  | { type: 'ADD_ACTIVITY'; activity: Activity }
  | { type: 'TOGGLE_ACTIVITY'; id: ID }
  | { type: 'SEND_EMAIL'; email: EmailMsg; activity?: Activity }
  | { type: 'MARK_READ'; id: ID }
  | { type: 'TOGGLE_MEETING_BOT'; id: ID }
  | { type: 'PROCESS_MEETING'; id: ID; activities: Activity[] }
  | { type: 'TOGGLE_AGENT'; id: ID }
  | { type: 'RESOLVE_RUN'; id: ID; status: 'approved' | 'dismissed'; email?: EmailMsg; activity?: Activity }
  | { type: 'TOGGLE_CONNECTION'; id: ID }
  | { type: 'TOAST'; toast: Toast }
  | { type: 'DISMISS_TOAST'; id: ID }
  | { type: 'SET_RAIL'; expanded: boolean }
  | { type: 'ADD_FIELD'; field: import('./types').CustomField }
  | { type: 'REMOVE_FIELD'; id: ID }
  | { type: 'SET_CUSTOM'; entity: 'deal' | 'person' | 'org'; id: ID; fieldId: ID; value: string }
  | { type: 'ENRICH_ORG'; id: ID; patch: Partial<Org> }
  | { type: 'ADD_CONNECTION'; conn: import('./types').Connection }
  | { type: 'ADD_WEBHOOK'; webhook: import('./types').Webhook }
  | { type: 'REMOVE_WEBHOOK'; id: ID }
  | { type: 'ADD_APIKEY'; key: import('./types').ApiKey }
  | { type: 'REVOKE_APIKEY'; id: ID }
  | { type: 'TOGGLE_INTEGRATION'; id: ID }
  | { type: 'SCHEDULE_POST'; post: import('./types').SocialPost }
  | { type: 'ADD_SEQUENCE'; seq: import('./types').Sequence }
  | { type: 'TOGGLE_SEQUENCE'; id: ID }
  | { type: 'UPDATE_AUTOMATION'; id: ID; patch: Partial<import('./types').Automation> }
  | { type: 'LI_UPDATE'; id: ID; patch: Partial<import('./types').LinkedInThread>; activity?: Activity }
  | { type: 'ADVANCE_ENROLMENT'; id: ID; patch: Partial<import('./types').Enrolment>; activity?: Activity }
  | { type: 'BULK_ADD_LEADS'; leads: Lead[] }
  | { type: 'ADD_REACH_CAMPAIGN'; campaign: import('./types').ReachCampaign; enrolments: import('./types').Enrolment[] }
  | { type: 'ADD_SCHEDULED'; task: import('./types').ScheduledTask }
  | { type: 'TOGGLE_SCHEDULED'; id: ID }
  | { type: 'REMOVE_SCHEDULED'; id: ID }
  | { type: 'UPDATE_STUDIO_CONFIG'; patch: Partial<import('./types').StudioConfig> }
  | { type: 'ADD_PROJECT'; project: import('./types').StudioProject }
  | { type: 'UPDATE_PROJECT'; id: ID; patch: Partial<import('./types').StudioProject> }
  | { type: 'ADD_PLAYBOOK'; playbook: import('./types').Playbook }
  | { type: 'UPDATE_PLAYBOOK'; id: ID; patch: Partial<import('./types').Playbook> }
  | { type: 'REMOVE_PLAYBOOK'; id: ID }
  | { type: 'UPDATE_BRANDKIT'; patch: Partial<import('./types').BrandKit> }
  | { type: 'ADD_BRANDDOC'; doc: import('./types').BrandDoc }
  | { type: 'REMOVE_BRANDDOC'; id: ID }
  | { type: 'ADD_ORG'; org: import('./types').Org }
  | { type: 'ADD_MEETING'; meeting: import('./types').Meeting }
  | { type: 'ADD_PRODUCT'; product: import('../data/mock').Product }
  | { type: 'ADD_DOCUMENT'; doc: import('./types').CrmDocument }
  | { type: 'UPDATE_DOCUMENT'; id: ID; patch: Partial<import('./types').CrmDocument> }
  | { type: 'ADD_AGENT'; agent: import('./types').Agent }
  | { type: 'ADD_LITHREAD'; thread: import('./types').LinkedInThread }
  | { type: 'ADD_SEQSTEP'; seqId: ID; step: import('./types').SeqStep }
  | { type: 'ADD_EMAILCAMPAIGN'; campaign: import('./types').EmailCampaign }
  | { type: 'RESET' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_DEAL':
      return { ...state, deals: [action.deal, ...state.deals] }
    case 'UPDATE_DEAL':
      return { ...state, deals: state.deals.map((d) => (d.id === action.id ? { ...d, ...action.patch } : d)) }
    case 'MOVE_STAGE': {
      const d = state.deals.find((x) => x.id === action.id)
      const changed = d && d.stage !== action.stage
      return {
        ...state,
        deals: state.deals.map((x) => (x.id === action.id ? { ...x, stage: action.stage } : x)),
        activities: changed
          ? [{ id: uid('act'), type: 'change', subject: `Stage moved to ${action.stage}`, body: `From ${d!.stage}`, dealId: action.id, done: true, who: 'Jordan Miles', createdAt: Date.now() }, ...state.activities]
          : state.activities,
      }
    }
    case 'MARK_WON':
      return { ...state, deals: state.deals.map((d) => (d.id === action.id ? { ...d, won: true, lost: false, health: 'Healthy' } : d)) }
    case 'MARK_LOST':
      return { ...state, deals: state.deals.map((d) => (d.id === action.id ? { ...d, lost: true, won: false, lostReason: action.reason } : d)) }
    case 'ADD_PERSON':
      return { ...state, people: [action.person, ...state.people] }
    case 'ADD_LEAD':
      return { ...state, leads: [action.lead, ...state.leads] }
    case 'ARCHIVE_LEAD':
      return { ...state, leads: state.leads.map((l) => (l.id === action.id ? { ...l, archived: true } : l)) }
    case 'CONVERT_LEAD':
      return {
        ...state,
        leads: state.leads.map((l) => (l.id === action.id ? { ...l, converted: true, archived: true } : l)),
        people: [action.person, ...state.people],
        deals: [action.deal, ...state.deals],
      }
    case 'ADD_ACTIVITY':
      return { ...state, activities: [action.activity, ...state.activities] }
    case 'TOGGLE_ACTIVITY':
      return { ...state, activities: state.activities.map((a) => (a.id === action.id ? { ...a, done: !a.done } : a)) }
    case 'SEND_EMAIL':
      return {
        ...state,
        emails: [action.email, ...state.emails],
        activities: action.activity ? [action.activity, ...state.activities] : state.activities,
      }
    case 'MARK_READ':
      return { ...state, emails: state.emails.map((e) => (e.id === action.id ? { ...e, unread: false } : e)) }
    case 'TOGGLE_MEETING_BOT':
      return { ...state, meetings: state.meetings.map((m) => (m.id === action.id ? { ...m, bot: !m.bot } : m)) }
    case 'PROCESS_MEETING':
      return {
        ...state,
        meetings: state.meetings.map((m) => (m.id === action.id ? { ...m, processed: true } : m)),
        activities: [...action.activities, ...state.activities],
      }
    case 'TOGGLE_AGENT':
      return { ...state, agents: state.agents.map((a) => (a.id === action.id ? { ...a, on: !a.on, runs: a.on ? 'Paused' : 'Running' } : a)) }
    case 'RESOLVE_RUN':
      return {
        ...state,
        agentRuns: state.agentRuns.map((r) => (r.id === action.id ? { ...r, status: action.status } : r)),
        emails: action.email ? [action.email, ...state.emails] : state.emails,
        activities: action.activity ? [action.activity, ...state.activities] : state.activities,
      }
    case 'TOGGLE_CONNECTION':
      return { ...state, connections: state.connections.map((c) => (c.id === action.id ? { ...c, connected: !c.connected } : c)) }
    case 'TOAST':
      return { ...state, toasts: [...state.toasts, action.toast] }
    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) }
    case 'SET_RAIL':
      return { ...state, railExpanded: action.expanded }
    case 'ADD_FIELD':
      return { ...state, customFields: [...state.customFields, action.field] }
    case 'REMOVE_FIELD':
      return { ...state, customFields: state.customFields.filter((f) => f.id !== action.id) }
    case 'SET_CUSTOM': {
      const apply = <T extends { id: ID; custom?: Record<string, string> }>(arr: T[]) =>
        arr.map((e) => (e.id === action.id ? { ...e, custom: { ...e.custom, [action.fieldId]: action.value } } : e))
      if (action.entity === 'deal') return { ...state, deals: apply(state.deals) }
      if (action.entity === 'person') return { ...state, people: apply(state.people) }
      return { ...state, orgs: apply(state.orgs) }
    }
    case 'ENRICH_ORG':
      return { ...state, orgs: state.orgs.map((o) => (o.id === action.id ? { ...o, ...action.patch, enriched: true } : o)) }
    case 'ADD_CONNECTION':
      return { ...state, connections: [...state.connections, action.conn] }
    case 'ADD_WEBHOOK':
      return { ...state, webhooks: [...state.webhooks, action.webhook] }
    case 'REMOVE_WEBHOOK':
      return { ...state, webhooks: state.webhooks.filter((w) => w.id !== action.id) }
    case 'ADD_APIKEY':
      return { ...state, apiKeys: [...state.apiKeys, action.key] }
    case 'REVOKE_APIKEY':
      return { ...state, apiKeys: state.apiKeys.filter((k) => k.id !== action.id) }
    case 'TOGGLE_INTEGRATION':
      return { ...state, integrations: state.integrations.map((i) => (i.id === action.id ? { ...i, installed: !i.installed } : i)) }
    case 'SCHEDULE_POST':
      return { ...state, socialPosts: [action.post, ...state.socialPosts] }
    case 'ADD_SEQUENCE':
      return { ...state, sequences: [action.seq, ...state.sequences] }
    case 'TOGGLE_SEQUENCE':
      return { ...state, sequences: state.sequences.map((s) => (s.id === action.id ? { ...s, active: !s.active } : s)) }
    case 'UPDATE_AUTOMATION':
      return { ...state, automations: state.automations.map((a) => (a.id === action.id ? { ...a, ...action.patch } : a)) }
    case 'LI_UPDATE':
      return {
        ...state,
        linkedinThreads: state.linkedinThreads.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
        activities: action.activity ? [action.activity, ...state.activities] : state.activities,
      }
    case 'ADVANCE_ENROLMENT':
      return {
        ...state,
        enrolments: state.enrolments.map((e) => (e.id === action.id ? { ...e, ...action.patch } : e)),
        activities: action.activity ? [action.activity, ...state.activities] : state.activities,
      }
    case 'BULK_ADD_LEADS':
      return { ...state, leads: [...action.leads, ...state.leads] }
    case 'ADD_REACH_CAMPAIGN':
      return { ...state, reachCampaigns: [action.campaign, ...state.reachCampaigns], enrolments: [...action.enrolments, ...state.enrolments] }
    case 'ADD_SCHEDULED':
      return { ...state, scheduledTasks: [action.task, ...state.scheduledTasks] }
    case 'TOGGLE_SCHEDULED':
      return { ...state, scheduledTasks: state.scheduledTasks.map((t) => (t.id === action.id ? { ...t, active: !t.active } : t)) }
    case 'REMOVE_SCHEDULED':
      return { ...state, scheduledTasks: state.scheduledTasks.filter((t) => t.id !== action.id) }
    case 'UPDATE_STUDIO_CONFIG':
      return { ...state, studioConfig: { ...state.studioConfig, ...action.patch } }
    case 'ADD_PROJECT':
      return { ...state, projects: [action.project, ...state.projects] }
    case 'UPDATE_PROJECT':
      return { ...state, projects: state.projects.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)) }
    case 'ADD_PLAYBOOK':
      return { ...state, playbooks: [action.playbook, ...state.playbooks] }
    case 'UPDATE_PLAYBOOK':
      return { ...state, playbooks: state.playbooks.map((p) => (p.id === action.id ? { ...p, ...action.patch, updatedAt: Date.now() } : p)) }
    case 'REMOVE_PLAYBOOK':
      return { ...state, playbooks: state.playbooks.filter((p) => p.id !== action.id) }
    case 'UPDATE_BRANDKIT':
      return { ...state, brandKit: { ...state.brandKit, ...action.patch } }
    case 'ADD_BRANDDOC':
      return { ...state, brandDocs: [action.doc, ...state.brandDocs] }
    case 'REMOVE_BRANDDOC':
      return { ...state, brandDocs: state.brandDocs.filter((d) => d.id !== action.id) }
    case 'ADD_ORG':
      return { ...state, orgs: [action.org, ...state.orgs] }
    case 'ADD_MEETING':
      return { ...state, meetings: [action.meeting, ...state.meetings] }
    case 'ADD_PRODUCT':
      return { ...state, products: [action.product, ...state.products] }
    case 'ADD_DOCUMENT':
      return { ...state, documents: [action.doc, ...state.documents] }
    case 'UPDATE_DOCUMENT':
      return { ...state, documents: state.documents.map((d) => (d.id === action.id ? { ...d, ...action.patch } : d)) }
    case 'ADD_AGENT':
      return { ...state, agents: [...state.agents, action.agent] }
    case 'ADD_LITHREAD':
      return { ...state, linkedinThreads: [action.thread, ...state.linkedinThreads] }
    case 'ADD_SEQSTEP':
      return { ...state, sequences: state.sequences.map((s) => (s.id === action.seqId ? { ...s, steps: [...s.steps, action.step] } : s)) }
    case 'ADD_EMAILCAMPAIGN':
      return { ...state, emailCampaigns: [action.campaign, ...state.emailCampaigns] }
    case 'RESET':
      return buildSeed()
    default:
      return state
  }
}

function load(): State {
  const seed = buildSeed()
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Partial<State>
      // Merge seed defaults for any keys the saved state predates, so schema
      // additions never leave a collection undefined.
      return { ...seed, ...saved, toasts: [] }
    }
  } catch {
    /* fall through to seed */
  }
  return seed
}

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  live.state = state
  useEffect(() => {
    live.state = state
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* ignore quota */
    }
  }, [state])
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

function useStore() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useStore must be used within StoreProvider')
  return c
}

export function useState_() {
  return useStore().state
}

/* ---- Action hook: high-level, side-effecting helpers ---- */
export function useActions() {
  const { dispatch } = useStore()
  const toast = (text: string, tone: Toast['tone'] = 'positive') => dispatch({ type: 'TOAST', toast: { id: uid('t'), text, tone } })

  return {
    dispatch,
    toast,
    dismissToast: (id: ID) => dispatch({ type: 'DISMISS_TOAST', id }),

    addDeal: (partial: Partial<Deal> & { name: string; org: string; value: number; stage: StageName }) => {
      const deal: Deal = {
        id: uid('d'),
        subtitle: partial.subtitle ?? '',
        closeDate: partial.closeDate ?? 'This quarter',
        owner: partial.owner ?? 'Jordan Miles',
        health: partial.health ?? 'Healthy',
        chips: partial.chips ?? [{ label: 'New', tone: 'accent' }],
        personIds: partial.personIds ?? [],
        probability: partial.probability ?? 30,
        orgId: partial.orgId,
        ...partial,
      }
      dispatch({ type: 'ADD_DEAL', deal })
      toast(`Deal “${deal.name}” created`)
      return deal
    },
    moveStage: (id: ID, stage: StageName) => dispatch({ type: 'MOVE_STAGE', id, stage }),
    markWon: (id: ID, name: string) => {
      dispatch({ type: 'MARK_WON', id })
      dispatch({ type: 'ADD_ACTIVITY', activity: { id: uid('act'), type: 'change', subject: 'Deal marked Won 🎉', dealId: id, done: true, who: 'Jordan Miles', createdAt: Date.now() } })
      toast(`“${name}” marked won`)
    },
    markLost: (id: ID, name: string, reason?: string) => {
      dispatch({ type: 'MARK_LOST', id, reason })
      toast(`“${name}” marked lost`, 'warning')
    },
    updateDeal: (id: ID, patch: Partial<Deal>) => dispatch({ type: 'UPDATE_DEAL', id, patch }),

    addPerson: (partial: Partial<Person> & { name: string }) => {
      const person: Person = {
        id: uid('p'),
        role: partial.role ?? '',
        org: partial.org ?? '',
        phone: partial.phone ?? '',
        email: partial.email ?? '',
        owner: partial.owner ?? 'Jordan Miles',
        labels: partial.labels ?? [],
        orgId: partial.orgId,
        ...partial,
      }
      dispatch({ type: 'ADD_PERSON', person })
      toast(`Contact “${person.name}” added`)
      return person
    },

    addLead: (partial: Partial<Lead> & { name: string; company: string }) => {
      const lead: Lead = {
        id: uid('l'),
        role: partial.role ?? '',
        source: partial.source ?? 'Manual',
        owner: partial.owner ?? 'Jordan Miles',
        created: 'Just now',
        score: partial.score ?? 60,
        ...partial,
      }
      dispatch({ type: 'ADD_LEAD', lead })
      toast(`Lead “${lead.name}” added`)
      return lead
    },
    archiveLead: (id: ID, name: string) => {
      dispatch({ type: 'ARCHIVE_LEAD', id })
      toast(`Lead “${name}” archived`, 'warning')
    },
    convertLead: (lead: Lead) => {
      const person: Person = { id: uid('p'), name: lead.name, role: lead.role, org: lead.company, phone: '', email: `${lead.name.split(' ')[0].toLowerCase()}@${lead.company.split(' ')[0].toLowerCase()}.com`, owner: lead.owner, labels: [] }
      const deal: Deal = { id: uid('d'), name: `${lead.company} opportunity`, org: lead.company, subtitle: 'Converted from lead', value: 50000, stage: 'Qualified', closeDate: 'This quarter', owner: lead.owner, health: 'Healthy', chips: [{ label: 'Converted', tone: 'positive' }], personIds: [person.id], probability: 20 }
      dispatch({ type: 'CONVERT_LEAD', id: lead.id, deal, person })
      dispatch({ type: 'ADD_ACTIVITY', activity: { id: uid('act'), type: 'note', subject: 'Converted from lead', dealId: deal.id, personId: person.id, done: true, who: lead.owner, createdAt: Date.now(), source: 'manual' } })
      toast(`“${lead.name}” converted to a deal + contact`)
      return deal
    },

    addActivity: (partial: Partial<Activity> & { type: Activity['type']; subject: string }) => {
      const activity: Activity = {
        id: uid('act'),
        done: partial.done ?? false,
        who: partial.who ?? 'Jordan Miles',
        createdAt: Date.now(),
        source: partial.source ?? 'manual',
        ...partial,
      }
      dispatch({ type: 'ADD_ACTIVITY', activity })
      return activity
    },
    logActivity: (partial: Partial<Activity> & { type: Activity['type']; subject: string }, toastMsg?: string) => {
      const activity: Activity = { id: uid('act'), done: partial.done ?? false, who: 'Jordan Miles', createdAt: Date.now(), source: 'manual', ...partial }
      dispatch({ type: 'ADD_ACTIVITY', activity })
      if (toastMsg) toast(toastMsg)
      return activity
    },
    toggleActivity: (id: ID) => dispatch({ type: 'TOGGLE_ACTIVITY', id }),

    sendEmail: (email: Omit<EmailMsg, 'id' | 'createdAt' | 'folder'> & { folder?: EmailMsg['folder'] }) => {
      const full: EmailMsg = { id: uid('em'), createdAt: Date.now(), folder: email.folder ?? 'sent', ...email }
      const activity: Activity | undefined = email.dealId || email.personId
        ? { id: uid('act'), type: 'email', subject: `Email sent: ${email.subject}`, body: email.body.slice(0, 140), dealId: email.dealId, personId: email.personId, done: true, who: 'Jordan Miles', createdAt: Date.now(), source: 'email' }
        : undefined
      dispatch({ type: 'SEND_EMAIL', email: full, activity })
      toast(`Email sent to ${email.to}`)
      return full
    },
    markRead: (id: ID) => dispatch({ type: 'MARK_READ', id }),

    toggleMeetingBot: (id: ID, on: boolean) => {
      dispatch({ type: 'TOGGLE_MEETING_BOT', id })
      toast(on ? 'Notetaker will not join this meeting' : 'Notetaker will join and transcribe', on ? 'warning' : 'positive')
    },
    processMeeting: (id: ID, dealId: ID | undefined, personId: ID | undefined, org: string) => {
      const acts: Activity[] = [
        { id: uid('act'), type: 'note', subject: `Meeting notes — ${org}`, body: 'AI summary: deal gated on liability-cap wording; finance signs off budget by month-end if resolved this week. Champion confirmed phased rollout. Client wants retainer to cover standby units.', dealId, personId, done: true, who: 'Simplr Notetaker', createdAt: Date.now(), source: 'meeting' },
        { id: uid('act'), type: 'email', subject: 'Send liability-cap wording to Marta Lund', dealId, personId, done: false, priority: 'High', due: 'Today', who: 'Simplr Notetaker', createdAt: Date.now(), source: 'meeting' },
        { id: uid('act'), type: 'task', subject: 'Split maintenance retainer on the quote', dealId, done: false, priority: 'Medium', due: 'Tomorrow', who: 'Simplr Notetaker', createdAt: Date.now(), source: 'meeting' },
        { id: uid('act'), type: 'meeting', subject: 'Book legal walkthrough call', dealId, personId, done: false, priority: 'High', due: 'This week', who: 'Simplr Notetaker', createdAt: Date.now(), source: 'meeting' },
      ]
      dispatch({ type: 'PROCESS_MEETING', id, activities: acts })
      toast(`Notes + 3 action items added to ${org}’s card`)
    },

    toggleAgent: (id: ID, name: string, on: boolean) => {
      dispatch({ type: 'TOGGLE_AGENT', id })
      toast(`${name} ${on ? 'paused' : 'activated'}`, on ? 'warning' : 'positive')
    },
    approveRun: (run: import('./types').AgentRun) => {
      let email: EmailMsg | undefined
      let activity: Activity | undefined
      if (run.kind === 'draft' && run.emailTo) {
        email = { id: uid('em'), folder: 'sent', from: 'Jordan Miles', fromEmail: 'jordan@simplr.io', to: run.emailTo, subject: run.title.replace(/^Drafted reply to /, 'Re: '), body: run.emailBody ?? '', dealId: run.dealId, personId: run.personId, time: 'Just now', createdAt: Date.now() }
        activity = { id: uid('act'), type: 'email', subject: `Email sent (AI): ${run.title}`, dealId: run.dealId, personId: run.personId, done: true, who: 'Simplr AI', createdAt: Date.now(), source: 'ai' }
      } else if (run.kind === 'task' || run.kind === 'risk') {
        activity = { id: uid('act'), type: run.kind === 'risk' ? 'email' : 'task', subject: run.title.replace(/^Suggested task: /, ''), dealId: run.dealId, personId: run.personId, due: 'Today', priority: 'High', done: false, who: 'Simplr AI', createdAt: Date.now(), source: 'ai' }
      }
      dispatch({ type: 'RESOLVE_RUN', id: run.id, status: 'approved', email, activity })
      toast('Approved — action applied to your CRM')
    },
    dismissRun: (id: ID) => {
      dispatch({ type: 'RESOLVE_RUN', id, status: 'dismissed' })
      toast('Dismissed', 'warning')
    },
    toggleConnection: (id: ID, provider: string, connected: boolean) => {
      dispatch({ type: 'TOGGLE_CONNECTION', id })
      toast(connected ? `${provider} disconnected` : `${provider} connected`, connected ? 'warning' : 'positive')
    },
    setRail: (expanded: boolean) => dispatch({ type: 'SET_RAIL', expanded }),
    updateStudioConfig: (patch: Partial<import('./types').StudioConfig>) => dispatch({ type: 'UPDATE_STUDIO_CONFIG', patch }),
    startProject: (project: import('./types').StudioProject) => {
      dispatch({ type: 'ADD_PROJECT', project })
      toast(`Delivery started — ${project.address}`)
      return project
    },
    advanceMilestone: (p: import('./types').StudioProject) => {
      const next = Math.min(p.milestones.length - 1, p.milestoneIndex + 1)
      const milestones = p.milestones.map((m, i) => ({ ...m, done: i < next, date: i === p.milestoneIndex ? new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : m.date }))
      const patch: Partial<import('./types').StudioProject> = { milestoneIndex: next, milestones }
      if (next === p.milestones.length - 1) patch.ptoDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      dispatch({ type: 'UPDATE_PROJECT', id: p.id, patch })
      toast(next === p.milestones.length - 1 ? `${p.address} — PTO reached 🎉` : `${p.address} → ${p.milestones[next].label}`)
    },
    setMilestone: (id: ID, milestones: import('./types').ProjectMilestone[], milestoneIndex: number) => dispatch({ type: 'UPDATE_PROJECT', id, patch: { milestones, milestoneIndex } }),
    toggleProjectTask: (p: import('./types').StudioProject, taskId: ID) => {
      const tasks = p.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t))
      dispatch({ type: 'UPDATE_PROJECT', id: p.id, patch: { tasks } })
    },
    updateProject: (id: ID, patch: Partial<import('./types').StudioProject>) => dispatch({ type: 'UPDATE_PROJECT', id, patch }),
    // ── Ordering (materials / equipment per installation) ──
    addOrder: (projectId: ID, order: import('./types').ProjectOrder) => {
      const p = live.state?.projects.find((x) => x.id === projectId)
      if (!p) return
      dispatch({ type: 'UPDATE_PROJECT', id: projectId, patch: { orders: [...(p.orders ?? []), order] } })
      toast(`Order added — ${order.supplier}`)
    },
    setOrderStatus: (projectId: ID, orderId: ID, status: import('./types').OrderStatus) => {
      const p = live.state?.projects.find((x) => x.id === projectId)
      if (!p) return
      const stamp = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      const orders = (p.orders ?? []).map((o) => (o.id === orderId ? { ...o, status, orderedDate: status === 'ordered' ? (o.orderedDate ?? stamp) : o.orderedDate } : o))
      dispatch({ type: 'UPDATE_PROJECT', id: projectId, patch: { orders } })
    },
    removeOrder: (projectId: ID, orderId: ID) => {
      const p = live.state?.projects.find((x) => x.id === projectId)
      if (!p) return
      dispatch({ type: 'UPDATE_PROJECT', id: projectId, patch: { orders: (p.orders ?? []).filter((o) => o.id !== orderId) } })
    },
    // ── Invoicing (per installation) ──
    addInvoice: (projectId: ID, invoice: import('./types').ProjectInvoice) => {
      const p = live.state?.projects.find((x) => x.id === projectId)
      if (!p) return
      dispatch({ type: 'UPDATE_PROJECT', id: projectId, patch: { invoices: [...(p.invoices ?? []), invoice] } })
      toast(`Invoice ${invoice.number} created`)
    },
    setInvoiceStatus: (projectId: ID, invoiceId: ID, status: import('./types').InvoiceStatus) => {
      const p = live.state?.projects.find((x) => x.id === projectId)
      if (!p) return
      const stamp = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      const invoices = (p.invoices ?? []).map((i) => (i.id === invoiceId ? { ...i, status, paidDate: status === 'paid' ? (i.paidDate ?? stamp) : undefined } : i))
      dispatch({ type: 'UPDATE_PROJECT', id: projectId, patch: { invoices } })
      if (status === 'paid') toast('Invoice marked paid 🎉', 'positive')
    },
    removeInvoice: (projectId: ID, invoiceId: ID) => {
      const p = live.state?.projects.find((x) => x.id === projectId)
      if (!p) return
      dispatch({ type: 'UPDATE_PROJECT', id: projectId, patch: { invoices: (p.invoices ?? []).filter((i) => i.id !== invoiceId) } })
    },
    // ── AI Context / playbooks (the agent "brain") ──
    addPlaybook: (pb: Omit<import('./types').Playbook, 'id' | 'updatedAt'>) => {
      dispatch({ type: 'ADD_PLAYBOOK', playbook: { ...pb, id: uid('pb'), updatedAt: Date.now() } })
      toast(`Playbook added — ${pb.title}`)
    },
    updatePlaybook: (id: ID, patch: Partial<import('./types').Playbook>) => dispatch({ type: 'UPDATE_PLAYBOOK', id, patch }),
    togglePlaybook: (id: ID, active: boolean) => dispatch({ type: 'UPDATE_PLAYBOOK', id, patch: { active } }),
    removePlaybook: (id: ID, title: string) => { dispatch({ type: 'REMOVE_PLAYBOOK', id }); toast(`Playbook “${title}” removed`, 'warning') },
    // ── Brand & Documents ──
    updateBrandKit: (patch: Partial<import('./types').BrandKit>) => dispatch({ type: 'UPDATE_BRANDKIT', patch }),
    addBrandDoc: (doc: Omit<import('./types').BrandDoc, 'id' | 'createdAt'>) => {
      const full: import('./types').BrandDoc = { ...doc, id: uid('bd'), createdAt: Date.now() }
      dispatch({ type: 'ADD_BRANDDOC', doc: full })
      toast(`${full.title} — generated, branded`)
      return full
    },
    removeBrandDoc: (id: ID) => dispatch({ type: 'REMOVE_BRANDDOC', id }),
    // ── Core CRUD: organisations, meetings, products, documents ──
    addOrg: (partial: Partial<import('./types').Org> & { name: string }) => {
      const org: import('./types').Org = {
        id: uid('o'), industry: '—', people: 0, openValue: 0, wonLifetime: 0, owner: 'Jordan Miles', relationship: 'New', ...partial,
      }
      dispatch({ type: 'ADD_ORG', org })
      toast(`Organisation “${org.name}” added`)
      return org
    },
    addMeeting: (partial: Partial<import('./types').Meeting> & { title: string }) => {
      const meeting: import('./types').Meeting = {
        id: uid('mt'), platform: 'Teams', when: 'Soon', dealOrg: '', attendees: [], status: 'upcoming', bot: true, ...partial,
      }
      dispatch({ type: 'ADD_MEETING', meeting })
      toast(`Meeting “${meeting.title}” scheduled`)
      return meeting
    },
    addProduct: (partial: Partial<import('../data/mock').Product> & { name: string }) => {
      const product: import('../data/mock').Product = {
        id: uid('pr'), sku: '—', category: 'Hardware', unitPrice: 0, billing: 'One-off', openDeals: 0, active: true, ...partial,
      }
      dispatch({ type: 'ADD_PRODUCT', product })
      toast(`Product “${product.name}” added`)
      return product
    },
    addDocument: (partial: Partial<import('./types').CrmDocument> & { deal: string; value: number }) => {
      const n = (live.state?.documents.length ?? 0) + 1042
      const doc: import('./types').CrmDocument = {
        id: uid('doc'), ref: `QUO-${n}`, status: 'Draft', views: 0, sent: '—', createdAt: Date.now(), ...partial,
      }
      dispatch({ type: 'ADD_DOCUMENT', doc })
      toast(`Quote ${doc.ref} created`)
      return doc
    },
    updateDocument: (id: ID, patch: Partial<import('./types').CrmDocument>) => dispatch({ type: 'UPDATE_DOCUMENT', id, patch }),
    addAgent: (name: string, desc: string) => {
      dispatch({ type: 'ADD_AGENT', agent: { id: uid('ag'), name, desc, runs: 'Ready', on: true } })
      toast(`Agent “${name}” created & switched on`)
    },
    addLinkedInThread: (name: string, company: string, message: string) => {
      const thread: import('./types').LinkedInThread = {
        id: uid('li'), name, company, headline: company, kind: 'message', status: 'open',
        preview: message.slice(0, 80), time: 'Just now', createdAt: Date.now(),
      }
      dispatch({ type: 'ADD_LITHREAD', thread })
      toast(`Message drafted to ${name}`)
      return thread
    },
    addSequenceStep: (seqId: ID, type: import('./types').SeqStepType, label: string, day: number) => {
      dispatch({ type: 'ADD_SEQSTEP', seqId, step: { id: uid('st'), type, label, day } })
      toast('Step added to sequence')
    },
    addEmailCampaign: (name: string, type: string) => {
      const campaign: import('./types').EmailCampaign = { id: uid('ec'), name, type, sent: 0, opens: 0, clicks: 0, deals: 0, status: 'Draft', createdAt: Date.now() }
      dispatch({ type: 'ADD_EMAILCAMPAIGN', campaign })
      toast(`Campaign “${name}” created as a draft`)
      return campaign
    },
    addAdder: (name: string, amount: number) => {
      const cur = live.state?.studioConfig.adders ?? []
      dispatch({ type: 'UPDATE_STUDIO_CONFIG', patch: { adders: [...cur, { id: uid('ad'), name, amount }] } })
      toast(`Adder “${name}” added`)
    },
    removeAdder: (id: ID) => {
      const cur = live.state?.studioConfig.adders ?? []
      dispatch({ type: 'UPDATE_STUDIO_CONFIG', patch: { adders: cur.filter((a) => a.id !== id) } })
    },
    addFinance: (f: Omit<import('./types').FinanceProduct, 'id'>) => {
      const cur = live.state?.studioConfig.finance ?? []
      dispatch({ type: 'UPDATE_STUDIO_CONFIG', patch: { finance: [...cur, { id: uid('fin'), ...f }] } })
      toast(`Finance product “${f.name}” added`)
    },
    removeFinance: (id: ID) => {
      const cur = live.state?.studioConfig.finance ?? []
      dispatch({ type: 'UPDATE_STUDIO_CONFIG', patch: { finance: cur.filter((f) => f.id !== id) } })
    },
    aiBuildCalculator: (filename: string) => {
      // Simulated: a real backend runs Claude over the uploaded file to extract pricing.
      dispatch({ type: 'UPDATE_STUDIO_CONFIG', patch: { costPerKwp: 1290, marginPct: 22 } })
      toast(`Calculator built from “${filename}” — review the extracted values`)
    },
    addField: (entity: 'deal' | 'person' | 'org', label: string, type: import('./types').CustomField['type'], options?: string[]) => {
      dispatch({ type: 'ADD_FIELD', field: { id: uid('cf'), entity, label, type, options } })
      toast(`Field “${label}” added`)
    },
    removeField: (id: ID, label: string) => { dispatch({ type: 'REMOVE_FIELD', id }); toast(`Field “${label}” removed`, 'warning') },
    setCustom: (entity: 'deal' | 'person' | 'org', id: ID, fieldId: ID, value: string) => dispatch({ type: 'SET_CUSTOM', entity, id, fieldId, value }),
    enrichOrg: (id: ID, name: string) => {
      dispatch({ type: 'ENRICH_ORG', id, patch: {} })
      toast(`Enriched ${name} — firmographics + stakeholders added`)
    },
    connectEmail: (provider: string, account: string, protocol: 'oauth' | 'imap') => {
      dispatch({ type: 'ADD_CONNECTION', conn: { id: uid('cn'), kind: 'email', provider, account, connected: true, color: '#1D4ED8', protocol } })
      toast(`${account} connected — you can now send from this address`)
    },
    addWebhook: (url: string, events: string[]) => {
      dispatch({ type: 'ADD_WEBHOOK', webhook: { id: uid('wh'), url, events, active: true } })
      toast('Webhook added')
    },
    removeWebhook: (id: ID) => { dispatch({ type: 'REMOVE_WEBHOOK', id }); toast('Webhook removed', 'warning') },
    createApiKey: (label: string) => {
      const key = `sk_live_${Math.random().toString(36).slice(2, 6)}…${Math.random().toString(36).slice(2, 6)}`
      dispatch({ type: 'ADD_APIKEY', key: { id: uid('ak'), label, key, created: 'Just now' } })
      toast(`API key “${label}” created`)
    },
    revokeApiKey: (id: ID, label: string) => { dispatch({ type: 'REVOKE_APIKEY', id }); toast(`Key “${label}” revoked`, 'warning') },
    toggleIntegration: (id: ID, name: string, installed: boolean) => {
      dispatch({ type: 'TOGGLE_INTEGRATION', id })
      toast(installed ? `${name} removed` : `${name} connected`, installed ? 'warning' : 'positive')
    },
    schedulePost: (channels: string[], body: string, when: string) => {
      dispatch({ type: 'SCHEDULE_POST', post: { id: uid('sp'), channels, body, when, status: 'scheduled' } })
      toast(`Post scheduled to ${channels.join(', ')}`)
    },
    addSequence: (name: string, steps: import('./types').SeqStep[]) => {
      dispatch({ type: 'ADD_SEQUENCE', seq: { id: uid('sq'), name, steps, enrolled: 0, active: true, replyRate: 0 } })
      toast(`Sequence “${name}” created`)
    },
    toggleSequence: (id: ID, active: boolean) => { dispatch({ type: 'TOGGLE_SEQUENCE', id }); toast(active ? 'Sequence paused' : 'Sequence activated', active ? 'warning' : 'positive') },
    updateAutomation: (id: ID, patch: Partial<import('./types').Automation>) => dispatch({ type: 'UPDATE_AUTOMATION', id, patch }),
    saveAutomation: (id: ID, patch: Partial<import('./types').Automation>) => { dispatch({ type: 'UPDATE_AUTOMATION', id, patch }); toast('Automation saved') },
    liReply: (t: import('./types').LinkedInThread, body: string) => {
      const activity: Activity = { id: uid('act'), type: 'note', subject: `LinkedIn message to ${t.name}`, body, personId: t.personId, done: true, who: 'Jordan Miles', createdAt: Date.now(), source: 'manual' }
      dispatch({ type: 'LI_UPDATE', id: t.id, patch: { status: 'open', preview: body, time: 'Just now', createdAt: Date.now() }, activity })
      toast(`LinkedIn message sent to ${t.name}`)
    },
    liAccept: (t: import('./types').LinkedInThread) => {
      const activity: Activity = { id: uid('act'), type: 'note', subject: `LinkedIn connection accepted — ${t.name}`, personId: t.personId, done: true, who: 'System', createdAt: Date.now(), source: 'manual' }
      dispatch({ type: 'LI_UPDATE', id: t.id, patch: { status: 'accepted', kind: 'message', preview: 'Connected. Send a first message.' }, activity })
      toast(`Connected with ${t.name}`)
    },
    bulkAddLeads: (rows: { name: string; company: string; role: string; score: number }[]) => {
      const leads: Lead[] = rows.map((r) => ({ id: uid('l'), name: r.name, role: r.role, company: r.company, source: 'Simplr AI', owner: 'Jordan Miles', created: 'Just now', score: r.score }))
      dispatch({ type: 'BULK_ADD_LEADS', leads })
      return leads
    },
    createReachCampaign: (name: string, vertical: string, rows: { name: string; company: string }[], sequence = 'AI multichannel') => {
      const enrolments: import('./types').Enrolment[] = rows.slice(0, 12).map((r, i) => ({
        id: uid('en'), sequenceId: 'sq1', name: r.name, company: r.company, channel: i % 3 === 0 ? 'LinkedIn' : 'Email', stepIndex: 0, totalSteps: 5, stepLabel: 'Intro — personalised', status: i < 3 ? 'due' : 'pending', nextDue: i < 3 ? 'Now' : 'Queued',
      }))
      const campaign: import('./types').ReachCampaign = { id: uid('rc'), name, vertical, audience: rows.length, sequence, channels: ['Email', 'LinkedIn'], status: 'running', sent: 0, replies: 0, meetings: 0, createdBy: 'AI', createdAt: Date.now() }
      dispatch({ type: 'ADD_REACH_CAMPAIGN', campaign, enrolments })
      return campaign
    },
    addScheduledTask: (prompt: string, cadence: string) => {
      dispatch({ type: 'ADD_SCHEDULED', task: { id: uid('st'), prompt, cadence, nextRun: cadence, active: true, createdAt: Date.now() } })
      toast('Scheduled task created')
    },
    toggleScheduled: (id: ID, active: boolean) => { dispatch({ type: 'TOGGLE_SCHEDULED', id }); toast(active ? 'Task paused' : 'Task activated', active ? 'warning' : 'positive') },
    removeScheduled: (id: ID) => { dispatch({ type: 'REMOVE_SCHEDULED', id }); toast('Scheduled task removed', 'warning') },
    advanceEnrolment: (e: import('./types').Enrolment) => {
      const done = e.stepIndex + 1 >= e.totalSteps
      const activity: Activity = { id: uid('act'), type: e.channel === 'Email' ? 'email' : 'note', subject: `${e.channel} step sent: ${e.stepLabel}`, personId: e.personId, done: true, who: 'Jordan Miles', createdAt: Date.now(), source: 'ai' }
      dispatch({ type: 'ADVANCE_ENROLMENT', id: e.id, patch: { status: 'sent', stepIndex: Math.min(e.stepIndex + 1, e.totalSteps), nextDue: done ? 'Complete' : 'in 2 days' }, activity })
      toast(`${e.channel} step sent to ${e.name}`)
    },
    reset: () => {
      dispatch({ type: 'RESET' })
      toast('Demo data reset')
    },
  }
}

/* ---- Selectors ---- */
export function useSelectors() {
  const s = useState_()
  return {
    dealById: (id?: ID) => s.deals.find((d) => d.id === id),
    personById: (id?: ID) => s.people.find((p) => p.id === id),
    orgById: (id?: ID) => s.orgs.find((o) => o.id === id),
    dealActivities: (dealId: ID) => s.activities.filter((a) => a.dealId === dealId).sort((a, b) => b.createdAt - a.createdAt),
    personActivities: (personId: ID) => s.activities.filter((a) => a.personId === personId).sort((a, b) => b.createdAt - a.createdAt),
    openTasks: (dealId?: ID) => s.activities.filter((a) => !a.done && a.type !== 'note' && a.type !== 'change' && (dealId ? a.dealId === dealId : true)),
    dealEmails: (dealId: ID) => s.emails.filter((e) => e.dealId === dealId),
    personEmails: (personId: ID) => s.emails.filter((e) => e.personId === personId),
    peopleForDeal: (deal: { personIds: ID[] }) => s.people.filter((p) => deal.personIds.includes(p.id)),
    openDeals: () => s.deals.filter((d) => !d.won && !d.lost),
    unreadCount: () => s.emails.filter((e) => e.folder === 'inbox' && e.unread).length,
    openTaskCount: () => s.activities.filter((a) => !a.done && (a.type === 'task' || a.type === 'call' || a.type === 'meeting' || a.type === 'email')).length,
  }
}
