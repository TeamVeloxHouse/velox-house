import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Kpi, Chip, Progress } from '../components/ui'
import { Modal, Field, Input, Select } from '../components/overlays'
import { ViewSwitch, PillTabs } from '../components/chrome'
import { Bars, Grid, Plus, Check, Sun, Box, Flow, Building, Dollar, Clock, Layers, Bolt } from '../components/icons'
import { Table, Row, Cell } from '../components/Table'
import { useState_, useActions, useSelectors } from '../store/store'
import { buildProject, MILESTONES, buildOrder, buildInvoice, orderTotal, projectFinance } from '../lib/delivery'
import { estimateMaterials, materialsTotal } from '../lib/materials'
import { DnoTab, DnoStatusPill } from './DnoSection'
import type { StudioProject, ProjectOrder, ProjectInvoice, OrderItem, InvoiceKind, InvoiceStatus, OrderStatus } from '../store/types'
import { gbp } from '../lib/solar'
import { classNames } from '../lib/format'

const milestoneColor = ['#57C9B4', '#7AA0F5', '#57C9B4', '#13927B', '#2E5AD8', '#13927B', '#1740B8', '#0E7C66']

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
                        {p.dno && <div className="mt-2"><DnoStatusPill dno={p.dno} /></div>}
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
  const [tab, setTab] = useState(() => (typeof window !== 'undefined' && window.location.hash === '#dno' ? 'dno' : 'overview'))
  const p = projects.find((x) => x.id === id)

  if (!p) return (<><TopBar title="Delivery" /><PageBody><div className="text-muted-b">Project not found. <button onClick={() => nav('/studio/delivery')} className="text-accent font-semibold">Back to delivery</button>.</div></PageBody></>)

  const pct = Math.round((p.milestoneIndex / (MILESTONES.length - 1)) * 100)
  const atPto = p.milestoneIndex === MILESTONES.length - 1
  const fin = projectFinance(p)
  const orders = p.orders ?? []
  const invoices = p.invoices ?? []

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
            <div><div className="flex items-center gap-2.5"><span className="text-[16px] font-bold text-ink">{p.address}</span>{p.dno && <DnoStatusPill dno={p.dno} />}</div><div className="text-[13px] text-muted-b">{p.customer} · {p.owner} · {gbp(p.value)}{p.systemKwp ? ` · ${p.systemKwp} kWp` : ''}</div></div>
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

        {/* finance strip */}
        <div className="grid grid-cols-4 gap-4">
          <Kpi label="Contract value" value={gbp(p.value)} delta={fin.uninvoiced > 0 ? `${gbp(fin.uninvoiced)} not yet invoiced` : 'Fully invoiced'} deltaTone="muted" />
          <Kpi variant="blue" label="Invoiced" value={gbp(fin.invoiced)} delta={`${gbp(fin.paid)} paid`} />
          <Kpi label="Outstanding" value={gbp(fin.outstanding)} delta={invoices.some((i) => i.status === 'overdue') ? 'Overdue invoice' : 'On track'} deltaTone={invoices.some((i) => i.status === 'overdue') ? 'negative' : 'muted'} />
          <Kpi variant="deep" label="Materials cost" value={gbp(fin.orderedCost)} delta={`${gbp(fin.grossMargin)} gross margin`} />
        </div>

        <PillTabs
          className="mt-1"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'overview', label: 'Overview', icon: Layers },
            { id: 'timeline', label: 'Timeline', icon: Clock },
            { id: 'dno', label: `DNO${p.dno ? ` · ${p.dno.form}` : ''}`, icon: Bolt },
            { id: 'materials', label: 'Materials', icon: Grid },
            { id: 'orders', label: `Orders${orders.length ? ` · ${orders.length}` : ''}`, icon: Box },
            { id: 'invoices', label: `Invoices${invoices.length ? ` · ${invoices.length}` : ''}`, icon: Dollar },
          ]}
        />

        {tab === 'overview' && <OverviewTab p={p} atPto={atPto} />}
        {tab === 'timeline' && <TimelineTab p={p} />}
        {tab === 'dno' && <DnoTab p={p} />}
        {tab === 'materials' && <MaterialsTab p={p} />}
        {tab === 'orders' && <OrdersTab p={p} />}
        {tab === 'invoices' && <InvoicesTab p={p} />}
      </PageBody>
    </>
  )
}

function OverviewTab({ p, atPto }: { p: StudioProject; atPto: boolean }) {
  const nav = useNavigate()
  const act = useActions()
  const tasksDone = p.tasks.filter((t) => t.done).length
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
      {/* checklist / processes */}
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
  )
}

function TimelineTab({ p }: { p: StudioProject }) {
  // milestones become a dated timeline; install / PTO surface as pinned events
  const events = p.milestones.map((m, i) => ({
    key: m.key,
    label: m.label,
    date: m.date,
    done: m.done,
    current: i === p.milestoneIndex,
    detail: m.key === 'scheduled' && p.installDate ? `Install booked · ${p.installDate}` : m.key === 'pto' && p.ptoDate ? `Handover · ${p.ptoDate}` : undefined,
  }))
  return (
    <div className="bg-surface border border-border rounded-card p-5 max-w-[640px]">
      <div className="text-[15px] font-semibold text-ink mb-4">Project timeline</div>
      <div className="flex flex-col">
        {events.map((e, i) => (
          <div key={e.key} className="flex gap-3.5">
            <div className="flex flex-col items-center">
              <div className={classNames('w-3.5 h-3.5 rounded-full border-2 shrink-0 mt-0.5', e.done ? 'bg-positive border-positive' : e.current ? 'border-accent bg-accent-wash' : 'border-input-border bg-surface')} />
              {i < events.length - 1 && <div className="w-0.5 flex-1 my-1" style={{ background: e.done ? '#0E7C66' : '#E4E8EE', minHeight: 26 }} />}
            </div>
            <div className={classNames('pb-4', e.current ? '' : 'opacity-95')}>
              <div className="flex items-center gap-2">
                <span className={classNames('text-[13.5px] font-semibold', e.done ? 'text-ink-2' : e.current ? 'text-accent' : 'text-muted-2')}>{e.label}</span>
                {e.current && <Chip tone="accent" dot>In progress</Chip>}
              </div>
              <div className="text-[12px] text-muted-2 mt-0.5">{e.done ? (e.date ? `Completed ${e.date}` : 'Completed') : e.current ? 'Current stage' : 'Upcoming'}{e.detail ? ` · ${e.detail}` : ''}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MaterialsTab({ p }: { p: StudioProject }) {
  const act = useActions()
  const items = estimateMaterials(p)
  const total = materialsTotal(items)
  const already = (p.orders ?? []).some((o) => o.supplier === 'Job estimate')
  return (
    <div className="bg-surface border border-border rounded-card p-5">
      <div className="flex items-center justify-between mb-1">
        <div><div className="text-[15px] font-semibold text-ink">Materials estimate</div><div className="text-[12px] text-muted-2">Generated from {p.systemKwp ?? 4} kWp · confirm against the actual site survey before ordering</div></div>
        <Button
          icon={<Plus size={15} />}
          onClick={() => { act.addOrder(p.id, buildOrder('Job estimate', items)); act.toast('Materials estimate added to Orders') }}
          className={already ? 'opacity-50 pointer-events-none' : undefined}
        >
          {already ? 'Already ordered' : 'Send to orders'}
        </Button>
      </div>
      <div className="mt-4 flex flex-col gap-1">
        {items.map((it, idx) => (
          <div key={idx} className="flex items-center text-[12.5px] text-ink-3 py-1.5 border-b border-divider last:border-0">
            <span className="flex-1">{it.name}</span>
            <span className="text-muted-2 tabular-nums w-28 text-right">{it.qty} × {gbp(it.unitCost)}</span>
            <span className="font-semibold text-ink-2 tabular-nums w-24 text-right">{gbp(it.qty * it.unitCost)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-3 mt-1">
        <span className="text-[14px] font-bold text-ink">Estimated materials cost</span>
        <span className="text-[20px] font-bold text-ink">{gbp(total)}</span>
      </div>
    </div>
  )
}

function OrdersTab({ p }: { p: StudioProject }) {
  const act = useActions()
  const [add, setAdd] = useState(false)
  const orders = p.orders ?? []
  return (
    <div className="bg-surface border border-border rounded-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div><div className="text-[15px] font-semibold text-ink">Orders</div><div className="text-[12px] text-muted-2">Materials &amp; equipment for this install</div></div>
        <Button icon={<Plus size={15} />} onClick={() => setAdd(true)}>New order</Button>
      </div>
      {orders.length === 0 ? (
        <div className="text-[13px] text-muted-2 py-6 text-center">No orders yet. Add a supplier order to track materials and cost.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {orders.map((o) => (
            <div key={o.id} className="border border-border rounded-lg p-3.5">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-accent-wash text-accent flex items-center justify-center shrink-0"><Box size={15} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-ink-2">{o.supplier}</div>
                  <div className="text-[12px] text-muted-2">{o.items.length} line{o.items.length === 1 ? '' : 's'}{o.orderedDate ? ` · ordered ${o.orderedDate}` : ''}{o.expectedDate ? ` · due ${o.expectedDate}` : ''}</div>
                </div>
                <div className="text-[13.5px] font-bold text-ink-2 mr-1">{gbp(orderTotal(o))}</div>
                <OrderStatusSelect status={o.status} onChange={(s) => act.setOrderStatus(p.id, o.id, s)} />
                <button onClick={() => act.removeOrder(p.id, o.id)} className="text-[12px] text-negative font-medium hover:underline shrink-0">Remove</button>
              </div>
              <div className="mt-2.5 pl-11 flex flex-col gap-1">
                {o.items.map((it, idx) => (
                  <div key={idx} className="flex items-center text-[12.5px] text-ink-3">
                    <span className="flex-1">{it.name}</span>
                    <span className="text-muted-2 tabular-nums w-24 text-right">{it.qty} × {gbp(it.unitCost)}</span>
                    <span className="font-semibold text-ink-2 tabular-nums w-20 text-right">{gbp(it.qty * it.unitCost)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <AddOrderModal open={add} onClose={() => setAdd(false)} onAdd={(supplier, items) => { act.addOrder(p.id, buildOrder(supplier, items)); setAdd(false) }} />
    </div>
  )
}

const ORDER_TONE: Record<OrderStatus, 'neutral' | 'accent' | 'positive'> = { draft: 'neutral', ordered: 'accent', delivered: 'positive' }
function OrderStatusSelect({ status, onChange }: { status: OrderStatus; onChange: (s: OrderStatus) => void }) {
  return (
    <select value={status} onChange={(e) => onChange(e.target.value as OrderStatus)} className={classNames('h-7 px-2 rounded-md border text-[11.5px] font-semibold outline-none shrink-0', status === 'delivered' ? 'border-positive/40 text-positive bg-positive/5' : status === 'ordered' ? 'border-accent/40 text-accent bg-accent-wash' : 'border-input-border text-muted-b')}>
      <option value="draft">Draft</option>
      <option value="ordered">Ordered</option>
      <option value="delivered">Delivered</option>
    </select>
  )
}

function InvoicesTab({ p }: { p: StudioProject }) {
  const act = useActions()
  const [add, setAdd] = useState(false)
  const invoices = p.invoices ?? []
  const fin = projectFinance(p)
  return (
    <div className="bg-surface border border-border rounded-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div><div className="text-[15px] font-semibold text-ink">Invoices</div><div className="text-[12px] text-muted-2">{gbp(fin.paid)} paid · {gbp(fin.outstanding)} outstanding · {gbp(fin.uninvoiced)} not yet invoiced</div></div>
        <Button icon={<Plus size={15} />} onClick={() => setAdd(true)}>New invoice</Button>
      </div>
      {invoices.length === 0 ? (
        <div className="text-[13px] text-muted-2 py-6 text-center">No invoices yet. Raise a deposit, interim or final invoice against the {gbp(p.value)} contract.</div>
      ) : (
        <Table
          template="1.3fr 0.9fr 1fr 1.1fr 1.4fr"
          columns={[{ key: 'n', header: 'Invoice' }, { key: 'k', header: 'Type' }, { key: 'a', header: 'Amount', align: 'right' }, { key: 's', header: 'Status' }, { key: 'x', header: 'Actions', align: 'right' }]}
          footer={<span>{invoices.length} invoice{invoices.length === 1 ? '' : 's'} · {gbp(fin.invoiced)} total</span>}
        >
          {invoices.map((inv) => (
            <Row key={inv.id} template="1.3fr 0.9fr 1fr 1.1fr 1.4fr">
              <Cell className="font-semibold text-ink-2">{inv.number}<div className="text-[11px] text-muted-2 font-normal">{inv.issuedDate ? `Issued ${inv.issuedDate}` : 'Draft'}{inv.dueDate && inv.status !== 'paid' ? ` · due ${inv.dueDate}` : ''}{inv.paidDate ? ` · paid ${inv.paidDate}` : ''}</div></Cell>
              <Cell muted className="capitalize">{inv.kind}</Cell>
              <Cell align="right" className="font-semibold text-ink-2 tabular-nums">{gbp(inv.amount)}</Cell>
              <Cell><Chip tone={INVOICE_TONE[inv.status]} dot>{inv.status[0].toUpperCase() + inv.status.slice(1)}</Chip></Cell>
              <Cell align="right">
                <div className="flex items-center gap-2 justify-end">
                  {inv.status === 'draft' && <button onClick={() => act.setInvoiceStatus(p.id, inv.id, 'sent')} className="text-[12px] text-accent font-semibold hover:underline">Mark sent</button>}
                  {(inv.status === 'sent' || inv.status === 'overdue') && <button onClick={() => act.setInvoiceStatus(p.id, inv.id, 'paid')} className="text-[12px] text-positive font-semibold hover:underline">Mark paid</button>}
                  <button onClick={() => act.removeInvoice(p.id, inv.id)} className="text-[12px] text-negative font-medium hover:underline">Remove</button>
                </div>
              </Cell>
            </Row>
          ))}
        </Table>
      )}
      <AddInvoiceModal open={add} defaultAmount={fin.uninvoiced} onClose={() => setAdd(false)} onAdd={(kind, amount) => { act.addInvoice(p.id, buildInvoice(p, kind, amount)); setAdd(false) }} />
    </div>
  )
}

const INVOICE_TONE: Record<InvoiceStatus, 'neutral' | 'accent' | 'positive' | 'negative'> = { draft: 'neutral', sent: 'accent', paid: 'positive', overdue: 'negative' }

function AddOrderModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (supplier: string, items: OrderItem[]) => void }) {
  const [supplier, setSupplier] = useState('')
  const [items, setItems] = useState<OrderItem[]>([{ name: '', qty: 1, unitCost: 0 }])
  const total = items.reduce((s, it) => s + it.qty * it.unitCost, 0)
  const patch = (idx: number, k: keyof OrderItem, v: string) => setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, [k]: k === 'name' ? v : Number(v) } : it)))
  const valid = supplier.trim() && items.some((it) => it.name.trim())
  const reset = () => { setSupplier(''); setItems([{ name: '', qty: 1, unitCost: 0 }]) }
  return (
    <Modal open={open} onClose={onClose} title="New order" subtitle="Materials or equipment from a supplier" width={620}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { if (valid) { onAdd(supplier.trim(), items.filter((it) => it.name.trim())); reset() } }}>Add order</Button></>}>
      <Field label="Supplier"><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Segen, City Electrical Factors…" autoFocus /></Field>
      <div className="text-[12px] font-semibold text-ink-3 mt-1 mb-1">Line items</div>
      <div className="flex flex-col gap-2">
        {items.map((it, idx) => (
          <div key={idx} className="grid gap-2" style={{ gridTemplateColumns: '1fr 64px 96px 24px' }}>
            <Input value={it.name} onChange={(e) => patch(idx, 'name', e.target.value)} placeholder="Item" />
            <Input type="number" value={String(it.qty)} onChange={(e) => patch(idx, 'qty', e.target.value)} placeholder="Qty" />
            <Input type="number" value={String(it.unitCost)} onChange={(e) => patch(idx, 'unitCost', e.target.value)} placeholder="£ each" />
            <button onClick={() => setItems((arr) => (arr.length > 1 ? arr.filter((_, i) => i !== idx) : arr))} className="text-muted-3 hover:text-negative text-[16px]">×</button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2.5">
        <button onClick={() => setItems((arr) => [...arr, { name: '', qty: 1, unitCost: 0 }])} className="text-[13px] text-accent font-semibold flex items-center gap-1"><Plus size={14} /> Add line</button>
        <div className="text-[13px] font-bold text-ink-2">Total {gbp(total)}</div>
      </div>
    </Modal>
  )
}

function AddInvoiceModal({ open, onClose, onAdd, defaultAmount }: { open: boolean; onClose: () => void; onAdd: (kind: InvoiceKind, amount: number) => void; defaultAmount: number }) {
  const [kind, setKind] = useState<InvoiceKind>('deposit')
  const [amount, setAmount] = useState('')
  const reset = () => { setKind('deposit'); setAmount('') }
  return (
    <Modal open={open} onClose={onClose} title="New invoice" subtitle="Raise an invoice against this project"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { const a = Number(amount) || 0; if (a > 0) { onAdd(kind, a); reset() } }}>Create invoice</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type"><Select value={kind} onChange={(e) => setKind(e.target.value as InvoiceKind)}><option value="deposit">Deposit</option><option value="interim">Interim</option><option value="final">Final</option><option value="other">Other</option></Select></Field>
        <Field label="Amount (£)"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={defaultAmount > 0 ? String(defaultAmount) : '0'} autoFocus /></Field>
      </div>
      {defaultAmount > 0 && <button onClick={() => setAmount(String(defaultAmount))} className="text-[12px] text-accent font-semibold mt-1 self-start">Use remaining balance · {gbp(defaultAmount)}</button>}
    </Modal>
  )
}

function Row2({ label, value }: { label: string; value: string }) {
  return (<div className="flex items-center justify-between py-1.5"><span className="text-[13px] text-muted-b">{label}</span><span className="text-[13px] font-semibold text-ink-2">{value}</span></div>)
}
