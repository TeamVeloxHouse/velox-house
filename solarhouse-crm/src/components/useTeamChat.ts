import { useMemo, useRef, useState } from 'react'
import { useState_, useActions } from '../store/store'
import { teamAnswer, wantsAi, type PlannedAction } from '../lib/teamAi'
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

  function runAi(sourceText: string) {
    if (busy.current) return
    busy.current = true
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
    if (channel.ai && wantsAi(text, true)) setTimeout(() => runAi(text), 350)
  }
  function handle(msg: TeamMessage) {
    act.markMessageHandled(msg.id)
    runAi(msg.text)
  }

  return { msgs, members, work, send, handle }
}
