import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Kpi, Chip, Button, Progress, type ChipTone } from '../components/ui'
import { Sparkle, Check, Dollar, File, Star, Clock, Wrench, Box, Megaphone, Download, Person, Envelope, Flow } from '../components/icons'
import { classNames, money, initials } from '../lib/format'
import { useState_, useActions } from '../store/store'
import { DeptPage, Section, AiStrip, StatusChip, fmtDate, daysUntil } from './departments'
import { buildCashflowWorkbook, buildPnlWorkbook, downloadBlob } from '../lib/financeModel'
import type { DocKind } from '../store/types'

/* generic row */
function Row({ icon, title, sub, right }: { icon?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-divider last:border-0">
      {icon && <span className="w-9 h-9 rounded-lg bg-control text-muted-b flex items-center justify-center shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate">{title}</div>{sub && <div className="text-[12px] text-muted-2 truncate">{sub}</div>}</div>
      {right}
    </div>
  )
}
const Empty = ({ children }: { children: ReactNode }) => <div className="px-4 py-8 text-[13px] text-muted-2 text-center">{children}</div>

const invTone = (s: string): ChipTone => (s === 'paid' ? 'positive' : s === 'overdue' ? 'negative' : s === 'sent' ? 'accent' : 'neutral')
const expTone = (s: string): ChipTone => (s === 'reimbursed' ? 'positive' : s === 'approved' ? 'accent' : 'warning')

/* Documents list, filtered by kind — reused by Reports / Certificates pages */
function DocList({ kinds, empty }: { kinds: DocKind[]; empty: string }) {
  const { brandDocs } = useState_()
  const docs = brandDocs.filter((d) => kinds.includes(d.kind))
  if (docs.length === 0) return <Empty>{empty}</Empty>
  return <>{docs.map((d) => (
    <Row key={d.id} icon={<File size={16} />} title={d.title} sub={`${d.kind} · generated ${fmtDate(new Date(d.createdAt).toISOString())}`}
      right={<span className="flex items-center gap-2"><Chip tone="neutral">.{d.format}</Chip><button className="h-8 w-8 rounded-lg border border-border text-muted-b hover:bg-control flex items-center justify-center"><Download size={14} /></button></span>} />
  ))}</>
}

/* ========================= FINANCE ========================= */
export function FinanceInvoices() {
  const { projects } = useState_()
  const act = useActions()
  const [f, setF] = useState<'all' | 'unpaid' | 'overdue'>('all')
  const all = projects.flatMap((p) => (p.invoices ?? []).map((i) => ({ ...i, projectId: p.id, customer: p.customer, address: p.address })))
  const rows = all.filter((i) => (f === 'all' ? true : f === 'overdue' ? i.status === 'overdue' : i.status !== 'paid'))
  const outstanding = all.filter((i) => i.status !== 'paid').reduce((a, i) => a + i.amount, 0)
  const paid = all.filter((i) => i.status === 'paid').reduce((a, i) => a + i.amount, 0)
  return (
    <DeptPage title="Finance" crumb="Invoices" kpis={<>
      <Kpi label="Outstanding (AR)" value={money(outstanding, { compact: true })} variant="blue" />
      <Kpi label="Collected" value={money(paid, { compact: true })} deltaTone="positive" />
      <Kpi label="Invoices" value={String(all.length)} />
      <Kpi label="Overdue" value={String(all.filter((i) => i.status === 'overdue').length)} deltaTone="negative" />
    </>}>
      <Section title="Accounts receivable" meta={`${money(outstanding, { compact: true })} outstanding`} action={
        <div className="flex gap-1">{(['all', 'unpaid', 'overdue'] as const).map((k) => <button key={k} onClick={() => setF(k)} className={classNames('h-8 px-3 rounded-lg text-[12px] font-semibold capitalize', f === k ? 'bg-accent-wash text-accent' : 'text-muted-b hover:bg-control')}>{k}</button>)}</div>
      }>
        {rows.length === 0 ? <Empty>No invoices match.</Empty> : rows.map((i) => (
          <Row key={i.id} icon={<File size={16} />} title={`${i.number} · ${i.customer}`} sub={<span className="capitalize">{i.kind} · {i.address}</span>}
            right={<span className="flex items-center gap-2"><span className="text-[13px] font-bold text-ink-2">{money(i.amount)}</span><StatusChip tone={invTone(i.status)}>{i.status}</StatusChip>{i.status !== 'paid' && <button onClick={() => act.setInvoiceStatus(i.projectId, i.id, 'paid')} className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-positive-border bg-positive-wash text-positive">Mark paid</button>}</span>} />
        ))}
      </Section>
    </DeptPage>
  )
}

export function FinanceExpenses() {
  const { expenses } = useState_()
  const act = useActions()
  const pending = expenses.filter((e) => e.status === 'pending')
  const total = expenses.reduce((a, e) => a + e.amount, 0)
  return (
    <DeptPage title="Finance" crumb="Expenses" kpis={<>
      <Kpi label="This period" value={money(total)} variant="blue" />
      <Kpi label="Awaiting approval" value={String(pending.length)} deltaTone={pending.length ? 'negative' : 'positive'} />
      <Kpi label="Claims" value={String(expenses.length)} />
      <Kpi label="Pending value" value={money(pending.reduce((a, e) => a + e.amount, 0))} />
    </>} actions={<Button icon={<Sparkle size={16} />} onClick={() => { pending.forEach((e) => act.setExpenseStatus(e.id, 'approved')); }}>Approve all</Button>}>
      <Section title="Expense claims" meta={`${pending.length} pending`}>
        {expenses.map((e) => (
          <Row key={e.id} icon={<Dollar size={16} />} title={`${e.vendor} · ${e.category}`} sub={`${e.who} · ${fmtDate(e.date)}`}
            right={<span className="flex items-center gap-2"><span className="text-[13px] font-bold text-ink-2">{money(e.amount)}</span><StatusChip tone={expTone(e.status)}>{e.status}</StatusChip>{e.status === 'pending' && <button onClick={() => act.setExpenseStatus(e.id, 'approved')} className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-border-blue bg-accent-wash text-accent">Approve</button>}{e.status === 'approved' && <button onClick={() => act.setExpenseStatus(e.id, 'reimbursed')} className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-border text-muted-b hover:bg-control">Reimburse</button>}</span>} />
        ))}
      </Section>
    </DeptPage>
  )
}

export function FinanceForecasting() {
  const state = useState_()
  const act = useActions()
  const { deals, projects, expenses, employees } = state
  const open = deals.filter((d) => !d.won && !d.lost)
  const invoices = projects.flatMap((p) => (p.invoices ?? []))
  const outstanding = invoices.filter((i) => i.status !== 'paid').reduce((a, i) => a + i.amount, 0)
  const weighted = open.reduce((a, d) => a + d.value * (d.probability / 100), 0)
  const weeklyOpex = Math.round((expenses.reduce((a, e) => a + e.amount, 0) * 4) / 4 + employees.length * 720)
  const opening = 24500
  let bal = opening
  const weeks = Array.from({ length: 13 }, (_, i) => {
    const w = i + 1
    const inflow = Math.round((w <= 4 ? outstanding / 4 : 0) + (w >= 5 ? weighted / 9 : 0))
    const start = bal; const net = inflow - weeklyOpex; bal = start + net
    return { w, start, inflow, out: -weeklyOpex, net, close: bal }
  })
  const lowest = Math.min(...weeks.map((x) => x.close))
  return (
    <DeptPage title="Finance" crumb="Forecasting" kpis={<>
      <Kpi label="Opening balance" value={money(opening, { compact: true })} variant="blue" />
      <Kpi label="Projected wk-13" value={money(weeks[12].close, { compact: true })} deltaTone={weeks[12].close >= opening ? 'positive' : 'negative'} />
      <Kpi label="Lowest point" value={money(lowest, { compact: true })} deltaTone={lowest < 0 ? 'negative' : 'muted'} />
      <Kpi label="Weekly opex" value={money(weeklyOpex, { compact: true })} />
    </>} actions={<Button variant="primary" icon={<Download size={16} />} onClick={() => buildCashflowWorkbook(state).then((b) => { downloadBlob(b, 'Solar House — 13-week cashflow.xlsx'); act.generateArtifact('Cashflow forecast — 13 week', 'model', 'xlsx') })}>Download .xlsx</Button>}>
      <AiStrip role="Finance forecasting" blurb="This 13-week model is live from your pipeline and AR. Download it as a real spreadsheet — formulas intact, so finance can flex the assumptions."
        actions={[
          { label: 'Download cashflow (.xlsx)', run: () => buildCashflowWorkbook(state).then((b) => { downloadBlob(b, 'Solar House — 13-week cashflow.xlsx'); act.generateArtifact('Cashflow forecast — 13 week', 'model', 'xlsx') }) },
          { label: 'Generate P&L (.xlsx)', run: () => buildPnlWorkbook(state).then((b) => { downloadBlob(b, 'Solar House — P&L.xlsx'); act.generateArtifact('P&L — this quarter', 'report', 'xlsx') }) },
        ]} />
      <Section title="13-week cashflow" meta="Opening → closing, chained weekly">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead><tr className="text-muted-2 text-left border-b border-divider">
              <th className="px-4 py-2 font-semibold">Week</th><th className="px-3 py-2 font-semibold text-right">Starting</th><th className="px-3 py-2 font-semibold text-right">In</th><th className="px-3 py-2 font-semibold text-right">Out</th><th className="px-3 py-2 font-semibold text-right">Net</th><th className="px-4 py-2 font-semibold text-right">Closing</th>
            </tr></thead>
            <tbody>{weeks.map((r) => (
              <tr key={r.w} className="border-b border-divider last:border-0">
                <td className="px-4 py-1.5 font-medium text-ink-3">Wk {r.w}</td>
                <td className="px-3 py-1.5 text-right text-muted-b">{money(r.start)}</td>
                <td className="px-3 py-1.5 text-right text-positive">{money(r.inflow)}</td>
                <td className="px-3 py-1.5 text-right text-negative">{money(r.out)}</td>
                <td className={classNames('px-3 py-1.5 text-right font-medium', r.net >= 0 ? 'text-positive' : 'text-negative')}>{money(r.net)}</td>
                <td className={classNames('px-4 py-1.5 text-right font-bold', r.close < 0 ? 'text-negative' : 'text-ink-2')}>{money(r.close)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Section>
    </DeptPage>
  )
}

export function FinanceReports() {
  const state = useState_()
  const act = useActions()
  return (
    <DeptPage title="Finance" crumb="Reports">
      <AiStrip role="Finance" blurb="Every board pack and financial model, generated on demand from live data and kept here. Real .xlsx and .pptx files."
        actions={[
          { label: 'Cashflow forecast (.xlsx)', run: () => buildCashflowWorkbook(state).then((b) => { downloadBlob(b, 'Solar House — 13-week cashflow.xlsx'); act.generateArtifact('Cashflow forecast — 13 week', 'model', 'xlsx') }) },
          { label: 'P&L this quarter (.xlsx)', run: () => buildPnlWorkbook(state).then((b) => { downloadBlob(b, 'Solar House — P&L.xlsx'); act.generateArtifact('P&L — this quarter', 'report', 'xlsx') }) },
          { label: 'Board pack (.pptx)', run: () => act.generateArtifact('Board pack — Q3 finance', 'deck', 'pptx') },
        ]} />
      <Section title="Generated reports" meta="Board packs, models & statements"><DocList kinds={['model', 'report', 'deck']} empty="No reports yet — generate one above." /></Section>
    </DeptPage>
  )
}

/* ========================= OPERATIONS ========================= */
export function OpsSchedule() {
  const nav = useNavigate()
  const { jobs, engineers } = useState_()
  const scheduled = jobs.filter((j) => j.date && j.status !== 'cancelled').sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const byDay = scheduled.reduce<Record<string, typeof scheduled>>((acc, j) => { (acc[j.date!] ||= []).push(j); return acc }, {})
  return (
    <DeptPage title="Operations" crumb="Schedule" kpis={<>
      <Kpi label="Booked jobs" value={String(scheduled.length)} variant="blue" />
      <Kpi label="Unscheduled" value={String(jobs.filter((j) => !j.date).length)} deltaTone="negative" />
      <Kpi label="Crew" value={String(engineers.length)} />
      <Kpi label="Days covered" value={String(Object.keys(byDay).length)} />
    </>} actions={<Button onClick={() => nav('/jobs')}>Open board</Button>}>
      {Object.entries(byDay).map(([day, list]) => (
        <Section key={day} title={new Date(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })} meta={`${list.length} job${list.length > 1 ? 's' : ''}`}>
          {list.map((j) => {
            const crew = j.crew.map((id) => engineers.find((e) => e.id === id)).filter(Boolean)
            return <Row key={j.id} icon={<Wrench size={16} />} title={`${j.title} · ${j.customer}`} sub={`${j.ref} · ${j.address}`}
              right={<span className="flex items-center gap-2"><span className="flex -space-x-1.5">{crew.map((e) => <span key={e!.id} title={e!.name} className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center border-2 border-surface" style={{ background: e!.color }}>{e!.initials}</span>)}</span><span className="text-[12px] font-semibold text-ink-3">{j.start}</span></span>} />
          })}
        </Section>
      ))}
    </DeptPage>
  )
}

export function OpsStock() {
  const { stock } = useState_()
  const act = useActions()
  const low = stock.filter((s) => s.qty <= s.reorderAt)
  const value = stock.reduce((a, s) => a + s.qty * s.unitCost, 0)
  return (
    <DeptPage title="Operations" crumb="Stock" kpis={<>
      <Kpi label="Stock value" value={money(value, { compact: true })} variant="blue" />
      <Kpi label="SKUs" value={String(stock.length)} />
      <Kpi label="Below reorder" value={String(low.length)} deltaTone={low.length ? 'negative' : 'positive'} />
      <Kpi label="Suppliers" value={String(new Set(stock.map((s) => s.supplier)).size)} />
    </>} actions={low.length ? <Button variant="primary" icon={<Sparkle size={16} />} onClick={() => act.toast(`${low.length} purchase orders drafted`)}>Raise all POs</Button> : undefined}>
      <Section title="Materials & equipment" meta={`${low.length} below reorder point`}>
        {stock.map((s) => {
          const lowIt = s.qty <= s.reorderAt
          return <Row key={s.id} icon={<Box size={16} />} title={s.name} sub={`${s.sku} · ${s.supplier} · ${money(s.unitCost)}/unit`}
            right={<span className="flex items-center gap-3"><span className="w-28"><Progress value={(s.qty / (s.reorderAt * 1.6)) * 100} color={lowIt ? '#E8721A' : '#0E9F6E'} height={6} /><div className="text-[11px] text-muted-2 mt-1">{s.qty} in stock · reorder {s.reorderAt}</div></span>{lowIt ? <button onClick={() => act.toast(`PO drafted — ${s.name} × ${s.reorderAt * 2 - s.qty}`)} className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-border-blue bg-accent-wash text-accent">Raise PO</button> : <StatusChip tone="positive">OK</StatusChip>}</span>} />
        })}
      </Section>
    </DeptPage>
  )
}

export function OpsPurchaseOrders() {
  const { projects, stock } = useState_()
  const act = useActions()
  const orders = projects.flatMap((p) => (p.orders ?? []).map((o) => ({ ...o, customer: p.customer })))
  const low = stock.filter((s) => s.qty <= s.reorderAt)
  const poTone = (s: string): ChipTone => (s === 'delivered' ? 'positive' : s === 'ordered' ? 'accent' : 'neutral')
  return (
    <DeptPage title="Operations" crumb="Purchase orders" kpis={<>
      <Kpi label="Open POs" value={String(orders.filter((o) => o.status !== 'delivered').length)} variant="blue" />
      <Kpi label="Suggested (low stock)" value={String(low.length)} deltaTone={low.length ? 'negative' : 'positive'} />
      <Kpi label="Total POs" value={String(orders.length)} />
      <Kpi label="Suppliers" value={String(new Set([...orders.map((o) => o.supplier), ...stock.map((s) => s.supplier)]).size)} />
    </>}>
      {low.length > 0 && (
        <Section title="Suggested purchase orders" meta="From items below reorder point" action={<Button variant="ghost" onClick={() => act.toast(`${low.length} POs drafted`)}>Draft all</Button>}>
          {low.map((s) => <Row key={s.id} icon={<Sparkle size={16} />} title={`${s.name} × ${s.reorderAt * 2 - s.qty}`} sub={`${s.supplier} · est. ${money((s.reorderAt * 2 - s.qty) * s.unitCost)}`} right={<button onClick={() => act.toast(`PO drafted — ${s.name}`)} className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-border-blue bg-accent-wash text-accent">Raise</button>} />)}
        </Section>
      )}
      <Section title="Purchase orders" meta={`${orders.length} on record`}>
        {orders.length === 0 ? <Empty>No POs yet — raise one from Stock or the suggestions above.</Empty> : orders.map((o) => (
          <Row key={o.id} icon={<File size={16} />} title={`${o.supplier}`} sub={`${o.items.length} line item${o.items.length > 1 ? 's' : ''} · ${o.customer}`} right={<StatusChip tone={poTone(o.status)}>{o.status}</StatusChip>} />
        ))}
      </Section>
    </DeptPage>
  )
}

export function OpsSafety() {
  const { policies } = useState_()
  const act = useActions()
  const hs = policies.filter((p) => p.category === 'Health & Safety')
  return (
    <DeptPage title="Operations" crumb="Safety & RAMS" kpis={<>
      <Kpi label="H&S policies" value={String(hs.length)} variant="blue" />
      <Kpi label="Due review" value={String(hs.filter((p) => p.status === 'review-due').length)} deltaTone={hs.some((p) => p.status === 'review-due') ? 'negative' : 'positive'} />
      <Kpi label="RAMS templates" value="4" />
      <Kpi label="Incidents (90d)" value="0" deltaTone="positive" />
    </>}>
      <AiStrip role="Safety" blurb="Generate a method statement & risk assessment for any job type in seconds, and keep the safety policies current."
        actions={[
          { label: 'Generate RAMS — solar install', run: () => act.generateArtifact('RAMS — solar install', 'handover', 'pdf') },
          { label: 'Generate RAMS — working at height', run: () => act.generateArtifact('RAMS — working at height', 'handover', 'pdf') },
        ]} />
      <Section title="Health & safety policies" meta={`${hs.length} policies`}>
        {hs.map((p) => (
          <Row key={p.id} icon={<Check size={16} />} title={p.title} sub={`Owner ${p.owner} · updated ${fmtDate(new Date(p.updatedAt).toISOString())}`}
            right={p.status === 'review-due' ? <button onClick={() => { act.updatePolicy(p.id, { status: 'current', updatedAt: Date.now() }); act.generateArtifact(`${p.title} — updated`, 'policy', 'pdf') }} className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-border-blue bg-accent-wash text-accent">Refresh</button> : <StatusChip tone="positive">Current</StatusChip>} />
        ))}
      </Section>
    </DeptPage>
  )
}

/* ========================= HR ========================= */
export function HrPeople() {
  const { employees } = useState_()
  const depts = [...new Set(employees.map((e) => e.dept))]
  return (
    <DeptPage title="HR & People" crumb="Directory" kpis={<>
      <Kpi label="Headcount" value={String(employees.length)} variant="blue" />
      <Kpi label="Departments" value={String(depts.length)} />
      <Kpi label="On probation" value={String(employees.filter((e) => e.status === 'probation').length)} />
      <Kpi label="Active" value={String(employees.filter((e) => e.status === 'active').length)} deltaTone="positive" />
    </>}>
      {depts.map((d) => (
        <Section key={d} title={<span className="capitalize">{d}</span>} meta={`${employees.filter((e) => e.dept === d).length} people`}>
          {employees.filter((e) => e.dept === d).map((e) => (
            <Row key={e.id} icon={<span className="w-9 h-9 rounded-full text-white text-[12px] font-bold flex items-center justify-center" style={{ background: e.color }}>{initials(e.name)}</span>}
              title={e.name} sub={`${e.role} · started ${fmtDate(e.startDate)}`}
              right={<StatusChip tone={e.status === 'active' ? 'positive' : e.status === 'probation' ? 'warning' : 'neutral'}>{e.status}</StatusChip>} />
          ))}
        </Section>
      ))}
    </DeptPage>
  )
}

export function HrLeave() {
  const { leaveRequests, employees } = useState_()
  const act = useActions()
  const emp = (id: string) => employees.find((e) => e.id === id)
  const pending = leaveRequests.filter((l) => l.status === 'pending')
  const leaveTone = (s: string): ChipTone => (s === 'approved' ? 'positive' : s === 'declined' ? 'negative' : 'warning')
  return (
    <DeptPage title="HR & People" crumb="Leave" kpis={<>
      <Kpi label="Pending" value={String(pending.length)} variant="blue" deltaTone={pending.length ? 'negative' : 'positive'} />
      <Kpi label="Approved (period)" value={String(leaveRequests.filter((l) => l.status === 'approved').length)} deltaTone="positive" />
      <Kpi label="On leave today" value="0" />
      <Kpi label="Requests" value={String(leaveRequests.length)} />
    </>}>
      <Section title="Leave requests" meta={`${pending.length} pending`}>
        {leaveRequests.map((l) => {
          const e = emp(l.employeeId)
          return <Row key={l.id} icon={e ? <span className="w-9 h-9 rounded-full text-white text-[12px] font-bold flex items-center justify-center" style={{ background: e.color }}>{initials(e.name)}</span> : undefined}
            title={<span>{e?.name} · <span className="capitalize font-normal text-muted-b">{l.type}</span></span>} sub={`${fmtDate(l.from)}–${fmtDate(l.to)} · ${l.days} day${l.days > 1 ? 's' : ''}${l.note ? ` · ${l.note}` : ''}`}
            right={l.status === 'pending' ? <span className="flex gap-1.5"><button onClick={() => act.setLeaveStatus(l.id, 'approved', e?.name)} className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-positive-border bg-positive-wash text-positive">Approve</button><button onClick={() => act.setLeaveStatus(l.id, 'declined', e?.name)} className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-border text-muted-b hover:bg-control">Decline</button></span> : <StatusChip tone={leaveTone(l.status)}>{l.status}</StatusChip>} />
        })}
      </Section>
    </DeptPage>
  )
}

export function HrPolicies() {
  const { policies } = useState_()
  const act = useActions()
  const review = policies.filter((p) => p.status === 'review-due')
  return (
    <DeptPage title="HR & People" crumb="Policies" kpis={<>
      <Kpi label="Policies" value={String(policies.length)} variant="blue" />
      <Kpi label="Due review" value={String(review.length)} deltaTone={review.length ? 'negative' : 'positive'} />
      <Kpi label="Categories" value={String(new Set(policies.map((p) => p.category)).size)} />
      <Kpi label="Current" value={String(policies.filter((p) => p.status === 'current').length)} deltaTone="positive" />
    </>}>
      <AiStrip role="HR" blurb="Draft any policy on demand and keep the handbook current — I flag what UK employment law changes affect and rewrite it."
        actions={[
          { label: 'Draft remote-working policy', run: () => act.generateArtifact('Remote & hybrid working policy', 'policy', 'docx') },
          { label: 'Draft a new policy', run: () => act.generateArtifact('New policy — draft', 'policy', 'docx') },
        ]} />
      <Section title="Policy library" meta={`${review.length} due review`}>
        {policies.map((p) => (
          <Row key={p.id} icon={<File size={16} />} title={p.title} sub={`${p.category} · ${p.owner} · updated ${fmtDate(new Date(p.updatedAt).toISOString())}`}
            right={p.status === 'review-due' ? <button onClick={() => { act.updatePolicy(p.id, { status: 'current', updatedAt: Date.now() }); act.generateArtifact(`${p.title} — updated`, 'policy', 'pdf') }} className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-border-blue bg-accent-wash text-accent">Refresh</button> : <StatusChip tone="positive">Current</StatusChip>} />
        ))}
      </Section>
    </DeptPage>
  )
}

export function HrCompliance() {
  const { certifications, employees } = useState_()
  const act = useActions()
  const emp = (id: string) => employees.find((e) => e.id === id)
  const sorted = [...certifications].sort((a, b) => daysUntil(a.expires) - daysUntil(b.expires))
  const expiring = sorted.filter((c) => daysUntil(c.expires) < 60)
  return (
    <DeptPage title="HR & People" crumb="Certifications" kpis={<>
      <Kpi label="Certificates" value={String(certifications.length)} variant="blue" />
      <Kpi label="Expiring <60d" value={String(expiring.length)} deltaTone={expiring.length ? 'negative' : 'positive'} />
      <Kpi label="Expired" value={String(sorted.filter((c) => daysUntil(c.expires) < 0).length)} deltaTone="negative" />
      <Kpi label="People covered" value={String(new Set(certifications.map((c) => c.employeeId)).size)} />
    </>} actions={expiring.length ? <Button variant="primary" icon={<Sparkle size={16} />} onClick={() => { expiring.forEach((c) => act.addActivity({ type: 'task', subject: `Renew ${c.name} — ${emp(c.employeeId)?.name}`, due: 'This week', priority: 'High', who: 'Ovi', source: 'ai' })); act.toast(`${expiring.length} renewal tasks created`) }}>Chase all</Button> : undefined}>
      <Section title="Certification tracker" meta="Trade & safety compliance, soonest expiry first">
        {sorted.map((c) => {
          const d = daysUntil(c.expires)
          const tone: ChipTone = d < 0 ? 'negative' : d < 30 ? 'negative' : d < 60 ? 'warning' : 'positive'
          return <Row key={c.id} icon={<Star size={16} />} title={c.name} sub={`${emp(c.employeeId)?.name} · expires ${fmtDate(c.expires)}`} right={<StatusChip tone={tone}>{d < 0 ? 'Expired' : `${d}d left`}</StatusChip>} />
        })}
      </Section>
    </DeptPage>
  )
}

/* ========================= MARKETING ========================= */
export function MktReviews() {
  const { reviews } = useState_()
  const act = useActions()
  const avg = reviews.length ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1) : '—'
  const unanswered = reviews.filter((r) => !r.responded)
  return (
    <DeptPage title="Marketing" crumb="Reviews" kpis={<>
      <Kpi label="Avg rating" value={`${avg}★`} variant="blue" />
      <Kpi label="To answer" value={String(unanswered.length)} deltaTone={unanswered.length ? 'negative' : 'positive'} />
      <Kpi label="Total" value={String(reviews.length)} />
      <Kpi label="5-star" value={String(reviews.filter((r) => r.rating === 5).length)} deltaTone="positive" />
    </>} actions={unanswered.length ? <Button variant="primary" icon={<Sparkle size={16} />} onClick={() => { unanswered.forEach((r) => act.respondReview(r.id)); act.toast(`${unanswered.length} responses drafted & posted`) }}>Answer all with AI</Button> : undefined}>
      <Section title="Reviews & reputation" meta={`${avg}★ across ${reviews.length}`}>
        {reviews.map((r) => (
          <div key={r.id} className="flex items-start gap-3 px-4 py-3 border-b border-divider last:border-0">
            <span className="w-9 h-9 rounded-full bg-accent-wash text-accent text-[12px] font-bold flex items-center justify-center shrink-0">{initials(r.author)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold text-ink-2">{r.author}</span><span className="text-[12px] text-warning">{'★'.repeat(r.rating)}<span className="text-input-border">{'★'.repeat(5 - r.rating)}</span></span><span className="text-[11.5px] text-muted-3">{r.source} · {fmtDate(r.date)}</span></div>
              <p className="text-[13px] text-ink-3 mt-1 leading-snug">{r.text}</p>
            </div>
            {r.responded ? <StatusChip tone="positive">Replied</StatusChip> : <button onClick={() => act.respondReview(r.id)} className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-border-blue bg-accent-wash text-accent shrink-0">Respond</button>}
          </div>
        ))}
      </Section>
    </DeptPage>
  )
}

export function MktCampaigns() {
  const nav = useNavigate()
  const { reachCampaigns, emailCampaigns } = useState_()
  return (
    <DeptPage title="Marketing" crumb="Campaigns" kpis={<>
      <Kpi label="Running" value={String(reachCampaigns.filter((c) => c.status === 'running').length)} variant="blue" />
      <Kpi label="Replies" value={String(reachCampaigns.reduce((a, c) => a + c.replies, 0))} />
      <Kpi label="Meetings" value={String(reachCampaigns.reduce((a, c) => a + c.meetings, 0))} deltaTone="positive" />
      <Kpi label="Email campaigns" value={String(emailCampaigns.length)} />
    </>} actions={<Button onClick={() => nav('/reach/campaigns')}>Open in Reach</Button>}>
      <Section title="Multichannel campaigns" meta={`${reachCampaigns.length} total`}>
        {reachCampaigns.length === 0 ? <Empty>No campaigns yet.</Empty> : reachCampaigns.map((c) => (
          <Row key={c.id} icon={<Megaphone size={16} />} title={c.name} sub={`${c.sent} sent · ${c.replies} replies · ${c.meetings} meetings`} right={<StatusChip tone={c.status === 'running' ? 'accent' : 'neutral'}>{c.status}</StatusChip>} />
        ))}
      </Section>
      <Section title="Email campaigns" meta={`${emailCampaigns.length} total`}>
        {emailCampaigns.length === 0 ? <Empty>No email campaigns yet.</Empty> : emailCampaigns.map((c) => (
          <Row key={c.id} icon={<Envelope size={16} />} title={c.name} sub={`${c.sent} sent · ${c.opens} opens · ${c.clicks} clicks`} right={<StatusChip tone={c.status === 'Live' || c.status === 'Sending' ? 'accent' : 'neutral'}>{c.status}</StatusChip>} />
        ))}
      </Section>
    </DeptPage>
  )
}

export function MktContent() {
  const { socialPosts } = useState_()
  const act = useActions()
  return (
    <DeptPage title="Marketing" crumb="Content" kpis={<>
      <Kpi label="Scheduled" value={String(socialPosts.filter((p) => p.status === 'scheduled').length)} variant="blue" />
      <Kpi label="Posted" value={String(socialPosts.filter((p) => p.status === 'posted').length)} deltaTone="positive" />
      <Kpi label="Drafts" value={String(socialPosts.filter((p) => p.status === 'draft').length)} />
      <Kpi label="Total" value={String(socialPosts.length)} />
    </>}>
      <AiStrip role="Marketing" blurb="Turn a won job into a week of content, or a case study, in one click — on-brand and ready to schedule."
        actions={[
          { label: 'Plan a week of posts', run: () => { act.schedulePost(['LinkedIn', 'Instagram'], 'New solar install complete in Manchester ☀️ — another home cutting its bills.', 'Tomorrow 09:00'); act.toast('A week of posts drafted & scheduled') } },
          { label: 'Generate case study', run: () => act.generateArtifact('Case study — recent install', 'case-study', 'pdf') },
        ]} />
      <Section title="Content calendar" meta={`${socialPosts.length} items`}>
        {socialPosts.length === 0 ? <Empty>Nothing scheduled — ask the AI to plan a week.</Empty> : socialPosts.map((p) => (
          <Row key={p.id} icon={<Clock size={16} />} title={p.body} sub={`${p.channels.join(', ')} · ${p.when}`} right={<StatusChip tone={p.status === 'posted' ? 'positive' : p.status === 'scheduled' ? 'accent' : 'neutral'}>{p.status}</StatusChip>} />
        ))}
      </Section>
    </DeptPage>
  )
}

export function MktReports() {
  const act = useActions()
  return (
    <DeptPage title="Marketing" crumb="Reports">
      <AiStrip role="Marketing" blurb="Monthly performance and case studies, generated from live campaign and review data."
        actions={[
          { label: 'Monthly marketing report', run: () => act.generateArtifact('Marketing report — this month', 'report', 'pdf') },
          { label: 'Generate case study', run: () => act.generateArtifact('Case study — Cirrus Hosting', 'case-study', 'pdf') },
        ]} />
      <Section title="Generated marketing assets" meta="Reports & case studies"><DocList kinds={['report', 'case-study', 'onepager']} empty="No assets yet — generate one above." /></Section>
    </DeptPage>
  )
}

/* ========================= DELIVERY ========================= */
export function DelInstalls() {
  const nav = useNavigate()
  const { projects } = useState_()
  const active = projects.filter((p) => p.milestoneIndex < p.milestones.length - 1)
  return (
    <DeptPage title="Delivery" crumb="Installs" kpis={<>
      <Kpi label="Active installs" value={String(active.length)} variant="blue" />
      <Kpi label="Total projects" value={String(projects.length)} />
      <Kpi label="Awaiting PTO" value={String(active.length)} />
      <Kpi label="Value in delivery" value={money(active.reduce((a, p) => a + p.value, 0), { compact: true })} />
    </>} actions={<Button onClick={() => nav('/studio/delivery')}>Full board</Button>}>
      <Section title="Active installs" meta={`${active.length} in delivery`}>
        {active.length === 0 ? <Empty>No active installs — won solar deals appear here.</Empty> : active.map((p) => {
          const pct = Math.round((p.milestoneIndex / (p.milestones.length - 1)) * 100)
          return <button key={p.id} onClick={() => nav(`/studio/delivery/${p.id}`)} className="w-full text-left flex items-center gap-3 px-4 py-3 border-b border-divider last:border-0 hover:bg-control transition-colors">
            <span className="w-9 h-9 rounded-lg bg-[#FDF1E7] text-[#C2410C] flex items-center justify-center shrink-0"><Box size={16} /></span>
            <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate">{p.customer} · {p.address}</div><div className="mt-1.5 flex items-center gap-2"><Progress value={pct} color="#0E7490" height={6} /><span className="text-[11px] text-muted-2 shrink-0">{p.milestones[p.milestoneIndex]?.label}</span></div></div>
            <div className="text-[13px] font-bold text-ink-2 shrink-0">{money(p.value, { compact: true })}</div>
          </button>
        })}
      </Section>
    </DeptPage>
  )
}

export function DelField() {
  const nav = useNavigate()
  const { jobs, engineers } = useState_()
  const field = jobs.filter((j) => (j.kind === 'install' || j.kind === 'survey') && j.status !== 'cancelled')
  return (
    <DeptPage title="Delivery" crumb="Field jobs" kpis={<>
      <Kpi label="Installs & surveys" value={String(field.length)} variant="blue" />
      <Kpi label="Scheduled" value={String(field.filter((j) => j.date).length)} />
      <Kpi label="Unscheduled" value={String(field.filter((j) => !j.date).length)} deltaTone="negative" />
      <Kpi label="Crew" value={String(engineers.length)} />
    </>} actions={<Button onClick={() => nav('/jobs')}>Scheduler</Button>}>
      <Section title="Field jobs" meta={`${field.length} install & survey jobs`}>
        {field.map((j) => (
          <Row key={j.id} icon={<Wrench size={16} />} title={<span className="capitalize">{j.kind} · {j.customer}</span>} sub={`${j.ref} · ${j.address}`}
            right={<span className="text-[12px] font-semibold text-ink-3">{j.date ? fmtDate(j.date) : 'Unscheduled'} {j.start || ''}</span>} />
        ))}
      </Section>
    </DeptPage>
  )
}

export function DelCertificates() {
  const act = useActions()
  return (
    <DeptPage title="Delivery" crumb="Certificates">
      <AiStrip role="Delivery" blurb="Generate the compliance paperwork the field team hates — MCS, DNO and handover packs — from the job record."
        actions={[
          { label: 'Generate MCS + DNO certificates', run: () => act.generateArtifact('MCS + DNO certificates', 'certificate', 'pdf') },
          { label: 'Generate handover pack', run: () => act.generateArtifact('Handover pack — install', 'handover', 'pdf') },
        ]} />
      <Section title="Generated certificates & packs" meta="Compliance documents"><DocList kinds={['certificate', 'handover']} empty="No certificates yet — generate one above." /></Section>
    </DeptPage>
  )
}

export function DelService() {
  const { jobs } = useState_()
  const service = jobs.filter((j) => j.kind === 'service' || j.kind === 'remedial')
  return (
    <DeptPage title="Delivery" crumb="Service" kpis={<>
      <Kpi label="Service jobs" value={String(service.length)} variant="blue" />
      <Kpi label="Remedials" value={String(jobs.filter((j) => j.kind === 'remedial').length)} deltaTone={jobs.some((j) => j.kind === 'remedial') ? 'negative' : 'positive'} />
      <Kpi label="Scheduled" value={String(service.filter((j) => j.date).length)} />
      <Kpi label="Under warranty" value="—" />
    </>}>
      <Section title="Service & maintenance" meta={`${service.length} jobs`}>
        {service.length === 0 ? <Empty>No service jobs booked.</Empty> : service.map((j) => (
          <Row key={j.id} icon={<Flow size={16} />} title={<span className="capitalize">{j.kind} · {j.customer}</span>} sub={`${j.ref} · ${j.address}`}
            right={<StatusChip tone={j.kind === 'remedial' ? 'warning' : 'accent'}>{j.status}</StatusChip>} />
        ))}
      </Section>
    </DeptPage>
  )
}
