import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Chip } from '../components/ui'
import { Mic, Waveform, Sparkle, Check, Users, Send, Clock, Robot, Task as TaskIcon } from '../components/icons'
import { useState_, useActions, uid } from '../store/store'
import type { ID } from '../store/types'
import { isoDay, addDaysISO, fmtMins } from '../lib/tasks'
import { classNames } from '../lib/format'

type Phase = 'setup' | 'recording' | 'analysing' | 'review' | 'sent'

// A scripted boardroom standup. `to` = who the task lands on (the addressee Ovi extracts).
type Line = { speaker: ID; text: string; action?: { to: ID; subject: string; deal?: string; dueLabel: string; dueOffset: number; priority: 'High' | 'Medium' | 'Low'; est: number } }
const SCRIPT: Line[] = [
  { speaker: 'tm-dana', text: 'Morning everyone. Let’s run the week — Cirrus first.' },
  { speaker: 'tm-marcus', text: 'Cirrus gave a verbal yes. The legal redlines on the liability caps are the only blocker now.' },
  { speaker: 'tm-dana', text: 'Jordan — get proposal v4 out today with the phased rollout and the retainer line.', action: { to: 'tm-you', subject: 'Send Cirrus proposal v4 — phased rollout + retainer', deal: 'Cirrus', dueLabel: 'Today', dueOffset: 0, priority: 'High', est: 120 } },
  { speaker: 'tm-you', text: 'On it. I’ll want Priya on the joint legal call.' },
  { speaker: 'tm-dana', text: 'Priya, set up the Cirrus joint legal walkthrough this week.', action: { to: 'tm-priya', subject: 'Set up Cirrus joint legal walkthrough', deal: 'Cirrus', dueLabel: 'This week', dueOffset: 3, priority: 'High', est: 30 } },
  { speaker: 'tm-marcus', text: 'Ashford’s revised quote is two days overdue. I’ll chase it today.', action: { to: 'tm-marcus', subject: 'Chase Ashford revised quote', deal: 'Ashford', dueLabel: 'Today', dueOffset: 0, priority: 'High', est: 30 } },
  { speaker: 'tm-dana', text: 'Ryan — confirm the Brightleaf survey slot with the crew tomorrow.', action: { to: 'tm-ryan', subject: 'Confirm Brightleaf survey slot with the crew', dueLabel: 'Tomorrow', dueOffset: 1, priority: 'Medium', est: 30 } },
  { speaker: 'tm-you', text: 'Fenwick want their microgrid review deck before Thursday.' },
  { speaker: 'tm-dana', text: 'Good — Jordan, prep the Fenwick microgrid deck by Wednesday.', action: { to: 'tm-you', subject: 'Prep Fenwick microgrid review deck', deal: 'Fenwick', dueLabel: 'In 2 days', dueOffset: 2, priority: 'Medium', est: 90 } },
  { speaker: 'tm-marcus', text: 'I’ll build the Q3 renewals list — mine for Friday.', action: { to: 'tm-marcus', subject: 'Build the Q3 renewals list', dueLabel: 'Friday', dueOffset: 4, priority: 'Low', est: 60 } },
  { speaker: 'tm-dana', text: 'Perfect. That’s the week — let’s go.' },
]

type ActionItem = { id: ID; to: ID; subject: string; dealId?: ID; deal?: string; dueLabel: string; dueOffset: number; priority: 'High' | 'Medium' | 'Low'; est: number; include: boolean }

export function LiveMeeting() {
  const nav = useNavigate()
  const { teamMembers, deals } = useState_()
  const act = useActions()

  const [phase, setPhase] = useState<Phase>('setup')
  const [title, setTitle] = useState('Monday team standup')
  const [present, setPresent] = useState<ID[]>(['tm-you', 'tm-dana', 'tm-priya', 'tm-marcus', 'tm-ryan'])
  const [revealed, setRevealed] = useState(0) // lines shown so far
  const [secs, setSecs] = useState(0)
  const [items, setItems] = useState<ActionItem[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const member = (id: ID) => teamMembers.find((m) => m.id === id)
  const humans = teamMembers.filter((m) => !m.bot)
  const dealByName = (name?: string) => (name ? deals.find((d) => d.org.toLowerCase().includes(name.toLowerCase())) : undefined)
  const untrainedPresent = present.map(member).filter((m) => m && !m.voiceEnrolled)

  // streaming transcript + timer while recording
  useEffect(() => {
    if (phase !== 'recording') return
    const timer = setInterval(() => setSecs((s) => s + 1), 1000)
    const reveal = setInterval(() => setRevealed((r) => (r >= SCRIPT.length ? r : r + 1)), 1700)
    return () => { clearInterval(timer); clearInterval(reveal) }
  }, [phase])

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [revealed])

  const liveActions = SCRIPT.slice(0, revealed).filter((l) => l.action).length
  const allRevealed = revealed >= SCRIPT.length

  function start() {
    setSecs(0); setRevealed(0); setPhase('recording')
  }
  function end() {
    setPhase('analysing')
    setTimeout(() => {
      const extracted: ActionItem[] = SCRIPT.filter((l) => l.action).map((l) => {
        const a = l.action!
        return { id: uid('ai'), to: a.to, subject: a.subject, deal: a.deal, dealId: dealByName(a.deal)?.id, dueLabel: a.dueLabel, dueOffset: a.dueOffset, priority: a.priority, est: a.est, include: true }
      })
      setItems(extracted)
      setPhase('review')
    }, 1600)
  }
  function dish() {
    const included = items.filter((i) => i.include)
    included.forEach((i) => {
      act.logActivity({
        type: 'task', subject: i.subject,
        body: `Assigned in “${title}” — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
        assigneeIds: [i.to], dealId: i.dealId,
        due: i.dueLabel, dueDate: addDaysISO(isoDay(), i.dueOffset), priority: i.priority, estimateMins: i.est,
        done: false, source: 'meeting',
      })
    })
    const summary = `${title}: ${SCRIPT.filter((l) => l.action).length} action items across ${new Set(included.map((i) => i.to)).size} people. Deals touched: ${[...new Set(items.map((i) => i.deal).filter(Boolean))].join(', ')}.`
    act.dispatch({ type: 'ADD_MEETING', meeting: { id: uid('mt'), title, platform: 'Teams', when: 'Just now', dealOrg: 'Internal', attendees: present.map((p) => member(p)?.name ?? ''), status: 'recorded', bot: true, inPerson: true, summary, tasksDished: included.length, processed: true } })
    act.toast(`${included.length} tasks sent to ${new Set(included.map((i) => i.to)).size} people’s lists`)
    setPhase('sent')
  }

  const mmss = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
  const perPerson = useMemo(() => {
    const map: Record<string, number> = {}
    items.filter((i) => i.include).forEach((i) => { map[i.to] = (map[i.to] ?? 0) + 1 })
    return Object.entries(map)
  }, [items])

  return (
    <>
      <TopBar title="Meetings" crumbs={['Live · in the room']} actions={<Button onClick={() => nav('/meetings')}>Meeting history</Button>} />
      <PageBody>
        {phase === 'setup' && (
          <div className="max-w-[720px] mx-auto w-full flex flex-col gap-5">
            <div className="rounded-card p-6 text-white" style={{ background: 'linear-gradient(150deg,#1c3a72,#0c1b38)' }}>
              <div className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: '#8FB0FF' }}><Mic size={14} /> IN-THE-ROOM RECORDER</div>
              <div className="text-[22px] font-bold mt-1.5">Record the meeting. Ovi does the rest.</div>
              <div className="text-[13.5px] mt-1.5 leading-relaxed" style={{ color: '#C7D3F2' }}>Ovi listens, recognises who’s speaking, then at the end writes the summary and sends each person their own action items — straight to their task list.</div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-ink-3">Meeting title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 px-3 rounded-control border border-input-border bg-white text-[14px] text-ink-2 outline-none focus:border-accent" />
            </label>

            <div className="bg-surface border border-border rounded-card p-5">
              <div className="flex items-center gap-2 mb-3"><Users size={16} className="text-accent" /><span className="text-[14px] font-semibold text-ink">Who’s in the room</span><span className="text-[12px] text-muted-2">· Ovi labels trained voices automatically</span></div>
              <div className="flex flex-col gap-1.5">
                {humans.map((m) => {
                  const on = present.includes(m.id)
                  return (
                    <div key={m.id} className={classNames('flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors', on ? 'border-border-blue bg-accent-wash-4' : 'border-border')}>
                      <button onClick={() => setPresent((p) => (on ? p.filter((x) => x !== m.id) : [...p, m.id]))} className="w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0" style={{ borderColor: on ? '#1D4ED8' : '#C3CBD8', background: on ? '#1D4ED8' : 'transparent' }}>{on && <Check size={12} className="text-white" strokeWidth={2.6} />}</button>
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ background: m.color }}>{m.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                      <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2">{m.name}{m.you ? ' (you)' : ''}</div><div className="text-[12px] text-muted-2">{m.role}</div></div>
                      {m.voiceEnrolled ? (
                        <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-positive"><Check size={12} /> Voice trained</span>
                      ) : (
                        <button onClick={() => act.trainVoice(m.id, m.name)} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent bg-accent-wash rounded-lg px-2.5 py-1 hover:bg-[#E4ECFB]"><Mic size={12} /> Train voice</button>
                      )}
                    </div>
                  )
                })}
              </div>
              {untrainedPresent.length > 0 && (
                <div className="mt-3 text-[12px] text-warning bg-[#FDF1E7] border border-[#F3D9BE] rounded-lg px-3 py-2">{untrainedPresent.map((m) => m!.name.split(' ')[0]).join(' & ')} {untrainedPresent.length === 1 ? "isn't" : "aren't"} voice-trained — Ovi will mark their lines “unidentified” until you train them.</div>
              )}
            </div>

            <button onClick={start} className="h-11 self-start px-5 rounded-control bg-[#B01B4F] text-white font-semibold text-[14px] inline-flex items-center gap-2 shadow-primary hover:brightness-95 active:translate-y-px transition"><Mic size={17} /> Start recording</button>
          </div>
        )}

        {(phase === 'recording' || phase === 'analysing') && (
          <div className="max-w-[760px] mx-auto w-full flex flex-col gap-4">
            <div className="flex items-center gap-3 bg-surface border border-border rounded-card px-5 py-3">
              <span className="relative flex items-center justify-center w-9 h-9">
                <span className="absolute inline-flex w-full h-full rounded-full bg-[#B01B4F]/20 animate-ping" />
                <span className="relative w-9 h-9 rounded-full bg-[#B01B4F] text-white flex items-center justify-center"><Mic size={16} /></span>
              </span>
              <div className="flex-1"><div className="text-[14px] font-semibold text-ink">{phase === 'analysing' ? 'Wrapping up…' : 'Recording'} · {title}</div><div className="text-[12px] text-muted-2">{present.length} in the room · {liveActions} action{liveActions === 1 ? '' : 's'} detected</div></div>
              <span className="text-[15px] font-bold tabular-nums text-ink-2">{mmss}</span>
              {phase === 'recording' && <Button variant="primary" icon={<Sparkle size={16} />} onClick={end}>End &amp; summarise</Button>}
            </div>

            <div ref={scrollRef} className="bg-surface border border-border rounded-card p-5 flex flex-col gap-4 max-h-[52vh] overflow-y-auto">
              {SCRIPT.slice(0, revealed).map((l, i) => {
                const m = member(l.speaker)
                const trained = m?.voiceEnrolled
                return (
                  <div key={i} className="flex gap-3">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: trained ? m?.color : '#94A0B4' }}>{trained ? m?.name.split(' ').map((w) => w[0]).slice(0, 2).join('') : '?'}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-ink-2">{trained ? m?.name : 'Unidentified speaker'}</span>
                        {!trained && <span className="text-[10px] font-semibold text-warning bg-[#FDF1E7] rounded px-1.5 py-0.5">untrained voice</span>}
                        {l.action && <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-accent bg-accent-wash rounded px-1.5 py-0.5"><TaskIcon size={10} /> task → {member(l.action.to)?.name.split(' ')[0]}</span>}
                      </div>
                      <div className="text-[13px] text-ink-3 leading-relaxed mt-0.5">{l.text}</div>
                    </div>
                  </div>
                )
              })}
              <div className="flex items-center gap-2 text-[12px] text-muted-2">
                {phase === 'analysing' ? <><Sparkle size={14} className="text-accent animate-pulse" /> Ovi is writing the summary and routing tasks…</> : <><Waveform size={14} className="text-accent animate-pulse" /> {allRevealed ? 'Listening…' : 'transcribing…'}</>}
              </div>
            </div>
          </div>
        )}

        {phase === 'review' && (
          <div className="max-w-[820px] mx-auto w-full flex flex-col gap-4">
            <div className="rounded-card bg-deep-panel p-5">
              <div className="flex items-center gap-2 text-white font-semibold text-[14px]"><Sparkle size={16} style={{ color: '#8FB0FF' }} /> Ovi’s summary — {title}</div>
              <div className="text-[13px] leading-relaxed mt-2" style={{ color: '#C7D3F2' }}>
                Covered Cirrus (legal redlines are the last blocker), Ashford (quote overdue), Fenwick (deck due) and Q3 renewals planning. Extracted <strong className="text-white">{items.length} action items</strong> across <strong className="text-white">{new Set(items.map((i) => i.to)).size} people</strong>. Review and send — each lands on that person’s task list.
              </div>
            </div>

            <div className="bg-surface border border-border rounded-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-divider"><Send size={15} className="text-accent" /><span className="text-[13px] font-semibold text-ink-2">Action items to dish out</span><span className="ml-auto text-[12px] text-muted-2">{items.filter((i) => i.include).length} selected</span></div>
              <div className="divide-y divide-divider">
                {items.map((i) => {
                  const m = member(i.to)
                  const verified = m?.voiceEnrolled
                  return (
                    <div key={i.id} className={classNames('flex items-start gap-3 px-4 py-3', !i.include && 'opacity-50')}>
                      <button onClick={() => setItems((cur) => cur.map((x) => (x.id === i.id ? { ...x, include: !x.include } : x)))} className="mt-0.5 w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0" style={{ borderColor: i.include ? '#1D4ED8' : '#C3CBD8', background: i.include ? '#1D4ED8' : 'transparent' }}>{i.include && <Check size={12} className="text-white" strokeWidth={2.6} />}</button>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-medium text-ink-2">{i.subject}</div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11.5px]">
                          <Chip tone={i.priority === 'High' ? 'negative' : i.priority === 'Medium' ? 'warning' : 'neutral'}>{i.priority}</Chip>
                          <span className="inline-flex items-center gap-1 text-muted-2"><Clock size={11} /> {fmtMins(i.est)}</span>
                          <span className="text-muted-2">Due {i.dueLabel}</span>
                          {i.deal && <span className="text-accent">{i.deal}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-medium text-ink-3">{m?.name.split(' ')[0]}</span>
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: m?.color }}>{m?.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                        </div>
                        {verified ? <span className="text-[10.5px] text-positive flex items-center gap-1"><Check size={10} /> voice-verified</span> : <button onClick={() => act.trainVoice(i.to, m?.name ?? '')} className="text-[10.5px] text-accent font-semibold">train to verify</button>}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-divider">
                <Button onClick={() => setPhase('setup')}>Discard</Button>
                <Button variant="primary" icon={<Send size={16} />} onClick={dish}>Send {items.filter((i) => i.include).length} tasks to the team</Button>
              </div>
            </div>
          </div>
        )}

        {phase === 'sent' && (
          <div className="max-w-[620px] mx-auto w-full flex flex-col gap-4 items-center text-center pt-6">
            <span className="w-14 h-14 rounded-full bg-[#E6F4EF] text-positive flex items-center justify-center"><Check size={28} strokeWidth={2.4} /></span>
            <div className="text-[20px] font-bold text-ink">Tasks sent to the team</div>
            <div className="text-[13.5px] text-muted-b max-w-[46ch]">Everyone has their action items from “{title}” on their own task list. You’ll see yours on Home and in My Tasks.</div>
            <div className="w-full bg-surface border border-border rounded-card divide-y divide-divider text-left">
              {perPerson.map(([id, n]) => {
                const m = member(id)
                return (
                  <div key={id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ background: m?.color }}>{m?.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                    <span className="text-[13px] font-medium text-ink-2 flex-1">{m?.name}{m?.you ? ' (you)' : ''}</span>
                    <Chip tone="accent">{n} task{n === 1 ? '' : 's'}</Chip>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2">
              <Button variant="primary" icon={<TaskIcon size={16} />} onClick={() => nav('/tasks')}>Open My Tasks</Button>
              <Button icon={<Robot size={16} />} onClick={() => { setItems([]); setPhase('setup') }}>Record another</Button>
            </div>
          </div>
        )}
      </PageBody>
    </>
  )
}
