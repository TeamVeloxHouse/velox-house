import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Kpi, Chip, Avatar, Progress } from '../components/ui'
import { Modal } from '../components/overlays'
import { ViewSwitch } from '../components/chrome'
import { Bars, Grid, Plus, Check, Sun, Box, Flow, Building } from '../components/icons'
import { Table, Row, Cell } from '../components/Table'
import { useState_, useActions, useSelectors } from '../store/store'
import { buildProject, MILESTONES } from '../lib/delivery'
import { gbp } from '../lib/solar'
import { classNames } from '../lib/format'

const milestoneColor = ['#8FB0FF', '#7AA0F5', '#5B85F0', '#3A67E4', '#2E5AD8', '#1D4ED8', '#1740B8', '#0E7C66']

export function Delivery() {
  const nav = useNavigate()
  const { projects, deals } = useState_()
  const sel = useSelectors()
  const act = useActions()
  const [view, setView] = useState<'board' | 'list'>('board')
  const [startOpen, setStartOpen] = useState(false)

  const inFlight = projects.filter((p) => p.milestoneIndex < MILESTONES.length - 1)
  const revenueInDelivery = inFlight.reduce((s, p) => s + p.value, 0)
  const scheduled = projects.filter((p) => p.installDate && p.milestoneIndex < 5).length
  const ptoBacklog = projects.filter((p) => p.milestoneIndex >= 5 && p.milestoneIndex < MILESTONES.length - 1).length

  // won solar deals not already a project
  const candidates = deals.filter((d) => (d.won || /solar install/i.test(d.name)) && !projects.some((p) => p.dealId === d.id))

  function startFromDeal(dealId: string) {
    const d = deals.find((x) => x.id === dealId)!
    const contact = sel.peopleForDeal(d)[0]
    const p = buildProject({ dealId: d.id, address: d.org, customer: contact?.name ?? 'Homeowner', owner: d.owner, value: d.value, design: (d as any).solar })
    act.startProject(p)
    setStartOpen(false)
    nav(`/studio/delivery/${p.id}`)
  }

  return (
    <>
      <TopBar
        title="Delivery"
        crumbs={['Studio', 'Operations']}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setStartOpen(true)}>Start delivery</Button>}
      />
      <div className="h-[52px] shrink-0 bg-surface border-b border-border flex items-center gap-3 px-7">
        <ViewSwitch tabs={[{ id: 'board', icon: Bars, label: 'Board' }, { id: 'list', icon: Grid, label: 'List' }]} value={view} onChange={setView} />
        <span className="ml-auto text-[13px] text-muted-2"><span className="font-semibold text-ink-2">{inFlight.length}</span> installs in progress</span>
      </div>

      <main className="flex-1 overflow-auto p-7 flex flex-col gap-5">
        <div className="grid grid-cols-4 gap-4">
          <Kpi label="In delivery" value={String(inFlight.length)} delta={`${gbp(revenueInDelivery)} in flight`} deltaTone="muted" />
          <Kpi variant="blue" label="Installs scheduled" value={String(scheduled)} delta="Booked in" />
          <Kpi label="Awaiting PTO" value={String(ptoBacklog)} delta="Near completion" deltaTone="muted" />
          <Kpi variant="deep" label="Avg. sale → PTO" value="41 days" delta="6 days faster" />
        </div>

        {view === 'board' ? (
          <div className="flex gap-3.5 overflow-x-auto pb-2 min-h-0">
            {MILESTONES.map((m, i) => {
              const col = projects.filter((p) => p.milestoneIndex === i)
              return (
                <div key={m.key} className="w-[230px] shrink-0 flex flex-col">
                  <div className="flex items-center justify-between pb-1">
                    <div className="text-[13px] font-semibold text-ink-2">{m.label}</div>
                    <span className="text-[12px] text-muted-3">{col.length}</span>
                  </div>
                  <div className="h-[3px] rounded-full mb-2.5" style={{ background: milestoneColor[i] }} />
                  <div className="flex flex-col gap-2.5">
                    {col.map((p) => (
                      <button key={p.id} onClick={() => nav(`/studio/delivery/${p.id}`)} className="text-left bg-surface border border-border rounded-rail p-3.5 hover:shadow-card transition-shadow">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-md bg-amber-50 flex items-center justify-center shrink-0" style={{ background: '#FDF2E2', color: '#A85B00' }}><Sun size={13} /></span>
                          <div className="text-[13px] font-semibold text-ink-2 truncate flex-1">{p.address}</div>
                        </div>
                        <div className="text-[12px] text-muted-2 mt-1.5">{p.customer} · {gbp(p.value)}</div>
                        <div className="mt-2"><Progress value={Math.round((p.milestoneIndex / (MILESTONES.length - 1)) * 100)} height={4} color={milestoneColor[i]} track="#EDF0F4" /></div>
                        {p.installDate && p.milestoneIndex < 6 && <div className="text-[11px] text-accent font-semibold mt-2">Install {p.installDate}</div>}
                        {p.products.length > 1 && <div className="flex gap-1 mt-2">{p.products.slice(0, 3).map((pr) => <span key={pr.name} className="text-[10px] font-medium text-ink-3 bg-control rounded px-1.5 py-0.5">{pr.name}</span>)}</div>}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <Table
            template="1.8fr 1.2fr 1.4fr 1fr 1fr 0.9fr"
            columns={[{ key: 'a', header: 'Project' }, { key: 'c', header: 'Customer' }, { key: 'm', header: 'Milestone' }, { key: 'v', header: 'Value', align: 'right' }, { key: 'i', header: 'Install' }, { key: 'o', header: 'Owner' }]}
            footer={<span>{projects.length} projects</span>}
          >
            {projects.map((p) => (
              <Row key={p.id} template="1.8fr 1.2fr 1.4fr 1fr 1fr 0.9fr" onClick={() => nav(`/studio/delivery/${p.id}`)}>
                <Cell className="font-semibold text-ink-2">{p.address}</Cell>
                <Cell muted>{p.customer}</Cell>
                <Cell><Chip tone={p.milestoneIndex === MILESTONES.length - 1 ? 'positive' : 'accent'} dot>{MILESTONES[p.milestoneIndex].label}</Chip></Cell>
                <Cell align="right" className="font-semibold text-ink-2">{gbp(p.value)}</Cell>
                <Cell muted>{p.installDate ?? '—'}</Cell>
                <Cell muted>{p.owner}</Cell>
              </Row>
            ))}
          </Table>
        )}
      </main>

      <Modal open={startOpen} onClose={() => setStartOpen(false)} title="Start a delivery project" subtitle="Turn a won solar deal into a tracked install">
        {candidates.length === 0 ? (
          <div className="text-[13px] text-muted-b">No eligible deals. Win a solar deal (or generate one in the Design Studio) first.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {candidates.map((d) => (
              <button key={d.id} onClick={() => startFromDeal(d.id)} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-border-blue hover:bg-surface-tint text-left">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#FDF2E2', color: '#A85B00' }}><Sun size={16} /></span>
                <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate">{d.name}</div><div className="text-[12px] text-muted-2">{d.org} · {gbp(d.value)}</div></div>
                <Plus size={16} className="text-accent" />
              </button>
            ))}
          </div>
        )}
      </Modal>
    </>
  )
}

const productIcon: Record<string, any> = { 'Solar PV': Sun, 'Battery storage': Box, 'EV charger': Flow, default: Building }

export function ProjectDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { projects } = useState_()
  const act = useActions()
  const p = projects.find((x) => x.id === id)

  if (!p) return (<><TopBar title="Delivery" /><PageBody><div className="text-muted-b">Project not found. <button onClick={() => nav('/studio/delivery')} className="text-accent font-semibold">Back to delivery</button>.</div></PageBody></>)

  const pct = Math.round((p.milestoneIndex / (MILESTONES.length - 1)) * 100)
  const atPto = p.milestoneIndex === MILESTONES.length - 1
  const tasksDone = p.tasks.filter((t) => t.done).length

  return (
    <>
      <TopBar
        title="Delivery"
        crumbs={[p.address]}
        actions={atPto ? <Chip tone="positive" dot>Handover complete</Chip> : <Button variant="primary" icon={<Check size={16} />} onClick={() => act.advanceMilestone(p)}>Advance to {MILESTONES[p.milestoneIndex + 1].label}</Button>}
      />
      <PageBody>
        <button onClick={() => nav('/studio/delivery')} className="text-[13px] text-accent font-semibold self-start">← Delivery board</button>

        {/* milestone stepper */}
        <div className="bg-surface border border-border rounded-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div><div className="text-[16px] font-bold text-ink">{p.address}</div><div className="text-[13px] text-muted-b">{p.customer} · {p.owner} · {gbp(p.value)}</div></div>
            <div className="text-right"><div className="text-[22px] font-bold text-ink">{pct}%</div><div className="text-[12px] text-muted-2">to PTO</div></div>
          </div>
          <div className="flex items-center">
            {p.milestones.map((m, i) => (
              <div key={m.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5 shrink-0" style={{ width: 44 }}>
                  <div className={classNames('w-8 h-8 rounded-full flex items-center justify-center border-2', m.done ? 'bg-positive border-positive text-white' : i === p.milestoneIndex ? 'border-accent text-accent bg-accent-wash' : 'border-input-border text-muted-3')}>
                    {m.done ? <Check size={15} strokeWidth={3} /> : <span className="text-[12px] font-bold">{i + 1}</span>}
                  </div>
                  <span className={classNames('text-[10px] text-center leading-tight', i === p.milestoneIndex ? 'text-accent font-semibold' : 'text-muted-2')}>{m.label}</span>
                </div>
                {i < p.milestones.length - 1 && <div className="flex-1 h-0.5 mx-1 -mt-4" style={{ background: m.done ? '#0E7C66' : '#E4E8EE' }} />}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
          {/* checklist */}
          <div className="bg-surface border border-border rounded-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[15px] font-semibold text-ink">Job checklist</div>
              <span className="text-[12px] text-muted-2">{tasksDone}/{p.tasks.length} done</span>
            </div>
            <div className="flex flex-col gap-1">
              {p.tasks.map((t) => (
                <button key={t.id} onClick={() => act.toggleProjectTask(p, t.id)} className="flex items-center gap-3 py-2 text-left">
                  <span className={classNames('w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0', t.done ? 'bg-accent border-accent' : 'border-input-border')}>{t.done && <Check size={12} className="text-white" strokeWidth={2.6} />}</span>
                  <span className={classNames('text-[13px]', t.done ? 'text-muted-3 line-through' : 'text-ink-2')}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* products + dates */}
          <div className="flex flex-col gap-4">
            <div className="bg-surface border border-border rounded-card p-5">
              <div className="text-[15px] font-semibold text-ink mb-3">Product lines</div>
              <div className="flex flex-col gap-2.5">
                {p.products.map((pr) => {
                  const Icon = productIcon[pr.name] ?? productIcon.default
                  return (
                    <div key={pr.name} className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-accent-wash text-accent flex items-center justify-center shrink-0"><Icon size={14} /></span>
                      <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2">{pr.name}</div><div className="text-[12px] text-muted-2">{pr.detail}</div></div>
                      <div className="text-[13px] font-semibold text-ink-2">{gbp(pr.value)}</div>
                    </div>
                  )
                })}
                <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-divider"><span className="text-[13px] font-bold text-ink">Total</span><span className="text-[15px] font-bold text-ink">{gbp(p.value)}</span></div>
              </div>
            </div>
            <div className="bg-surface border border-border rounded-card p-5">
              <div className="text-[15px] font-semibold text-ink mb-3">Key dates</div>
              <Row2 label="System size" value={p.systemKwp ? `${p.systemKwp} kWp` : '—'} />
              <Row2 label="Install date" value={p.installDate ?? 'To be booked'} />
              <Row2 label="PTO / handover" value={p.ptoDate ?? (atPto ? 'Complete' : 'Pending')} />
              {p.dealId && <button onClick={() => nav(`/deals/${p.dealId}`)} className="text-[13px] text-accent font-semibold mt-2">View linked deal →</button>}
            </div>
          </div>
        </div>
      </PageBody>
    </>
  )
}

function Row2({ label, value }: { label: string; value: string }) {
  return (<div className="flex items-center justify-between py-1.5"><span className="text-[13px] text-muted-b">{label}</span><span className="text-[13px] font-semibold text-ink-2">{value}</span></div>)
}
