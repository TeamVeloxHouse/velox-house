import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { buildSeed } from './seed'
import * as pipelineHelpers from '../lib/pipelines'
import { buildApplication, buildDocPack, nextStatus, newEventId, stamp, resolveDno, classify, statusEventLabel, dnoRefPrefix, autopilotSteps } from '../lib/dno'
import type { PipelineStage, DnoApplication, DnoStatus, DnoDocKind, StudioProject } from './types'
import type { State, Deal, Person, Lead, Org, Activity, EmailMsg, Toast, ID, SolarCampaign, SolarProspect, SolarContact, SolarProspectStatus, SiteSurvey, SurveyProductKey } from './types'
import { surveyRef, photoSlotsFor, surveyToDnoSite, surveyFlags, completeness } from '../lib/survey'
import { AI_MEMBER_ID, YOU_MEMBER_ID } from './types'
import type { StageName } from '../data/mock'

const KEY = 'simplr.state.v19'
let idc = 1000
export const uid = (p = 'x') => `${p}${Date.now().toString(36)}${idc++}`

/** Live snapshot so non-React code (the AI engine) can read current state. */
export const live: { state: State | null } = { state: null }

/** Re-spread stage colours across the ramp after add/remove/reorder. */
const recolour = (stages: PipelineStage[]): PipelineStage[] => stages.map((s, i) => ({ ...s, color: pipelineHelpers.stageColor(i, stages.length) }))

type Action =
  | { type: 'ADD_DEAL'; deal: Deal }
  | { type: 'UPDATE_DEAL'; id: ID; patch: Partial<Deal> }
  | { type: 'MOVE_STAGE'; id: ID; stage: StageName }
  | { type: 'MARK_WON'; id: ID }
  | { type: 'MARK_LOST'; id: ID; reason?: string }
  | { type: 'REMOVE_DEAL'; id: ID }
  | { type: 'ADD_PORTAL'; portal: import('./types').CustomerPortal }
  | { type: 'UPDATE_PORTAL'; id: ID; patch: Partial<import('./types').CustomerPortal> }
  | { type: 'ADD_PORTAL_EVENT'; event: import('./types').PortalEvent }
  | { type: 'ADD_RESOURCE'; resource: import('./types').PortalResource }
  | { type: 'REMOVE_RESOURCE'; id: ID }
  | { type: 'ADD_WIDGET'; widget: import('./types').DashboardWidget }
  | { type: 'REMOVE_WIDGET'; id: ID }
  | { type: 'REORDER_WIDGETS'; widgets: import('./types').DashboardWidget[] }
  | { type: 'ADD_PIPELINE'; pipeline: import('./types').Pipeline }
  | { type: 'UPDATE_PIPELINE'; id: ID; patch: Partial<import('./types').Pipeline> }
  | { type: 'REMOVE_PIPELINE'; id: ID; reassignTo: ID }
  | { type: 'SET_ACTIVE_PIPELINE'; id: ID }
  | { type: 'SET_FEATURES_ALL'; features: import('./types').Features }
  | { type: 'ADD_PERSON'; person: Person }
  | { type: 'REMOVE_PERSON'; id: ID }
  | { type: 'REMOVE_ORG'; id: ID }
  | { type: 'MERGE_PERSON'; keepId: ID; dropId: ID }
  | { type: 'MERGE_ORG'; keepId: ID; dropId: ID }
  | { type: 'ADD_LEAD'; lead: Lead }
  | { type: 'ARCHIVE_LEAD'; id: ID }
  | { type: 'SET_LEAD_STATUS'; id: ID; status: import('./types').LeadStatus }
  | { type: 'CONVERT_LEAD'; id: ID; deal: Deal; person: Person }
  | { type: 'ADD_ACTIVITY'; activity: Activity }
  | { type: 'UPDATE_ACTIVITY'; id: ID; patch: Partial<Activity> }
  | { type: 'TOGGLE_ACTIVITY'; id: ID }
  | { type: 'SEND_EMAIL'; email: EmailMsg; activity?: Activity }
  | { type: 'ADD_EMAIL'; email: EmailMsg }
  | { type: 'UPDATE_EMAIL'; id: ID; patch: Partial<EmailMsg> }
  | { type: 'REMOVE_EMAIL'; id: ID }
  | { type: 'SET_AUTO_REPLY'; mode: import('./types').AutoReplyMode }
  | { type: 'MARK_READ'; id: ID }
  | { type: 'TOGGLE_MEETING_BOT'; id: ID }
  | { type: 'PROCESS_MEETING'; id: ID; activities: Activity[] }
  | { type: 'TOGGLE_AGENT'; id: ID }
  | { type: 'RESOLVE_RUN'; id: ID; status: 'approved' | 'dismissed'; email?: EmailMsg; activity?: Activity }
  | { type: 'TOGGLE_CONNECTION'; id: ID }
  | { type: 'TOAST'; toast: Toast }
  | { type: 'DISMISS_TOAST'; id: ID }
  | { type: 'SET_RAIL'; expanded: boolean }
  | { type: 'ADD_SOLAR_CAMPAIGN'; campaign: import('./types').SolarCampaign }
  | { type: 'UPDATE_SOLAR_CAMPAIGN'; id: ID; patch: Partial<import('./types').SolarCampaign> }
  | { type: 'REMOVE_SOLAR_CAMPAIGN'; id: ID }
  | { type: 'ADD_SOLAR_PROSPECTS'; prospects: import('./types').SolarProspect[] }
  | { type: 'UPDATE_SOLAR_PROSPECT'; id: ID; patch: Partial<import('./types').SolarProspect> }
  | { type: 'REVEAL_SOLAR_CONTACTS'; id: ID; contacts: import('./types').SolarContact[] }
  | { type: 'REMOVE_SOLAR_PROSPECT'; id: ID }
  | { type: 'ADD_DESIGN'; design: import('./types').Design }
  | { type: 'UPDATE_DESIGN'; id: ID; patch: Partial<import('./types').Design> }
  | { type: 'REMOVE_DESIGN'; id: ID }
  | { type: 'ADD_SURVEY'; survey: import('./types').SiteSurvey }
  | { type: 'UPDATE_SURVEY'; id: ID; patch: Partial<import('./types').SiteSurvey> }
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
  | { type: 'ADD_AUTOMATION'; automation: import('./types').Automation }
  | { type: 'UPDATE_AUTOMATION'; id: ID; patch: Partial<import('./types').Automation> }
  | { type: 'REMOVE_AUTOMATION'; id: ID }
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
  | { type: 'SET_TRADE'; trade: import('./types').TradeKey; features: import('./types').Features }
  | { type: 'SET_FEATURES'; patch: Partial<import('./types').Features> }
  | { type: 'COMPLETE_ONBOARDING' }
  | { type: 'SET_ROLE'; role: import('./types').UserRole }
  | { type: 'ADD_JOB'; job: import('./types').Job }
  | { type: 'UPDATE_JOB'; id: ID; patch: Partial<import('./types').Job> }
  | { type: 'REMOVE_JOB'; id: ID }
  | { type: 'ADD_TEAM_MESSAGE'; message: import('./types').TeamMessage }
  | { type: 'UPDATE_TEAM_MESSAGE'; id: ID; patch: Partial<import('./types').TeamMessage> }
  | { type: 'UPDATE_TEAM_MEMBER'; id: ID; patch: Partial<import('./types').TeamMember> }
  | { type: 'ADD_TEAM_CHANNEL'; channel: import('./types').TeamChannel }
  | { type: 'MARK_CHANNEL_READ'; id: ID }
  | { type: 'ADD_ANNOUNCEMENT'; announcement: import('./types').Announcement }
  | { type: 'TOGGLE_CHEER'; id: ID; by: ID }
  | { type: 'SET_LEAVE_STATUS'; id: ID; status: import('./types').LeaveRequest['status'] }
  | { type: 'SET_EXPENSE_STATUS'; id: ID; status: import('./types').Expense['status'] }
  | { type: 'RESPOND_REVIEW'; id: ID }
  | { type: 'UPDATE_POLICY'; id: ID; patch: Partial<import('./types').Policy> }
  | { type: 'FULFIL_REQUEST'; id: ID; status: import('./types').RequestStatus; note?: string }
  | { type: 'ADD_CONTENT'; item: import('./types').ContentItem }
  | { type: 'ADVANCE_CONTENT'; id: ID; status: import('./types').ContentStatus }
  | { type: 'TOGGLE_MKT_CONNECTOR'; id: ID }
  | { type: 'ADD_BRAND_ASSET'; asset: import('./types').BrandAsset }
  | { type: 'ADD_MEDIA'; media: import('./types').MediaAsset }
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
    case 'REMOVE_DEAL':
      return {
        ...state,
        deals: state.deals.filter((d) => d.id !== action.id),
        activities: state.activities.filter((a) => a.dealId !== action.id),
        emails: state.emails.filter((e) => e.dealId !== action.id),
      }
    case 'ADD_PORTAL':
      return { ...state, portals: [action.portal, ...state.portals] }
    case 'UPDATE_PORTAL':
      return { ...state, portals: state.portals.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)) }
    case 'ADD_PORTAL_EVENT':
      return { ...state, portalEvents: [action.event, ...state.portalEvents] }
    case 'ADD_RESOURCE':
      return { ...state, portalResources: [action.resource, ...state.portalResources] }
    case 'REMOVE_RESOURCE':
      return { ...state, portalResources: state.portalResources.filter((r) => r.id !== action.id) }
    case 'ADD_WIDGET':
      return { ...state, dashboardWidgets: [...state.dashboardWidgets, action.widget] }
    case 'REMOVE_WIDGET':
      return { ...state, dashboardWidgets: state.dashboardWidgets.filter((w) => w.id !== action.id) }
    case 'REORDER_WIDGETS':
      return { ...state, dashboardWidgets: action.widgets }
    case 'ADD_PIPELINE':
      return { ...state, pipelines: [...state.pipelines, action.pipeline] }
    case 'UPDATE_PIPELINE':
      return { ...state, pipelines: state.pipelines.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)) }
    case 'REMOVE_PIPELINE': {
      const gone = state.pipelines.find((p) => p.id === action.id)
      const target = state.pipelines.find((p) => p.id === action.reassignTo)
      const fallbackStage = target?.stages[0]?.name
      return {
        ...state,
        pipelines: state.pipelines.filter((p) => p.id !== action.id),
        // move that pipeline's deals to the reassignment pipeline (+ snap stage into range)
        deals: state.deals.map((d) => {
          const inGone = (d.pipelineId ?? state.pipelines[0]?.id) === action.id
          if (!inGone || !gone) return d
          const stageStillValid = target?.stages.some((s) => s.name === d.stage)
          return { ...d, pipelineId: action.reassignTo, stage: stageStillValid ? d.stage : (fallbackStage ?? d.stage) }
        }),
        activePipelineId: state.activePipelineId === action.id ? action.reassignTo : state.activePipelineId,
      }
    }
    case 'SET_ACTIVE_PIPELINE':
      return { ...state, activePipelineId: action.id }
    case 'SET_FEATURES_ALL':
      return { ...state, features: action.features }
    case 'ADD_PERSON':
      return { ...state, people: [action.person, ...state.people] }
    case 'REMOVE_PERSON':
      return {
        ...state,
        people: state.people.filter((p) => p.id !== action.id),
        // pull the contact off every deal it was linked to
        deals: state.deals.map((d) => (d.personIds.includes(action.id) ? { ...d, personIds: d.personIds.filter((id) => id !== action.id) } : d)),
        // drop notes that only belonged to this contact; keep deal-linked ones but unlink the person
        activities: state.activities.filter((a) => !(a.personId === action.id && !a.dealId)).map((a) => (a.personId === action.id ? { ...a, personId: undefined } : a)),
        emails: state.emails.filter((e) => !(e.personId === action.id && !e.dealId)).map((e) => (e.personId === action.id ? { ...e, personId: undefined } : e)),
      }
    case 'REMOVE_ORG':
      return { ...state, orgs: state.orgs.filter((o) => o.id !== action.id) }
    case 'MERGE_PERSON': {
      const keep = state.people.find((p) => p.id === action.keepId)
      const drop = state.people.find((p) => p.id === action.dropId)
      if (!keep || !drop || keep.id === drop.id) return state
      const labels = [...new Set([...keep.labels, ...drop.labels])]
      return {
        ...state,
        people: state.people
          .filter((p) => p.id !== action.dropId)
          .map((p) => (p.id === action.keepId ? { ...p, labels, phone: p.phone || drop.phone, email: p.email || drop.email, role: p.role || drop.role, org: p.org || drop.org, custom: { ...drop.custom, ...p.custom } } : p)),
        deals: state.deals.map((d) => (d.personIds.includes(action.dropId) ? { ...d, personIds: [...new Set(d.personIds.map((id) => (id === action.dropId ? action.keepId : id)))] } : d)),
        activities: state.activities.map((a) => (a.personId === action.dropId ? { ...a, personId: action.keepId } : a)),
        emails: state.emails.map((e) => (e.personId === action.dropId ? { ...e, personId: action.keepId } : e)),
      }
    }
    case 'MERGE_ORG': {
      const keep = state.orgs.find((o) => o.id === action.keepId)
      const drop = state.orgs.find((o) => o.id === action.dropId)
      if (!keep || !drop || keep.id === drop.id) return state
      return {
        ...state,
        orgs: state.orgs
          .filter((o) => o.id !== action.dropId)
          .map((o) => (o.id === action.keepId ? { ...o, people: o.people + drop.people, openValue: o.openValue + drop.openValue, wonLifetime: o.wonLifetime + drop.wonLifetime } : o)),
        deals: state.deals.map((d) => (d.orgId === action.dropId || d.org === drop.name ? { ...d, orgId: action.keepId, org: keep.name } : d)),
        people: state.people.map((p) => (p.orgId === action.dropId || p.org === drop.name ? { ...p, orgId: action.keepId, org: keep.name } : p)),
      }
    }
    case 'ADD_LEAD':
      return { ...state, leads: [action.lead, ...state.leads] }
    case 'ARCHIVE_LEAD':
      return { ...state, leads: state.leads.map((l) => (l.id === action.id ? { ...l, archived: true } : l)) }
    case 'SET_LEAD_STATUS':
      return { ...state, leads: state.leads.map((l) => (l.id === action.id ? { ...l, status: action.status, archived: action.status === 'unqualified' ? true : l.archived } : l)) }
    case 'CONVERT_LEAD':
      return {
        ...state,
        leads: state.leads.map((l) => (l.id === action.id ? { ...l, converted: true, archived: true, status: 'qualified' } : l)),
        people: [action.person, ...state.people],
        deals: [action.deal, ...state.deals],
        // carry the lead's captured context (notes/calls/emails) onto the new deal + contact
        activities: state.activities.map((a) => (a.leadId === action.id ? { ...a, dealId: action.deal.id, personId: action.person.id } : a)),
      }
    case 'ADD_ACTIVITY':
      return { ...state, activities: [action.activity, ...state.activities] }
    case 'UPDATE_ACTIVITY':
      return { ...state, activities: state.activities.map((a) => (a.id === action.id ? { ...a, ...action.patch } : a)) }
    case 'TOGGLE_ACTIVITY':
      return { ...state, activities: state.activities.map((a) => (a.id === action.id ? { ...a, done: !a.done, completedAt: !a.done ? Date.now() : undefined } : a)) }
    case 'SEND_EMAIL':
      return {
        ...state,
        emails: [action.email, ...state.emails],
        activities: action.activity ? [action.activity, ...state.activities] : state.activities,
      }
    case 'ADD_EMAIL':
      return { ...state, emails: [action.email, ...state.emails] }
    case 'UPDATE_EMAIL':
      return { ...state, emails: state.emails.map((e) => (e.id === action.id ? { ...e, ...action.patch } : e)) }
    case 'REMOVE_EMAIL':
      return { ...state, emails: state.emails.filter((e) => e.id !== action.id) }
    case 'SET_AUTO_REPLY':
      return { ...state, inboxAutoReply: action.mode }
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
    case 'ADD_SOLAR_CAMPAIGN':
      return { ...state, solarCampaigns: [action.campaign, ...state.solarCampaigns] }
    case 'UPDATE_SOLAR_CAMPAIGN':
      return { ...state, solarCampaigns: state.solarCampaigns.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)) }
    case 'REMOVE_SOLAR_CAMPAIGN':
      return { ...state, solarCampaigns: state.solarCampaigns.filter((c) => c.id !== action.id), solarProspects: state.solarProspects.filter((p) => p.campaignId !== action.id) }
    case 'ADD_SOLAR_PROSPECTS':
      return { ...state, solarProspects: [...action.prospects, ...state.solarProspects] }
    case 'UPDATE_SOLAR_PROSPECT':
      return { ...state, solarProspects: state.solarProspects.map((p) => (p.id === action.id ? { ...p, ...action.patch, updatedAt: Date.now() } : p)) }
    case 'REVEAL_SOLAR_CONTACTS':
      return { ...state, solarProspects: state.solarProspects.map((p) => (p.id === action.id ? { ...p, contacts: action.contacts, contactsRevealed: true, updatedAt: Date.now() } : p)) }
    case 'REMOVE_SOLAR_PROSPECT':
      return { ...state, solarProspects: state.solarProspects.filter((p) => p.id !== action.id) }
    case 'ADD_DESIGN':
      return { ...state, designs: [action.design, ...state.designs] }
    case 'UPDATE_DESIGN':
      return { ...state, designs: state.designs.map((d) => (d.id === action.id ? { ...d, ...action.patch, updatedAt: Date.now() } : d)) }
    case 'REMOVE_DESIGN':
      return { ...state, designs: state.designs.filter((d) => d.id !== action.id) }
    case 'ADD_SURVEY':
      return { ...state, surveys: [action.survey, ...state.surveys] }
    case 'UPDATE_SURVEY':
      return { ...state, surveys: state.surveys.map((s) => (s.id === action.id ? { ...s, ...action.patch, updatedAt: Date.now() } : s)) }
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
    case 'ADD_AUTOMATION':
      return { ...state, automations: [...state.automations, action.automation] }
    case 'UPDATE_AUTOMATION':
      return { ...state, automations: state.automations.map((a) => (a.id === action.id ? { ...a, ...action.patch } : a)) }
    case 'REMOVE_AUTOMATION':
      return { ...state, automations: state.automations.filter((a) => a.id !== action.id) }
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
    case 'SET_TRADE':
      return { ...state, activeTrade: action.trade, features: action.features }
    case 'SET_FEATURES':
      return { ...state, features: { ...state.features, ...action.patch } }
    case 'COMPLETE_ONBOARDING':
      return { ...state, onboarded: true }
    case 'SET_ROLE':
      return { ...state, currentRole: action.role }
    case 'ADD_JOB':
      return { ...state, jobs: [action.job, ...state.jobs] }
    case 'UPDATE_JOB':
      return { ...state, jobs: state.jobs.map((j) => (j.id === action.id ? { ...j, ...action.patch } : j)) }
    case 'REMOVE_JOB':
      return { ...state, jobs: state.jobs.filter((j) => j.id !== action.id) }
    case 'ADD_TEAM_MESSAGE':
      return {
        ...state,
        teamMessages: [...state.teamMessages, action.message],
        // bump the channel's unread unless the message is from the current viewer
        teamChannels: state.teamChannels.map((c) =>
          c.id === action.message.channelId && action.message.authorId !== YOU_MEMBER_ID
            ? { ...c, unread: c.unread + 1 }
            : c,
        ),
      }
    case 'UPDATE_TEAM_MESSAGE':
      return { ...state, teamMessages: state.teamMessages.map((m) => (m.id === action.id ? { ...m, ...action.patch } : m)) }
    case 'UPDATE_TEAM_MEMBER':
      return { ...state, teamMembers: state.teamMembers.map((m) => (m.id === action.id ? { ...m, ...action.patch } : m)) }
    case 'ADD_TEAM_CHANNEL':
      return { ...state, teamChannels: [...state.teamChannels, action.channel] }
    case 'MARK_CHANNEL_READ':
      return { ...state, teamChannels: state.teamChannels.map((c) => (c.id === action.id ? { ...c, unread: 0 } : c)) }
    case 'ADD_ANNOUNCEMENT':
      return { ...state, announcements: [action.announcement, ...state.announcements] }
    case 'TOGGLE_CHEER':
      return {
        ...state,
        announcements: state.announcements.map((a) =>
          a.id === action.id
            ? { ...a, cheers: a.cheers.includes(action.by) ? a.cheers.filter((x) => x !== action.by) : [...a.cheers, action.by] }
            : a,
        ),
      }
    case 'SET_LEAVE_STATUS':
      return { ...state, leaveRequests: state.leaveRequests.map((l) => (l.id === action.id ? { ...l, status: action.status } : l)) }
    case 'SET_EXPENSE_STATUS':
      return { ...state, expenses: state.expenses.map((e) => (e.id === action.id ? { ...e, status: action.status } : e)) }
    case 'RESPOND_REVIEW':
      return { ...state, reviews: state.reviews.map((r) => (r.id === action.id ? { ...r, responded: true } : r)) }
    case 'UPDATE_POLICY':
      return { ...state, policies: state.policies.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)) }
    case 'FULFIL_REQUEST':
      return { ...state, mktRequests: state.mktRequests.map((r) => (r.id === action.id ? { ...r, status: action.status, note: action.note ?? r.note } : r)) }
    case 'ADD_CONTENT':
      return { ...state, contentItems: [action.item, ...state.contentItems] }
    case 'ADVANCE_CONTENT':
      return { ...state, contentItems: state.contentItems.map((c) => (c.id === action.id ? { ...c, status: action.status } : c)) }
    case 'TOGGLE_MKT_CONNECTOR':
      return { ...state, mktConnectors: state.mktConnectors.map((c) => (c.id === action.id ? { ...c, connected: !c.connected } : c)) }
    case 'ADD_BRAND_ASSET':
      return { ...state, brandAssets: [action.asset, ...state.brandAssets] }
    case 'ADD_MEDIA':
      return { ...state, mediaAssets: [action.media, ...state.mediaAssets] }
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

  // Patch a project's DNO application (creating a draft from the project if absent).
  const patchDno = (projectId: ID, mut: (dno: DnoApplication, p: StudioProject) => DnoApplication) => {
    const p = live.state?.projects.find((x) => x.id === projectId)
    if (!p) return
    const current = p.dno ?? buildApplication(p)
    dispatch({ type: 'UPDATE_PROJECT', id: projectId, patch: { dno: mut(current, p) } })
  }

  return {
    dispatch,
    toast,
    dismissToast: (id: ID) => dispatch({ type: 'DISMISS_TOAST', id }),

    // ── Site surveys (mobile field capture → CRM) ──
    /** Start (or reopen) a survey. If a survey Job already has one, return it; else create a draft. */
    startSurvey: (opts: { jobId?: ID; dealId?: ID; projectId?: ID; personId?: ID; address: string; customer: string; surveyor?: string; products?: SurveyProductKey[] }) => {
      const existing = opts.jobId ? live.state?.surveys.find((s) => s.jobId === opts.jobId) : undefined
      if (existing) return existing
      const products = opts.products ?? ['solar', 'battery']
      const survey: SiteSurvey = {
        id: uid('sur'), ref: surveyRef(), jobId: opts.jobId, dealId: opts.dealId, projectId: opts.projectId, personId: opts.personId,
        address: opts.address, customer: opts.customer, surveyor: opts.surveyor ?? 'Jordan Miles',
        products, status: 'draft', answers: {}, roof: [],
        photos: photoSlotsFor(products).map((p) => ({ id: uid('ph'), section: p.section, key: p.key, label: p.label, required: p.required, captured: false })),
        createdAt: Date.now(), updatedAt: Date.now(),
      }
      dispatch({ type: 'ADD_SURVEY', survey })
      return survey
    },
    saveSurvey: (id: ID, patch: Partial<SiteSurvey>) => dispatch({ type: 'UPDATE_SURVEY', id, patch }),
    /** Submit a survey: lock it, complete the survey Job, log it on the deal, pre-fill DNO site details. */
    submitSurvey: (id: ID) => {
      const s = live.state?.surveys.find((x) => x.id === id)
      if (!s) return
      dispatch({ type: 'UPDATE_SURVEY', id, patch: { status: 'submitted', submittedAt: Date.now() } })
      // Complete the survey job it fulfils
      if (s.jobId) dispatch({ type: 'UPDATE_JOB', id: s.jobId, patch: { status: 'complete' } })
      // Timeline note on the deal (with the top risk flags)
      const flags = surveyFlags(s)
      const { pct } = completeness(s)
      dispatch({ type: 'ADD_ACTIVITY', activity: {
        id: uid('act'), type: 'file', subject: `Site survey submitted — ${s.ref} (${pct}% complete)`,
        body: flags.length ? `Flags:\n• ${flags.join('\n• ')}` : 'No risk flags raised.',
        dealId: s.dealId, personId: s.personId, jobId: s.jobId, done: true, who: s.surveyor, createdAt: Date.now(), source: 'manual',
      } })
      // Pre-fill DNO site details on the linked project (creates a draft application if absent)
      if (s.projectId) patchDno(s.projectId, (dno) => ({ ...dno, ...surveyToDnoSite(s) }))
      toast(`${s.ref} submitted — job closed, DNO site details pre-filled`, 'positive')
    },
    reviewSurvey: (id: ID) => dispatch({ type: 'UPDATE_SURVEY', id, patch: { status: 'reviewed' } }),
    /** Toggle a photo slot as captured/not (simulated on-site capture). */
    toggleSurveyPhoto: (id: ID, photoId: ID) => {
      const s = live.state?.surveys.find((x) => x.id === id)
      if (!s) return
      dispatch({ type: 'UPDATE_SURVEY', id, patch: { photos: s.photos.map((p) => (p.id === photoId ? { ...p, captured: !p.captured, name: !p.captured ? `${p.key}-${Date.now().toString(36)}.jpg` : undefined } : p)) } })
    },

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
        pipelineId: partial.pipelineId ?? live.state?.activePipelineId,
        ...partial,
      }
      dispatch({ type: 'ADD_DEAL', deal })
      toast(`Deal “${deal.name}” created`)
      return deal
    },
    moveStage: (id: ID, stage: StageName) => {
      dispatch({ type: 'MOVE_STAGE', id, stage })
      // keep the deal's win-confidence in step with the stage it's now in
      const deal = live.state?.deals.find((d) => d.id === id)
      const pipe = live.state?.pipelines.find((p) => p.id === (deal?.pipelineId ?? live.state?.activePipelineId))
      const st = pipe?.stages.find((s) => s.name === stage)
      if (st) dispatch({ type: 'UPDATE_DEAL', id, patch: { probability: st.probability, quoted: st.probability >= 55 || deal?.quoted } })
    },
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
    removeDeal: (id: ID, name: string) => { dispatch({ type: 'REMOVE_DEAL', id }); toast(`Deal “${name}” deleted`, 'warning') },

    // ── Customer portals ──
    createPortal: (p: Omit<import('./types').CustomerPortal, 'id' | 'invitedAt' | 'status'> & { status?: import('./types').CustomerPortal['status'] }) => {
      const portal: import('./types').CustomerPortal = { id: uid('cp'), invitedAt: Date.now(), status: p.status ?? 'invited', ...p }
      dispatch({ type: 'ADD_PORTAL', portal })
      toast(`Portal created for ${portal.customer}`)
      return portal
    },
    sendPortalInvite: (portal: import('./types').CustomerPortal) => {
      dispatch({ type: 'UPDATE_PORTAL', id: portal.id, patch: { invitedAt: Date.now() } })
      const link = `https://portal.tellovi.io/welcome/${portal.id}`
      const email: EmailMsg = {
        id: uid('em'), folder: 'sent', from: 'TellOvi', fromEmail: 'hello@tellovi.io', to: portal.email || portal.customer,
        subject: 'Your solar portal is ready',
        body: `Hi ${portal.customer.split(' ')[0]},\n\nYour personal solar portal is live. It's where you'll find your system, live savings, all your documents, and help whenever you need it.\n\nLog in here: ${link}\n\n— The TellOvi team`,
        replyToId: undefined, time: 'Just now', createdAt: Date.now(),
      }
      dispatch({ type: 'SEND_EMAIL', email })
      dispatch({ type: 'ADD_PORTAL_EVENT', event: { id: uid('pe'), portalId: portal.id, section: 'Ask Ovi', label: 'Invite sent', kind: 'login', at: Date.now() } })
      toast(`Portal invite emailed to ${portal.customer}`)
    },
    activatePortal: (id: ID) => {
      dispatch({ type: 'UPDATE_PORTAL', id, patch: { status: 'active', lastActiveAt: Date.now() } })
      dispatch({ type: 'ADD_PORTAL_EVENT', event: { id: uid('pe'), portalId: id, section: 'Ask Ovi', label: 'Logged in', kind: 'login', at: Date.now() } })
    },
    referFriend: (portal: import('./types').CustomerPortal, name: string, company: string, note: string) => {
      const lead: Lead = { id: uid('l'), name, role: '', company: company || 'Homeowner', source: 'Customer referral', owner: portal.customer.split(' ')[0] === '' ? 'Jordan Miles' : 'Jordan Miles', created: 'Just now', createdAt: Date.now(), score: 78, status: 'new', referredByPortal: portal.id }
      dispatch({ type: 'ADD_LEAD', lead })
      dispatch({ type: 'ADD_PORTAL_EVENT', event: { id: uid('pe'), portalId: portal.id, section: 'Referrals', label: `Referred ${name}`, kind: 'click', at: Date.now() } })
      toast(`Thanks! ${name} sent to the team as a referral 🎉`, 'positive')
      void note
      return lead
    },
    updatePortal: (id: ID, patch: Partial<import('./types').CustomerPortal>) => dispatch({ type: 'UPDATE_PORTAL', id, patch }),
    logPortalEvent: (portalId: ID, section: string, label: string, kind: import('./types').PortalEventKind, dwellMs?: number) => {
      dispatch({ type: 'ADD_PORTAL_EVENT', event: { id: uid('pe'), portalId, section, label, kind, at: Date.now(), dwellMs } })
      dispatch({ type: 'UPDATE_PORTAL', id: portalId, patch: { lastActiveAt: Date.now() } })
    },
    /** A customer reports a problem from their portal → a traceable service job for the team. */
    reportPortalIssue: (portal: import('./types').CustomerPortal, item: string, description: string, photoName?: string) => {
      const n = (live.state?.jobs.length ?? 0) + 2050
      const job: import('./types').Job = {
        id: uid('job'), ref: `JOB-${n}`, kind: 'remedial', title: `Support: ${item}`, customer: portal.customer, address: portal.address,
        dealId: portal.dealId, portalId: portal.id, crew: [], durationMins: 90, status: 'unscheduled', notes: description, createdAt: Date.now(),
      }
      dispatch({ type: 'ADD_JOB', job })
      dispatch({ type: 'ADD_ACTIVITY', activity: { id: uid('act'), type: 'change', subject: `${job.ref} raised — ${item}`, body: `${portal.customer} via portal${photoName ? ` · photo: ${photoName}` : ''} — ${description}`, jobId: job.id, dealId: portal.dealId, done: false, priority: 'High', due: 'Today', who: portal.customer, createdAt: Date.now(), source: 'manual' } })
      dispatch({ type: 'ADD_PORTAL_EVENT', event: { id: uid('pe'), portalId: portal.id, section: 'Support', label: `Reported: ${item}`, kind: 'click', at: Date.now() } })
      toast(`${portal.customer}'s issue logged — ${job.ref} in the field backlog`, 'accent')
      return job
    },
    addResource: (r: Omit<import('./types').PortalResource, 'id'>) => {
      dispatch({ type: 'ADD_RESOURCE', resource: { ...r, id: uid('pr') } })
      toast(`“${r.title}” added to the resource library`)
    },
    removeResource: (id: ID) => dispatch({ type: 'REMOVE_RESOURCE', id }),

    // ── Editable dashboard widgets ──
    addWidget: (w: Omit<import('./types').DashboardWidget, 'id'>) => {
      dispatch({ type: 'ADD_WIDGET', widget: { ...w, id: uid('w') } })
      toast(`“${w.title}” added to your dashboard`)
    },
    removeWidget: (id: ID) => dispatch({ type: 'REMOVE_WIDGET', id }),
    reorderWidgets: (widgets: import('./types').DashboardWidget[]) => dispatch({ type: 'REORDER_WIDGETS', widgets }),

    // ── Configurable pipelines ──
    setActivePipeline: (id: ID) => dispatch({ type: 'SET_ACTIVE_PIPELINE', id }),
    addPipelineFromTemplate: (templateKey: string, name?: string) => {
      const t = pipelineHelpers.templateByKey(templateKey)
      if (!t) return undefined
      const pipeline = pipelineHelpers.pipelineFromTemplate(t, uid('pipe'), name)
      dispatch({ type: 'ADD_PIPELINE', pipeline })
      dispatch({ type: 'SET_ACTIVE_PIPELINE', id: pipeline.id })
      toast(`Pipeline “${pipeline.name}” created`)
      return pipeline
    },
    renamePipeline: (id: ID, name: string) => dispatch({ type: 'UPDATE_PIPELINE', id, patch: { name } }),
    removePipeline: (id: ID, name: string) => {
      const others = (live.state?.pipelines ?? []).filter((p) => p.id !== id)
      if (others.length === 0) { toast('You need at least one pipeline', 'warning'); return }
      dispatch({ type: 'REMOVE_PIPELINE', id, reassignTo: others[0].id })
      toast(`Pipeline “${name}” deleted — its deals moved to “${others[0].name}”`, 'warning')
    },
    // stage CRUD (compute the new stages array, then patch the pipeline)
    addStage: (pipelineId: ID, name: string, probability = 50) => {
      const p = live.state?.pipelines.find((x) => x.id === pipelineId)
      if (!p) return
      const stages = [...p.stages, { id: uid('st'), name, probability, color: pipelineHelpers.stageColor(p.stages.length, p.stages.length + 1) }]
      dispatch({ type: 'UPDATE_PIPELINE', id: pipelineId, patch: { stages: recolour(stages) } })
      toast(`Stage “${name}” added`)
    },
    updateStage: (pipelineId: ID, stageId: ID, patch: Partial<import('./types').PipelineStage>) => {
      const p = live.state?.pipelines.find((x) => x.id === pipelineId)
      if (!p) return
      dispatch({ type: 'UPDATE_PIPELINE', id: pipelineId, patch: { stages: p.stages.map((s) => (s.id === stageId ? { ...s, ...patch } : s)) } })
    },
    removeStage: (pipelineId: ID, stageId: ID) => {
      const p = live.state?.pipelines.find((x) => x.id === pipelineId)
      if (!p || p.stages.length <= 2) { toast('A pipeline needs at least two stages', 'warning'); return }
      dispatch({ type: 'UPDATE_PIPELINE', id: pipelineId, patch: { stages: recolour(p.stages.filter((s) => s.id !== stageId)) } })
    },
    moveStageOrder: (pipelineId: ID, stageId: ID, dir: -1 | 1) => {
      const p = live.state?.pipelines.find((x) => x.id === pipelineId)
      if (!p) return
      const i = p.stages.findIndex((s) => s.id === stageId)
      const j = i + dir
      if (i < 0 || j < 0 || j >= p.stages.length) return
      const stages = [...p.stages]
      ;[stages[i], stages[j]] = [stages[j], stages[i]]
      dispatch({ type: 'UPDATE_PIPELINE', id: pipelineId, patch: { stages: recolour(stages) } })
    },
    // Apply an industry template to a pipeline (replace its stages) + set its modules.
    applyIndustryTemplate: (pipelineId: ID, templateKey: string) => {
      const t = pipelineHelpers.templateByKey(templateKey)
      const p = live.state?.pipelines.find((x) => x.id === pipelineId)
      if (!t || !p) return
      dispatch({ type: 'UPDATE_PIPELINE', id: pipelineId, patch: { stages: pipelineHelpers.makeStages(t.stages) } })
      dispatch({ type: 'SET_FEATURES_ALL', features: { ...t.features } })
      toast(`“${t.name}” applied — pipeline & workspace reshaped`)
    },

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
    removePerson: (id: ID, name: string) => { dispatch({ type: 'REMOVE_PERSON', id }); toast(`Contact “${name}” deleted`, 'warning') },
    mergePeople: (keepId: ID, dropId: ID, dropName: string) => { dispatch({ type: 'MERGE_PERSON', keepId, dropId }); toast(`Merged “${dropName}” — duplicate removed & history kept`) },

    addLead: (partial: Partial<Lead> & { name: string; company: string }) => {
      const lead: Lead = {
        id: uid('l'),
        role: partial.role ?? '',
        source: partial.source ?? 'Manual',
        owner: partial.owner ?? 'Jordan Miles',
        created: 'Just now',
        createdAt: Date.now(),
        score: partial.score ?? 60,
        status: partial.status ?? 'new',
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
    setLeadStatus: (id: ID, status: import('./types').LeadStatus, name?: string) => {
      dispatch({ type: 'SET_LEAD_STATUS', id, status })
      if (name) toast(status === 'unqualified' ? `“${name}” marked unqualified` : `“${name}” → ${status}`, status === 'unqualified' ? 'warning' : 'positive')
    },
    convertLead: (lead: Lead) => {
      const person: Person = { id: uid('p'), name: lead.name, role: lead.role, org: lead.company, phone: lead.phone ?? '', email: lead.email ?? `${lead.name.split(' ')[0].toLowerCase()}@${lead.company.split(' ')[0].toLowerCase()}.com`, owner: lead.owner, labels: [] }
      const deal: Deal = { id: uid('d'), name: `${lead.company} opportunity`, org: lead.company, subtitle: 'Converted from lead', value: lead.value ?? 50000, stage: 'Qualified', closeDate: 'This quarter', owner: lead.owner, health: 'Healthy', chips: [{ label: 'Converted', tone: 'positive' }], personIds: [person.id], probability: 20 }
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
    updateActivity: (id: ID, patch: Partial<Activity>, toastMsg?: string) => { dispatch({ type: 'UPDATE_ACTIVITY', id, patch }); if (toastMsg) toast(toastMsg) },
    toggleSubtask: (id: ID, subId: ID) => {
      const a = live.state?.activities.find((x) => x.id === id)
      if (!a?.subtasks) return
      dispatch({ type: 'UPDATE_ACTIVITY', id, patch: { subtasks: a.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s)) } })
    },

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
    setAutoReply: (mode: import('./types').AutoReplyMode) => {
      dispatch({ type: 'SET_AUTO_REPLY', mode })
      toast(mode === 'off' ? 'Ovi auto-reply off' : mode === 'draft' ? 'Ovi will draft replies for your approval' : 'Ovi will auto-send replies', mode === 'send' ? 'accent' : 'positive')
    },
    /** Ovi drafts (or, in send mode, sends) a reply to an inbound email. */
    oviDraftReply: (original: EmailMsg, body: string, send: boolean) => {
      dispatch({ type: 'UPDATE_EMAIL', id: original.id, patch: { handled: true } })
      if (send) {
        const sent: EmailMsg = { id: uid('em'), folder: 'sent', from: 'TellOvi AI', fromEmail: 'jordan@tellovi.io', to: original.fromEmail, subject: `Re: ${original.subject}`, body, dealId: original.dealId, personId: original.personId, dealLabel: original.dealLabel, replyToId: original.id, time: 'Just now', createdAt: Date.now() }
        const activity: Activity | undefined = original.dealId || original.personId
          ? { id: uid('act'), type: 'email', subject: `Auto-reply sent: ${original.subject}`, body: body.slice(0, 140), dealId: original.dealId, personId: original.personId, done: true, who: 'TellOvi AI', createdAt: Date.now(), source: 'ai' }
          : undefined
        dispatch({ type: 'SEND_EMAIL', email: sent, activity })
        return sent
      }
      const draft: EmailMsg = { id: uid('em'), folder: 'drafts', from: 'Jordan Miles', fromEmail: 'jordan@tellovi.io', to: original.fromEmail, subject: `Re: ${original.subject}`, body, dealId: original.dealId, personId: original.personId, dealLabel: original.dealLabel, replyToId: original.id, aiDrafted: true, time: 'Just now', createdAt: Date.now() }
      dispatch({ type: 'ADD_EMAIL', email: draft })
      return draft
    },
    approveDraft: (draft: EmailMsg) => {
      dispatch({ type: 'UPDATE_EMAIL', id: draft.id, patch: { folder: 'sent', aiDrafted: false, time: 'Just now' } })
      if (draft.dealId || draft.personId) {
        dispatch({ type: 'ADD_ACTIVITY', activity: { id: uid('act'), type: 'email', subject: `Reply sent: ${draft.subject}`, body: draft.body.slice(0, 140), dealId: draft.dealId, personId: draft.personId, done: true, who: 'Jordan Miles', createdAt: Date.now(), source: 'ai' } })
      }
      toast(`Reply sent to ${draft.to}`)
    },
    updateDraft: (id: ID, body: string) => dispatch({ type: 'UPDATE_EMAIL', id, patch: { body } }),
    dismissDraft: (id: ID) => { dispatch({ type: 'REMOVE_EMAIL', id }); toast('Draft dismissed', 'warning') },

    toggleMeetingBot: (id: ID, on: boolean) => {
      dispatch({ type: 'TOGGLE_MEETING_BOT', id })
      toast(on ? 'Notetaker will not join this meeting' : 'Notetaker will join and transcribe', on ? 'warning' : 'positive')
    },
    processMeeting: (id: ID, dealId: ID | undefined, personId: ID | undefined, org: string) => {
      const acts: Activity[] = [
        { id: uid('act'), type: 'note', subject: `Meeting notes — ${org}`, body: 'AI summary: deal gated on liability-cap wording; finance signs off budget by month-end if resolved this week. Champion confirmed phased rollout. Client wants retainer to cover standby units.', dealId, personId, done: true, who: 'TellOvi Notetaker', createdAt: Date.now(), source: 'meeting' },
        { id: uid('act'), type: 'email', subject: 'Send liability-cap wording to Marta Lund', dealId, personId, done: false, priority: 'High', due: 'Today', who: 'TellOvi Notetaker', createdAt: Date.now(), source: 'meeting' },
        { id: uid('act'), type: 'task', subject: 'Split maintenance retainer on the quote', dealId, done: false, priority: 'Medium', due: 'Tomorrow', who: 'TellOvi Notetaker', createdAt: Date.now(), source: 'meeting' },
        { id: uid('act'), type: 'meeting', subject: 'Book legal walkthrough call', dealId, personId, done: false, priority: 'High', due: 'This week', who: 'TellOvi Notetaker', createdAt: Date.now(), source: 'meeting' },
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
        email = { id: uid('em'), folder: 'sent', from: 'Jordan Miles', fromEmail: 'jordan@tellovi.io', to: run.emailTo, subject: run.title.replace(/^Drafted reply to /, 'Re: '), body: run.emailBody ?? '', dealId: run.dealId, personId: run.personId, time: 'Just now', createdAt: Date.now() }
        activity = { id: uid('act'), type: 'email', subject: `Email sent (AI): ${run.title}`, dealId: run.dealId, personId: run.personId, done: true, who: 'TellOvi AI', createdAt: Date.now(), source: 'ai' }
      } else if (run.kind === 'task' || run.kind === 'risk') {
        activity = { id: uid('act'), type: run.kind === 'risk' ? 'email' : 'task', subject: run.title.replace(/^Suggested task: /, ''), dealId: run.dealId, personId: run.personId, due: 'Today', priority: 'High', done: false, who: 'TellOvi AI', createdAt: Date.now(), source: 'ai' }
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

    // ── Commercial Solar Finder ──────────────────────────────────────────────
    createSolarCampaign: (partial: Partial<SolarCampaign> & { name: string; targetKwp: number }) => {
      const campaign: SolarCampaign = {
        id: uid('scamp'),
        createdAt: Date.now(),
        scanned: 0,
        status: partial.status ?? 'draft',
        ...partial,
      }
      dispatch({ type: 'ADD_SOLAR_CAMPAIGN', campaign })
      return campaign
    },
    updateSolarCampaign: (id: ID, patch: Partial<SolarCampaign>) => dispatch({ type: 'UPDATE_SOLAR_CAMPAIGN', id, patch }),
    renameSolarCampaign: (id: ID, name: string) => { dispatch({ type: 'UPDATE_SOLAR_CAMPAIGN', id, patch: { name } }); toast('Campaign renamed') },
    removeSolarCampaign: (id: ID) => { dispatch({ type: 'REMOVE_SOLAR_CAMPAIGN', id }); toast('Campaign deleted', 'warning') },
    addSolarProspects: (prospects: SolarProspect[]) => dispatch({ type: 'ADD_SOLAR_PROSPECTS', prospects }),
    updateSolarProspect: (id: ID, patch: Partial<SolarProspect>) => dispatch({ type: 'UPDATE_SOLAR_PROSPECT', id, patch }),
    setSolarProspectStatus: (id: ID, status: SolarProspectStatus) => dispatch({ type: 'UPDATE_SOLAR_PROSPECT', id, patch: { status } }),
    revealSolarContacts: (id: ID, contacts: SolarContact[]) => {
      dispatch({ type: 'REVEAL_SOLAR_CONTACTS', id, contacts })
      toast(`${contacts.length} contact${contacts.length === 1 ? '' : 's'} revealed`)
    },
    removeSolarProspect: (id: ID) => dispatch({ type: 'REMOVE_SOLAR_PROSPECT', id }),

    // ── Design Studio ─────────────────────────────────────────────────────────
    createDesign: (partial: Partial<import('./types').Design> & { name: string; address: string }) => {
      const design: import('./types').Design = {
        id: uid('dz'), status: 'draft', planes: [], obstacles: [], moduleWatts: 440, setbackM: 0,
        createdAt: Date.now(), updatedAt: Date.now(), ...partial,
      }
      dispatch({ type: 'ADD_DESIGN', design }); toast('Design created'); return design
    },
    updateDesign: (id: ID, patch: Partial<import('./types').Design>) => dispatch({ type: 'UPDATE_DESIGN', id, patch }),
    removeDesign: (id: ID) => { dispatch({ type: 'REMOVE_DESIGN', id }); toast('Design deleted', 'warning') },

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
    // ── DNO Autopilot (per-project distribution-network-operator application) ──
    startDno: (projectId: ID, over?: Partial<DnoApplication>) => {
      const p = live.state?.projects.find((x) => x.id === projectId)
      if (!p) return
      const dno = buildApplication(p, over)
      dispatch({ type: 'UPDATE_PROJECT', id: projectId, patch: { dno } })
      toast(`DNO Autopilot — classified ${dno.classification}`, 'positive')
      return dno
    },
    updateDnoInputs: (projectId: ID, patch: Partial<DnoApplication>) => {
      patchDno(projectId, (dno) => {
        const merged = { ...dno, ...patch }
        const totalOutputKw = merged.devices.filter((d) => d.kind === 'inverter').reduce((s, d) => s + d.capacityKw, 0) || 4
        const dnoRegion = resolveDno(merged.mpan)
        const cls = classify({ totalOutputKw, phase: merged.phase, exportLimitKw: merged.exportLimitKw, dnoRegion, mpan: merged.mpan })
        return { ...merged, ...cls, dnoRegion }
      })
    },
    signDno: (projectId: ID, who: 'installer' | 'client', by: string, dataUrl?: string) => {
      patchDno(projectId, (dno) => ({
        ...dno,
        signatures: { ...dno.signatures, [who]: { by, dataUrl, signedAt: stamp() } },
        events: [...dno.events, { id: newEventId(), label: `${who === 'installer' ? 'Installer' : 'Client'} signature captured`, at: stamp() }],
      }))
      toast(`${who === 'installer' ? 'Installer' : 'Client'} signature saved`, 'positive')
    },
    generateDnoDocs: (projectId: ID, kind: DnoDocKind) => {
      patchDno(projectId, (dno) => {
        const docs = buildDocPack({ form: dno.form }, kind)
        return {
          ...dno,
          documents: [...dno.documents.filter((d) => d.kind !== kind), ...docs],
          status: kind === 'pre-install' && dno.status === 'draft' ? 'validated' : dno.status,
          events: [...dno.events, { id: newEventId(), label: `${kind === 'pre-install' ? 'Pre-install' : 'Post-install'} pack generated`, at: stamp(), note: `${docs.length} documents` }],
        }
      })
      toast(`${kind === 'pre-install' ? 'Pre-install' : 'Post-install'} pack generated`, 'positive')
    },
    advanceDno: (projectId: ID) => {
      let nextLabel = ''
      patchDno(projectId, (dno) => {
        const ns = nextStatus(dno.status)
        if (!ns) return dno
        nextLabel = statusEventLabel(ns)
        const patch: Partial<DnoApplication> = { status: ns }
        if (ns === 'submitted') patch.submittedAt = stamp()
        if (ns === 'approved') { patch.decisionAt = stamp(); patch.reference = dno.reference ?? `${dnoRefPrefix(dno.dnoRegion)}-${4000 + Math.floor(Math.random() * 5999)}` }
        return { ...dno, ...patch, events: [...dno.events, { id: newEventId(), label: nextLabel, at: stamp() }] }
      })
      if (nextLabel) toast(`DNO → ${nextLabel}`)
    },
    setDnoStatus: (projectId: ID, status: DnoStatus, reference?: string) => {
      patchDno(projectId, (dno) => ({
        ...dno,
        status,
        reference: reference ?? dno.reference,
        decisionAt: status === 'approved' || status === 'rejected' ? stamp() : dno.decisionAt,
        events: [...dno.events, { id: newEventId(), label: statusEventLabel(status), at: stamp() }],
      }))
      toast(status === 'approved' ? 'DNO application approved 🎉' : status === 'rejected' ? 'DNO application rejected' : `DNO → ${status}`, status === 'rejected' ? 'warning' : 'positive')
    },
    addDnoMessage: (projectId: ID, from: 'installer' | 'dno', body: string) => {
      patchDno(projectId, (dno) => ({ ...dno, messages: [...dno.messages, { id: newEventId(), from, body, at: stamp() }] }))
    },
    startDnoRun: (projectId: ID, over?: Partial<DnoApplication>) => {
      const p = live.state?.projects.find((x) => x.id === projectId)
      if (!p) return
      const base = p.dno ?? buildApplication(p, over)
      const steps = autopilotSteps(base)
      const dno: DnoApplication = { ...base, run: { active: true, index: 0, total: steps.length, step: steps[0], steps } }
      dispatch({ type: 'UPDATE_PROJECT', id: projectId, patch: { dno } })
      return dno
    },
    setDnoRunStep: (projectId: ID, index: number, step: string) => {
      patchDno(projectId, (dno) => ({ ...dno, run: dno.run ? { ...dno.run, index, step } : dno.run }))
    },
    finishDnoRun: (projectId: ID) => {
      patchDno(projectId, (dno) => {
        const docs = buildDocPack({ form: dno.form }, 'pre-install')
        return {
          ...dno,
          run: undefined,
          documents: [...dno.documents.filter((d) => d.kind !== 'pre-install'), ...docs],
          status: dno.status === 'draft' ? 'validated' : dno.status,
          events: [...dno.events, { id: newEventId(), label: 'Autopilot prepared application', at: stamp(), note: `${dno.classification} · ${docs.length} documents` }],
        }
      })
      toast('DNO Autopilot ready — review & sign', 'positive')
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
    removeOrg: (id: ID, name: string) => { dispatch({ type: 'REMOVE_ORG', id }); toast(`Organisation “${name}” deleted`, 'warning') },
    mergeOrgs: (keepId: ID, dropId: ID, dropName: string) => { dispatch({ type: 'MERGE_ORG', keepId, dropId }); toast(`Merged “${dropName}” — duplicate removed & deals kept`) },
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
    addAgent: (name: string, desc: string, schedule = 'Realtime') => {
      dispatch({ type: 'ADD_AGENT', agent: { id: uid('ag'), name, desc, runs: 'Ready', on: true, schedule } })
      toast(`Agent “${name}” created${schedule ? ` · ${schedule}` : ''} & switched on`)
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
    addAutomation: (name: string) => {
      const automation: import('./types').Automation = { id: uid('au'), name, active: false, steps: [{ id: uid('as'), kind: 'trigger', title: 'When a deal is created', subtitle: 'Any pipeline' }] }
      dispatch({ type: 'ADD_AUTOMATION', automation })
      toast(`Rule “${name}” created`)
      return automation
    },
    removeAutomation: (id: ID, name: string) => { dispatch({ type: 'REMOVE_AUTOMATION', id }); toast(`Rule “${name}” deleted`, 'warning') },
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
    bulkAddLeads: (rows: { name: string; company: string; role: string; score: number }[], source = 'TellOvi AI') => {
      const leads: Lead[] = rows.map((r) => ({ id: uid('l'), name: r.name, role: r.role, company: r.company, source, owner: 'Jordan Miles', created: 'Just now', createdAt: Date.now(), score: r.score, status: 'new' as const }))
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
    // ── Trade profile + modules ──
    selectTrade: (trade: import('./types').TradeKey, features: import('./types').Features, quiet = false) => {
      dispatch({ type: 'SET_TRADE', trade, features })
      if (!quiet) toast('Trade profile applied — your workspace is set up')
    },
    setFeatures: (patch: Partial<import('./types').Features>) => dispatch({ type: 'SET_FEATURES', patch }),
    toggleFeature: (key: import('./types').FeatureKey, on: boolean, name: string) => {
      dispatch({ type: 'SET_FEATURES', patch: { [key]: !on } })
      toast(`${name} ${on ? 'switched off' : 'switched on'}`, on ? 'warning' : 'positive')
    },
    completeOnboarding: () => dispatch({ type: 'COMPLETE_ONBOARDING' }),
    setRole: (role: import('./types').UserRole, quiet = false) => {
      dispatch({ type: 'SET_ROLE', role })
      if (!quiet) toast('Dashboard role updated')
    },

    // ── Jobs & Scheduling ──
    addJob: (partial: Partial<import('./types').Job> & { kind: import('./types').Job['kind']; title: string; customer: string }) => {
      const n = (live.state?.jobs.length ?? 0) + 2050
      const job: import('./types').Job = {
        id: uid('job'), ref: `JOB-${n}`, address: partial.address ?? '', crew: partial.crew ?? [],
        durationMins: partial.durationMins ?? 60, status: partial.date ? 'scheduled' : 'unscheduled', createdAt: Date.now(), ...partial,
      }
      dispatch({ type: 'ADD_JOB', job })
      // open the job's audit trail (and surface it on the linked deal/contact card)
      dispatch({ type: 'ADD_ACTIVITY', activity: { id: uid('act'), type: 'change', subject: `${job.ref} booked — ${job.title}`, body: [job.customer, job.address].filter(Boolean).join(' · '), jobId: job.id, dealId: job.dealId, personId: job.personId, done: true, who: 'Jordan Miles', createdAt: Date.now(), source: 'manual' } })
      toast(`${job.ref} booked — ${job.title}`)
      return job
    },
    updateJob: (id: ID, patch: Partial<import('./types').Job>) => dispatch({ type: 'UPDATE_JOB', id, patch }),
    scheduleJob: (id: ID, date: string, start: string, crew: ID[]) =>
      dispatch({ type: 'UPDATE_JOB', id, patch: { date, start, crew, status: 'scheduled' } }),
    assignCrew: (id: ID, crew: ID[]) => dispatch({ type: 'UPDATE_JOB', id, patch: { crew } }),
    setJobStatus: (job: import('./types').Job, status: import('./types').JobStatus) => {
      dispatch({ type: 'UPDATE_JOB', id: job.id, patch: { status } })
      // record every status change on the job's trail (+ the linked deal/contact)
      const label = status === 'complete' ? `${job.title} completed` : status === 'cancelled' ? `${job.title} cancelled` : `${job.title} → ${status}`
      dispatch({ type: 'ADD_ACTIVITY', activity: { id: uid('act'), type: 'change', subject: label, body: `${job.ref} · ${job.customer}`, jobId: job.id, dealId: job.dealId, personId: job.personId, done: true, who: 'Field team', createdAt: Date.now(), source: 'manual' } })
      toast(status === 'complete' ? `${job.ref} marked complete` : `${job.ref} → ${status}`)
    },
    logJobNote: (job: import('./types').Job, body: string) => {
      dispatch({ type: 'ADD_ACTIVITY', activity: { id: uid('act'), type: 'note', subject: `Note — ${job.ref}`, body, jobId: job.id, dealId: job.dealId, personId: job.personId, done: true, who: 'Jordan Miles', createdAt: Date.now(), source: 'manual' } })
      toast('Note added to the job')
    },
    removeJob: (id: ID, ref: string) => { dispatch({ type: 'REMOVE_JOB', id }); toast(`${ref} removed`, 'warning') },

    // ── Team space (internal chat + announcements) ──
    postMessage: (channelId: ID, text: string, authorId: ID = YOU_MEMBER_ID) => {
      const message: import('./types').TeamMessage = { id: uid('tm'), channelId, authorId, text, createdAt: Date.now() }
      dispatch({ type: 'ADD_TEAM_MESSAGE', message })
      return message
    },
    postAiMessage: (channelId: ID, text: string, ai?: import('./types').TeamAiBlock[], actions?: import('./types').TeamActionRef[]) => {
      const message: import('./types').TeamMessage = { id: uid('tm'), channelId, authorId: AI_MEMBER_ID, text, createdAt: Date.now(), ai, actions }
      dispatch({ type: 'ADD_TEAM_MESSAGE', message })
      return message
    },
    markMessageHandled: (id: ID) => dispatch({ type: 'UPDATE_TEAM_MESSAGE', id, patch: { handled: true } }),
    reactToMessage: (id: ID, emoji: string, member: ID = YOU_MEMBER_ID) => {
      const m = live.state?.teamMessages.find((x) => x.id === id)
      if (!m) return
      const reactions = [...(m.reactions ?? [])]
      const idx = reactions.findIndex((r) => r.emoji === emoji)
      if (idx === -1) reactions.push({ emoji, by: [member] })
      else {
        const by = reactions[idx].by.includes(member) ? reactions[idx].by.filter((x) => x !== member) : [...reactions[idx].by, member]
        if (by.length === 0) reactions.splice(idx, 1)
        else reactions[idx] = { ...reactions[idx], by }
      }
      dispatch({ type: 'UPDATE_TEAM_MESSAGE', id, patch: { reactions } })
    },
    addChannel: (name: string, kind: import('./types').ChannelKind, topic?: string) => {
      const channel: import('./types').TeamChannel = { id: uid('ch'), name, kind, topic, memberIds: [YOU_MEMBER_ID, AI_MEMBER_ID], ai: true, unread: 0 }
      dispatch({ type: 'ADD_TEAM_CHANNEL', channel })
      toast(`${kind === 'group' ? 'Group' : 'Channel'} “${name}” created`)
      return channel
    },
    markChannelRead: (id: ID) => dispatch({ type: 'MARK_CHANNEL_READ', id }),
    trainVoice: (id: ID, name: string) => {
      dispatch({ type: 'UPDATE_TEAM_MEMBER', id, patch: { voiceEnrolled: true } })
      toast(`Voice trained — Ovi can now attribute ${name.split(' ')[0]}’s tasks`)
    },
    postAnnouncement: (kind: import('./types').AnnouncementKind, title: string, body: string, value?: number) => {
      const a: import('./types').Announcement = { id: uid('an'), kind, title, body, authorId: YOU_MEMBER_ID, createdAt: Date.now(), value, cheers: [] }
      dispatch({ type: 'ADD_ANNOUNCEMENT', announcement: a })
      toast(kind === 'win' ? 'Win posted — nice one! 🎉' : 'Posted to the announcements board')
      return a
    },
    toggleCheer: (id: ID, member: ID = YOU_MEMBER_ID) => dispatch({ type: 'TOGGLE_CHEER', id, by: member }),

    // ── Departments (whole-workforce layer) ──
    setLeaveStatus: (id: ID, status: import('./types').LeaveRequest['status'], name?: string) => {
      dispatch({ type: 'SET_LEAVE_STATUS', id, status })
      toast(status === 'approved' ? `Leave approved${name ? ` — ${name}` : ''}` : `Leave declined${name ? ` — ${name}` : ''}`, status === 'approved' ? 'positive' : 'warning')
    },
    setExpenseStatus: (id: ID, status: import('./types').Expense['status']) => {
      dispatch({ type: 'SET_EXPENSE_STATUS', id, status })
      toast(status === 'approved' ? 'Expense approved' : status === 'reimbursed' ? 'Expense marked reimbursed' : 'Expense updated')
    },
    respondReview: (id: ID) => { dispatch({ type: 'RESPOND_REVIEW', id }); toast('Response drafted & posted') },
    updatePolicy: (id: ID, patch: Partial<import('./types').Policy>) => dispatch({ type: 'UPDATE_POLICY', id, patch }),

    /* ---- TellOvi Marketing ---- */
    fulfilRequest: (id: ID, status: import('./types').RequestStatus, note?: string) => {
      dispatch({ type: 'FULFIL_REQUEST', id, status, note })
      toast(status === 'found' ? 'Ovi found it — handed over' : status === 'done' ? 'Request closed' : status === 'in-progress' ? 'Sent to a designer' : 'Request updated', 'accent')
    },
    addContentItem: (item: Omit<import('./types').ContentItem, 'id'>) => {
      const full: import('./types').ContentItem = { id: uid('ci'), ...item }
      dispatch({ type: 'ADD_CONTENT', item: full })
      return full
    },
    advanceContent: (id: ID, status: import('./types').ContentStatus) => { dispatch({ type: 'ADVANCE_CONTENT', id, status }); toast(`Moved to ${status}`, 'accent') },
    toggleMktConnector: (id: ID) => dispatch({ type: 'TOGGLE_MKT_CONNECTOR', id }),
    saveBrandAsset: (asset: Omit<import('./types').BrandAsset, 'id'>) => {
      const full: import('./types').BrandAsset = { id: uid('ba'), ...asset }
      dispatch({ type: 'ADD_BRAND_ASSET', asset: full })
      toast(`${asset.name} saved to the Brand Hub`)
      return full
    },
    addMedia: (media: Omit<import('./types').MediaAsset, 'id'>) => {
      const full: import('./types').MediaAsset = { id: uid('md'), ...media }
      dispatch({ type: 'ADD_MEDIA', media: full })
      toast(`${media.name} added to Assets`)
      return full
    },
    /** The artifact engine — in production Claude generates the real .xlsx/.pptx/.docx; here it lands in Brand & Documents. */
    generateArtifact: (title: string, kind: import('./types').DocKind, format: import('./types').DocFormat) => {
      const full: import('./types').BrandDoc = { id: uid('bd'), title, kind, format, source: 'template', createdAt: Date.now() }
      dispatch({ type: 'ADD_BRANDDOC', doc: full })
      toast(`${title} — generated (.${format})`)
      return full
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
    activePipeline: () => s.pipelines.find((p) => p.id === s.activePipelineId) ?? s.pipelines[0],
    pipelineOf: (deal?: { pipelineId?: ID }) => s.pipelines.find((p) => p.id === (deal?.pipelineId ?? s.activePipelineId)) ?? s.pipelines[0],
    personById: (id?: ID) => s.people.find((p) => p.id === id),
    orgById: (id?: ID) => s.orgs.find((o) => o.id === id),
    dealActivities: (dealId: ID) => s.activities.filter((a) => a.dealId === dealId).sort((a, b) => b.createdAt - a.createdAt),
    personActivities: (personId: ID) => s.activities.filter((a) => a.personId === personId).sort((a, b) => b.createdAt - a.createdAt),
    leadActivities: (leadId: ID) => s.activities.filter((a) => a.leadId === leadId).sort((a, b) => b.createdAt - a.createdAt),
    jobActivities: (jobId: ID) => s.activities.filter((a) => a.jobId === jobId).sort((a, b) => b.createdAt - a.createdAt),
    jobsForDeal: (dealId: ID) => s.jobs.filter((j) => j.dealId === dealId).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    jobsForPerson: (personId: ID) => s.jobs.filter((j) => j.personId === personId),
    openTasks: (dealId?: ID) => s.activities.filter((a) => !a.done && a.type !== 'note' && a.type !== 'change' && (dealId ? a.dealId === dealId : true)),
    dealEmails: (dealId: ID) => s.emails.filter((e) => e.dealId === dealId),
    personEmails: (personId: ID) => s.emails.filter((e) => e.personId === personId),
    peopleForDeal: (deal: { personIds: ID[] }) => s.people.filter((p) => deal.personIds.includes(p.id)),
    openDeals: () => s.deals.filter((d) => !d.won && !d.lost),
    unreadCount: () => s.emails.filter((e) => e.folder === 'inbox' && e.unread).length,
    openTaskCount: () => s.activities.filter((a) => !a.done && (a.type === 'task' || a.type === 'call' || a.type === 'meeting' || a.type === 'email')).length,
  }
}
