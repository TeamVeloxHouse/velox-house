import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Chip, Kpi, Segmented, type ChipTone } from '../components/ui'
import { Robot, Sparkle, Check, Envelope, Task, Bolt, Building, Note, Clock } from '../components/icons'
import { Modal, Field, Input, Textarea, Select } from '../components/overlays'
import { useState_, useActions } from '../store/store'
import type { AgentRun } from '../store/types'
import { classNames } from '../lib/format'
import { Dropdown } from '../components/Dropdown'

const kindIcon: Record<AgentRun['kind'], (p: { size?: number; className?: string }) => JSX.Element> = { draft: Envelope, task: Task, risk: Bolt, enrich: Building, triage: Sparkle, summary: Note }
const kindLabel: Record<AgentRun['kind'], string> = { draft: 'Draft', task: 'Task', risk: 'Risk', enrich: 'Enrich', triage: 'Triage', summary: 'Summary' }
const statusTone: Record<AgentRun['status'], ChipTone> = { pending: 'accent', approved: 'positive', dismissed: 'neutral' }
const statusLabel: Record<AgentRun['status'], string> = { pending: 'Needs approval', approved: 'Applied', dismissed: 'Dismissed' }

export function Agents() {
  const nav = useNavigate()
  const { agents, agentRuns, automations } = useState_()
  const act = useActions()
  const [buildOpen, setBuildOpen] = useState(false)
  const [newMenu, setNewMenu] = useState(false)
  const [time, setTime] = useState('Today')
  const [statusF, setStatusF] = useState('All')
  const [agentF, setAgentF] = useState('All agents')
  const newRule = () => { const r = act.addAutomation('Untitled rule'); setNewMenu(false); nav(`/automation/${r.id}`) }

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const inTime = (ts: number) => (time === 'All' ? true : time === 'Today' ? ts >= startOfToday.getTime() : ts >= Date.now() - 7 * 86_400_000)
  const log = agentRuns
    .filter((r) => inTime(r.when))
    .filter((r) => (statusF === 'All' ? true : statusF === 'Needs approval' ? r.status === 'pending' : statusF === 'Applied' ? r.status === 'approved' : r.status === 'dismissed'))
    .filter((r) => agentF === 'All agents' || r.agent === agentF)
    .sort((a, b) => b.when - a.when)
  const pendingCount = agentRuns.filter((r) => r.status === 'pending').length
  const todayCount = agentRuns.filter((r) => r.when >= startOfToday.getTime()).length

  return (
    <>
      <TopBar
        title="Automations"
        crumbs={['AI agents & rules']}
        actions={
          <div className="relative">
            <Button variant="primary" icon={<Sparkle size={16} />} onClick={() => setNewMenu((o) => !o)}>New automation</Button>
            {newMenu && (
              <div className="absolute right-0 mt-1 w-[240px] bg-surface border border-border rounded-card shadow-modal overflow-hidden z-30">
                <button onClick={() => { setNewMenu(false); setBuildOpen(true) }} className="w-full flex items-start gap-3 px-3.5 py-2.5 text-left hover:bg-control border-b border-divider">
                  <span className="w-7 h-7 rounded-lg bg-accent-gradient text-white flex items-center justify-center shrink-0"><Robot size={14} /></span>
                  <span><span className="block text-[13px] font-semibold text-ink-2">AI agent</span><span className="block text-[12px] text-muted-2">Ovi decides & drafts, you approve</span></span>
                </button>
                <button onClick={newRule} className="w-full flex items-start gap-3 px-3.5 py-2.5 text-left hover:bg-control">
                  <span className="w-7 h-7 rounded-lg bg-accent-wash text-accent flex items-center justify-center shrink-0"><Bolt size={14} /></span>
                  <span><span className="block text-[13px] font-semibold text-ink-2">Rule</span><span className="block text-[12px] text-muted-2">A fixed trigger → action workflow</span></span>
                </button>
              </div>
            )}
          </div>
        }
      />
      <BuildAgentModal open={buildOpen} onClose={() => setBuildOpen(false)} />
      <PageBody>
        <div className="grid grid-cols-4 gap-4">
          <Kpi variant="deep" label="Active agents" value={String(agents.filter((a) => a.on).length)} delta={`${agents.length} configured`} />
          <Kpi variant="blue" label="Tasks today" value={String(todayCount)} delta="Across all agents" deltaTone="muted" />
          <Kpi label="Awaiting approval" value={String(pendingCount)} delta="In your review queue" deltaTone={pendingCount ? 'negative' : 'muted'} />
          <Kpi label="Time saved" value="4.2h" delta="This week" />
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 320px' }}>
          {/* activity log */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-[15px] font-semibold text-ink mr-1">Activity log</div>
              <Segmented options={['Today', '7 days', 'All']} value={time} onChange={setTime} />
              <Segmented options={['All', 'Needs approval', 'Applied', 'Dismissed']} value={statusF} onChange={setStatusF} />
              <Dropdown value={agentF} onChange={(e) => setAgentF(e.target.value)} className="h-8 px-2.5 rounded-control border border-input-border bg-white text-[12.5px] text-ink-2 outline-none focus:border-accent">
                <option>All agents</option>
                {agents.map((a) => (<option key={a.id}>{a.name}</option>))}
              </Dropdown>
              <span className="text-[12px] text-muted-2 ml-auto">{log.length} task{log.length === 1 ? '' : 's'}</span>
            </div>

            <div className="bg-surface border border-border rounded-card divide-y divide-divider">
              {log.map((r) => {
                const Icon = kindIcon[r.kind]
                return (
                  <div key={r.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className={classNames('w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0', r.status === 'pending' ? 'bg-accent-gradient text-white shadow-primary' : r.status === 'approved' ? 'bg-positive-wash text-positive' : 'bg-control text-muted')}><Icon size={15} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13.5px] font-semibold text-ink-2 truncate">{r.title}</span>
                          <span className="ml-auto text-[11px] text-muted-3 shrink-0">{rel(r.when)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-accent font-semibold">{r.agent}</span>
                          <span className="text-[11px] text-muted-3">· {kindLabel[r.kind]}</span>
                          <Chip tone={statusTone[r.status]} dot>{statusLabel[r.status]}</Chip>
                        </div>
                        <div className="text-[12.5px] text-muted leading-relaxed mt-1.5">{r.detail}</div>
                        {r.emailBody && r.status === 'pending' && (
                          <div className="mt-2 rounded-lg border border-border bg-surface-tint p-3 text-[12px] text-ink-2 whitespace-pre-wrap leading-relaxed max-h-28 overflow-y-auto">{r.emailBody}</div>
                        )}
                        {r.status === 'pending' && (
                          <div className="flex items-center gap-2 mt-2.5">
                            <Button variant="primary" icon={<Check size={15} />} onClick={() => act.approveRun(r)}>{r.kind === 'draft' ? 'Approve & send' : r.kind === 'task' || r.kind === 'risk' ? 'Approve & create' : 'Approve'}</Button>
                            <Button onClick={() => act.dismissRun(r.id)}>Dismiss</Button>
                            {r.dealId && <button onClick={() => nav(`/deals/${r.dealId}`)} className="text-[13px] text-accent font-semibold ml-1">View deal →</button>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {log.length === 0 && (
                <div className="p-8 text-center">
                  <Check size={26} className="text-positive mx-auto" />
                  <div className="text-[14px] font-semibold text-ink-2 mt-2">Nothing here</div>
                  <div className="text-[13px] text-muted-b mt-0.5">No agent tasks match these filters.</div>
                </div>
              )}
            </div>
          </div>

          {/* roster */}
          <aside className="flex flex-col gap-3">
            <div className="flex items-center gap-2"><Robot size={17} className="text-accent" /><div className="text-[14px] font-bold text-ink">AI agents</div><span className="text-[11px] text-muted-3 ml-auto">{agents.filter((a) => a.on).length}/{agents.length} on</span></div>
            {agents.map((a) => (
              <div key={a.id} className="bg-surface border border-border rounded-card p-3.5">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-semibold text-ink-2">{a.name}</div>
                  <button onClick={() => act.toggleAgent(a.id, a.name, a.on)} className={classNames('w-9 h-5 rounded-full flex items-center px-0.5 transition-colors', a.on ? 'bg-accent justify-end' : 'bg-input-border justify-start')}><span className="w-4 h-4 rounded-full bg-white" /></button>
                </div>
                <div className="text-[12px] text-muted-2 mt-1 leading-snug">{a.desc}</div>
                <div className="mt-2 flex items-center gap-2">
                  <Chip tone={a.on ? 'positive' : 'neutral'} dot>{a.on ? 'Running' : 'Paused'}</Chip>
                  {a.schedule && <span className="inline-flex items-center gap-1 text-[11px] text-muted-2"><Clock size={11} />{a.schedule}</span>}
                </div>
              </div>
            ))}
            <button onClick={() => setBuildOpen(true)} className="rounded-card border border-dashed border-input-border p-3 text-[12.5px] text-accent font-semibold hover:bg-accent-wash-3 transition-colors flex items-center justify-center gap-1.5"><Sparkle size={14} /> New agent</button>

            <div className="flex items-center gap-2 mt-3"><Bolt size={16} className="text-accent" /><div className="text-[14px] font-bold text-ink">Rules</div><span className="text-[11px] text-muted-3 ml-auto">{automations.filter((a) => a.active).length}/{automations.length} on</span></div>
            {automations.map((r) => (
              <div key={r.id} className="bg-surface border border-border rounded-card p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => nav(`/automation/${r.id}`)} className="text-[13px] font-semibold text-ink-2 text-left truncate hover:text-accent">{r.name}</button>
                  <button onClick={() => act.updateAutomation(r.id, { active: !r.active })} className={classNames('w-9 h-5 rounded-full flex items-center px-0.5 transition-colors shrink-0', r.active ? 'bg-accent justify-end' : 'bg-input-border justify-start')}><span className="w-4 h-4 rounded-full bg-white" /></button>
                </div>
                <div className="text-[12px] text-muted-2 mt-1 leading-snug">{r.steps[0]?.title ?? 'No trigger'} · {r.steps.length} step{r.steps.length === 1 ? '' : 's'}</div>
                <div className="mt-2 flex items-center gap-2">
                  <Chip tone={r.active ? 'positive' : 'neutral'} dot>{r.active ? 'Live' : 'Off'}</Chip>
                  <button onClick={() => nav(`/automation/${r.id}`)} className="text-[11.5px] text-accent font-semibold ml-auto">Edit →</button>
                </div>
              </div>
            ))}
            <button onClick={newRule} className="rounded-card border border-dashed border-input-border p-3 text-[12.5px] text-accent font-semibold hover:bg-accent-wash-3 transition-colors flex items-center justify-center gap-1.5"><Bolt size={14} /> New rule</button>
          </aside>
        </div>
      </PageBody>
    </>
  )
}

const AGENT_PRESETS = [
  { name: 'Follow-up writer', desc: 'Drafts a personalised follow-up when a deal goes quiet for 5 days.', schedule: 'Daily · 07:00' },
  { name: 'Lead qualifier', desc: 'Scores and researches new leads, then routes the good ones to you.', schedule: 'Realtime' },
  { name: 'Risk watcher', desc: 'Flags deals losing momentum and suggests the next best action.', schedule: 'Every hour' },
  { name: 'Review requester', desc: 'Asks happy customers for a Google/Trustpilot review after handover.', schedule: 'Daily · 17:00' },
]
const SCHEDULES = ['Realtime', 'Every hour', 'Daily · 07:00', 'Daily · 17:00', 'Weekly · Mon 08:00', 'On meetings']
function BuildAgentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const act = useActions()
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [schedule, setSchedule] = useState('Realtime')
  const reset = () => { setName(''); setDesc(''); setSchedule('Realtime') }
  return (
    <Modal open={open} onClose={onClose} title="New agent" subtitle="Name it, tell it its job, set when it runs"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { if (name.trim()) { act.addAgent(name.trim(), desc || 'Custom agent', schedule); reset(); onClose() } }}>Create agent</Button></>}>
      <Field label="Start from a preset">
        <div className="flex flex-wrap gap-2">
          {AGENT_PRESETS.map((p) => (
            <button key={p.name} onClick={() => { setName(p.name); setDesc(p.desc); setSchedule(p.schedule) }} className="text-[12px] px-2.5 py-1.5 rounded-lg border border-border text-ink-3 hover:border-accent hover:text-accent">{p.name}</button>
          ))}
        </div>
      </Field>
      <Field label="Agent name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Follow-up writer" autoFocus /></Field>
      <Field label="What should it do?"><Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Draft a follow-up when a deal goes quiet…" /></Field>
      <Field label="When should it run?"><Select value={schedule} onChange={(e) => setSchedule(e.target.value)}>{SCHEDULES.map((s) => (<option key={s}>{s}</option>))}</Select></Field>
    </Modal>
  )
}

function rel(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
