import { useMemo, useRef, useState } from 'react'
import { useState_, useActions } from '../store/store'
import { teamAnswer, wantsAi, type PlannedAction } from '../lib/teamAi'
import { askTeamOvi, type OviAction } from '../lib/teamOviLive'
import type { TeamActionRef, TeamChannel, TeamMessage } from '../store/types'

/**
 * The Team channel AI flow, shared by the full Team page and the docked chat
 * windows: post a message, and if the channel has Ovi in it and the message
 * wants action, stream "working" steps then post Ovi's reply + run the plan's
 * concrete store actions.
 */
export function useTeamChat(channel: TeamChannel) {
  const { teamMessages, teamMembers, deals } = useState_()
  const act = useActions()
  const busy = useRef(false)
  const [work, setWork] = useState<{ steps: string[]; i: number } | null>(null)

  const msgs = useMemo(
    () => teamMessages.filter((m) => m.channelId === channel.id).sort((a, b) => a.createdAt - b.createdAt),
    [teamMessages, channel.id],
  )
  const members = teamMembers.filter((m) => channel.memberIds.includes(m.id))

  function execute(actions: PlannedAction[] | undefined): TeamActionRef[] {
    if (!actions) return []
    return actions.map((a) => {
      if (a.kind === 'deck') {
        act.addBrandDoc({ title: a.label, kind: 'deck', format: 'pptx', source: 'template' })
      } else if (a.kind === 'meeting') {
        act.addMeeting({ title: 'Board / prep meeting', platform: 'Teams', when: 'Next week', status: 'upcoming' })
      } else if (a.kind === 'task') {
        if (/prep/i.test(a.label)) {
          ;['Draft the board narrative', 'Pull Q3 pipeline & win figures', 'Design the deck & rehearse'].forEach((t, k) =>
            act.addActivity({ type: 'task', subject: t, due: k === 0 ? 'Tomorrow' : 'This week', priority: 'High', who: 'Ovi', source: 'ai' }))
        } else if (/each/i.test(a.label)) {
          const risk = deals.filter((d) => !d.won && !d.lost && (d.health === 'At risk' || d.health === 'Stalled' || d.health === 'No next step'))
          risk.slice(0, 3).forEach((d) => act.addActivity({ type: 'task', subject: `Add a next step — ${d.org}`, dealId: d.id, personId: d.personIds[0], due: 'Tomorrow', priority: 'High', who: 'Ovi', source: 'ai' }))
        } else {
          act.addActivity({ type: 'task', subject: 'Follow up', due: 'Tomorrow', priority: 'Medium', who: 'Ovi', source: 'ai' })
        }
      }
      return { kind: a.kind, label: a.label, to: a.to }
    })
  }

  /** Run a live-model Ovi action against the store; returns an openable chip for the message. */
  function runLive(a: OviAction): TeamActionRef {
    const deal = a.customer ? deals.find((d) => d.name.toLowerCase() === a.customer!.toLowerCase()) ?? deals.find((d) => d.name.toLowerCase().includes(a.customer!.toLowerCase())) : undefined
    const assignee = a.assignee ? teamMembers.find((m) => m.name.toLowerCase() === a.assignee!.toLowerCase() || m.name.split(' ')[0].toLowerCase() === a.assignee!.toLowerCase()) : undefined
    const iso = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : new Date(Date.now() + 86_400_000).toISOString().slice(0, 10))
    const pretty = (s: string) => new Date(`${s}T12:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    if (a.tool === 'create_task') {
      const d = iso(a.due_date)
      act.addActivity({ type: 'task', subject: a.subject, body: a.notes, dueDate: d, due: pretty(d), priority: a.priority ?? 'Medium', dealId: deal?.id, personId: deal?.personIds[0], who: assignee?.name ?? 'Ovi', assigneeIds: assignee ? [assignee.id] : undefined, source: 'ai' })
      return { kind: 'task', label: `Task · ${a.subject}${assignee ? ` → ${assignee.name.split(' ')[0]}` : ''}`, to: deal ? `/deals/${deal.id}` : '/tasks' }
    }
    const d = iso(a.date)
    act.addActivity({ type: a.type, subject: `${a.purpose}${deal ? ` — ${deal.name}` : ''}`, body: a.notes, dueDate: d, due: pretty(d), startTime: a.time, purpose: a.purpose, location: a.location, dealId: deal?.id, personId: deal?.personIds[0], who: assignee?.name ?? 'Ovi', assigneeIds: assignee ? [assignee.id] : undefined, source: 'ai' })
    return { kind: a.type === 'meeting' ? 'meeting' : 'task', label: `${a.purpose} · ${pretty(d)}${a.time ? ` ${a.time}` : ''}`, to: '/tasks' }
  }

  async function runAi(sourceText: string) {
    if (busy.current) return
    busy.current = true
    // live model first: it can read the customers and actually do things
    setWork({ steps: ['Reading the thread', 'Checking customers & the team', 'Doing it'], i: 0 })
    const tickId = setInterval(() => setWork((w) => (w && w.i < w.steps.length - 1 ? { ...w, i: w.i + 1 } : w)), 900)
    const me = teamMembers.find((m) => m.you)?.name ?? 'Jordan Miles'
    const live = await askTeamOvi({ text: sourceText, channelName: channel.name, history: msgs.slice(-8).map((m) => ({ who: teamMembers.find((t) => t.id === m.authorId)?.name ?? 'Someone', text: m.text })), team: teamMembers, deals, me })
    clearInterval(tickId)
    if (live) {
      const refs = live.actions.map(runLive)
      const text = live.reply || (refs.length ? `Done — ${refs.map((r) => r.label).join('; ')}.` : 'Noted.')
      act.postAiMessage(channel.id, text, undefined, refs.length ? refs : undefined)
      setWork(null)
      busy.current = false
      return
    }
    const plan = teamAnswer(sourceText)
    let i = 0
    const tick = () => {
      setWork({ steps: plan.working, i })
      setTimeout(() => {
        i += 1
        if (i < plan.working.length) tick()
        else {
          const refs = execute(plan.actions)
          act.postAiMessage(channel.id, plan.text, plan.blocks, refs.length ? refs : undefined)
          setWork(null)
          busy.current = false
        }
      }, 620 + Math.random() * 380)
    }
    tick()
  }

  function send(text: string) {
    act.postMessage(channel.id, text)
    // @mentions: let each mentioned teammate know (Ovi is handled below)
    const mentioned = teamMembers.filter((m) => !m.bot && !m.you && new RegExp(`@${m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text))
    if (mentioned.length) act.toast(`Notified ${mentioned.map((m) => m.name.split(' ')[0]).join(', ')}`)
    const askedOvi = /@ovi\b/i.test(text)
    if (askedOvi || (channel.ai && wantsAi(text, true))) setTimeout(() => { void runAi(text) }, 350)
  }
  function handle(msg: TeamMessage) {
    act.markMessageHandled(msg.id)
    void runAi(msg.text)
  }

  return { msgs, members, work, send, handle }
}
