import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { buildSeed } from './seed'
import type { State, Deal, Person, Lead, Org, Activity, EmailMsg, Toast, ID } from './types'
import type { StageName } from '../data/mock'

const KEY = 'simplr.state.v4'
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
