import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Chip, Kpi } from '../components/ui'
import { Robot, Sparkle, Check, Envelope, Task, Bolt, Building, Note } from '../components/icons'
import { useState_, useActions } from '../store/store'
import type { AgentRun } from '../store/types'
import { classNames } from '../lib/format'

const kindIcon: Record<AgentRun['kind'], any> = { draft: Envelope, task: Task, risk: Bolt, enrich: Building, triage: Sparkle, summary: Note }

export function Agents() {
  const nav = useNavigate()
  const { agents, agentRuns } = useState_()
  const act = useActions()

  const pending = agentRuns.filter((r) => r.status === 'pending').sort((a, b) => b.when - a.when)
  const history = agentRuns.filter((r) => r.status !== 'pending').sort((a, b) => b.when - a.when)

  return (
    <>
      <TopBar
        title="Agents"
        crumbs={['Autonomous workforce']}
        actions={<><Button icon={<Sparkle size={16} />} onClick={() => act.toast('Agent builder (demo)', 'accent')}>Build agent</Button></>}
      />
      <PageBody>
        <div className="grid grid-cols-4 gap-4">
          <Kpi variant="deep" label="Active agents" value={String(agents.filter((a) => a.on).length)} delta={`${agents.length} configured`} />
          <Kpi variant="blue" label="Awaiting approval" value={String(pending.length)} delta="In your review queue" deltaTone="muted" />
          <Kpi label="Actions today" value="66" delta="+18 vs yesterday" />
          <Kpi label="Time saved" value="4.2h" delta="This week" />
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 320px' }}>
          {/* review queue */}
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="text-[15px] font-semibold text-ink">Review queue</div>
                {pending.length > 0 && <Chip tone="accent">{pending.length}</Chip>}
              </div>
              {pending.length === 0 ? (
                <div className="bg-surface border border-border rounded-card p-8 text-center">
                  <Check size={28} className="text-positive mx-auto" />
                  <div className="text-[14px] font-semibold text-ink-2 mt-2">All caught up</div>
                  <div className="text-[13px] text-muted-b mt-0.5">Your agents have nothing waiting on you.</div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {pending.map((r) => {
                    const Icon = kindIcon[r.kind]
                    return (
                      <div key={r.id} className="bg-surface border border-border rounded-card p-4 shadow-card">
                        <div className="flex items-start gap-3">
                          <span className="w-9 h-9 rounded-[10px] bg-accent-gradient text-white flex items-center justify-center shrink-0 shadow-primary"><Icon size={17} /></span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-semibold text-ink-2">{r.title}</span>
                              <span className="ml-auto text-[11px] text-muted-3">{rel(r.when)}</span>
                            </div>
                            <div className="text-[11px] text-accent font-semibold mt-0.5">{r.agent}</div>
                            <div className="text-[13px] text-muted leading-relaxed mt-1.5">{r.detail}</div>
                            {r.emailBody && (
                              <div className="mt-2.5 rounded-lg border border-border bg-surface-tint p-3 text-[12.5px] text-ink-2 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">{r.emailBody}</div>
                            )}
                            <div className="flex items-center gap-2 mt-3">
                              <Button variant="primary" icon={<Check size={15} />} onClick={() => act.approveRun(r)}>{r.kind === 'draft' ? 'Approve & send' : r.kind === 'task' || r.kind === 'risk' ? 'Approve & create' : 'Approve'}</Button>
                              <Button onClick={() => act.dismissRun(r.id)}>Dismiss</Button>
                              {r.dealId && <button onClick={() => nav(`/deals/${r.dealId}`)} className="text-[13px] text-accent font-semibold ml-1">View deal →</button>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* history */}
            <div>
              <div className="text-[15px] font-semibold text-ink mb-2.5">Recent activity</div>
              <div className="bg-surface border border-border rounded-card divide-y divide-divider">
                {history.map((r) => {
                  const Icon = kindIcon[r.kind]
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                      <span className={classNames('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', r.status === 'approved' ? 'bg-positive-wash text-positive' : 'bg-control text-muted')}><Icon size={14} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-ink-2 truncate">{r.title}</div>
                        <div className="text-[12px] text-muted-2">{r.agent}</div>
                      </div>
                      <Chip tone={r.status === 'approved' ? 'positive' : 'neutral'}>{r.status === 'approved' ? 'Applied' : 'Dismissed'}</Chip>
                      <span className="text-[11px] text-muted-3 w-14 text-right">{rel(r.when)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* roster */}
          <aside className="flex flex-col gap-3">
            <div className="flex items-center gap-2"><Robot size={17} className="text-accent" /><div className="text-[14px] font-bold text-ink">Your agents</div></div>
            {agents.map((a) => (
              <div key={a.id} className="bg-surface border border-border rounded-card p-3.5">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-semibold text-ink-2">{a.name}</div>
                  <button onClick={() => act.toggleAgent(a.id, a.name, a.on)} className={classNames('w-9 h-5 rounded-full flex items-center px-0.5 transition-colors', a.on ? 'bg-accent justify-end' : 'bg-input-border justify-start')}><span className="w-4 h-4 rounded-full bg-white" /></button>
                </div>
                <div className="text-[12px] text-muted-2 mt-1 leading-snug">{a.desc}</div>
                <div className="mt-2"><Chip tone={a.on ? 'positive' : 'neutral'} dot>{a.on ? a.runs : 'Paused'}</Chip></div>
              </div>
            ))}
          </aside>
        </div>
      </PageBody>
    </>
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
