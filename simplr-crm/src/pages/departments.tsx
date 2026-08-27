import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Kpi, Chip, Button, Progress, Avatar, type ChipTone } from '../components/ui'
import { Sparkle, Check, Dollar, Users, Wrench, Megaphone, Box, File, Star, Clock, ArrowUpRight, Link as LinkIcon } from '../components/icons'
import { classNames, money, initials } from '../lib/format'
import { useState_, useActions } from '../store/store'

/* ============================================================= *
 *  Shared department scaffold — every function gets the same
 *  shape: KPIs, an AI operator strip, what it owns vs connects,
 *  and its live work. Build what we own, connect the rest, and
 *  let one AI operate across all of it.
 * ============================================================= */

type DeptAction = { label: string; primary?: boolean; run: () => void }

function AiAction({ a }: { a: DeptAction }) {
  const [s, setS] = useState<'idle' | 'run' | 'done'>('idle')
  function go() {
    if (s !== 'idle') return
    setS('run')
    setTimeout(() => { a.run(); setS('done') }, 750 + Math.random() * 500)
  }
  return (
    <button
      onClick={go}
      className={classNames(
        'h-9 px-3.5 rounded-lg text-[12.5px] font-medium border transition-colors flex items-center gap-1.5',
        s === 'done' ? 'bg-positive-wash border-positive-border text-positive'
          : a.primary ? 'bg-accent-wash border-border-blue text-accent hover:bg-[#E4ECFB]'
            : 'bg-surface border-border text-ink-3 hover:bg-control',
      )}
    >
      {s === 'run' ? <span className="w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin inline-block" />
        : s === 'done' ? <Check size={13} />
          : a.primary ? <Sparkle size={13} /> : null}
      {s === 'run' ? 'Working…' : s === 'done' ? 'Done' : a.label}
    </button>
  )
}

function AiStrip({ role, blurb, actions }: { role: string; blurb: string; actions: DeptAction[] }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="w-8 h-8 rounded-xl bg-accent-gradient text-white flex items-center justify-center shadow-primary"><Sparkle size={17} /></span>
        <div className="flex-1"><div className="text-[14px] font-bold text-ink flex items-center gap-2">Simplr AI · {role} <Chip tone="positive" dot>Operator</Chip></div></div>
      </div>
      <p className="text-[13px] text-muted-b mb-3 leading-relaxed">{blurb}</p>
      <div className="flex flex-wrap gap-2">{actions.map((a, i) => <AiAction key={i} a={{ ...a, primary: a.primary ?? i === 0 }} />)}</div>
    </div>
  )
}

function OwnsConnects({ owns, connects }: { owns: string; connects: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-muted-2 px-1">
      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent" /> <span className="font-semibold text-ink-3">Owned here:</span> {owns}</span>
      <span className="flex items-center gap-1.5"><LinkIcon size={13} className="text-muted-3" /> <span className="font-semibold text-ink-3">Connects to:</span>
        {connects.map((c) => <span key={c} className="text-muted-b bg-control rounded px-1.5 py-0.5">{c}</span>)}
      </span>
    </div>
  )
}

function Section({ title, meta, action, children }: { title: string; meta?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-card overflow-hidden">
      <div className="px-4 py-3 border-b border-divider flex items-center gap-2">
        <div className="text-[13.5px] font-bold text-ink">{title}</div>
        {meta && <div className="text-[12px] text-muted-2">{meta}</div>}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function DeptShell({ title, crumb, kpis, owns, connects, ai, children, topAction }: {
  title: string; crumb: string; kpis: ReactNode; owns: string; connects: string[]; ai: ReactNode; children: ReactNode; topAction?: ReactNode
}) {
  return (
    <>
      <TopBar title={title} crumbs={[crumb]} actions={topAction} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1120px] mx-auto px-7 py-6 flex flex-col gap-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{kpis}</div>
          <OwnsConnects owns={owns} connects={connects} />
          {ai}
          {children}
        </div>
      </div>
    </>
  )
}

/* small helpers */
const daysUntil = (iso: string) => Math.round((Date.parse(iso) - Date.now()) / 86_400_000)
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
function StatusChip({ children, tone }: { children: ReactNode; tone: ChipTone }) { return <Chip tone={tone}>{children}</Chip> }

/* ============================== OPERATIONS ============================== */
export function Operations() {
  const nav = useNavigate()
  const { jobs, engineers, stock } = useState_()
  const act = useActions()
  const scheduled = jobs.filter((j) => j.status === 'scheduled' || j.status === 'in-progress')
  const backlog = jobs.filter((j) => j.status === 'unscheduled')
  const lowStock = stock.filter((s) => s.qty <= s.reorderAt)

  return (
    <DeptShell
      title="Operations"
      crumb="Scheduling, crew & stock"
      topAction={<Button icon={<ArrowUpRight size={16} />} onClick={() => nav('/jobs')}>Open scheduler</Button>}
      owns="Dispatch · crew capacity · stock · job costing · RAMS"
      connects={['Google Calendar', 'What3Words', 'Supplier catalogues']}
      kpis={<>
        <Kpi label="Jobs this week" value={String(scheduled.length)} variant="blue" />
        <Kpi label="Unscheduled backlog" value={String(backlog.length)} delta={backlog.length ? 'Needs booking' : 'All booked'} deltaTone={backlog.length ? 'negative' : 'positive'} />
        <Kpi label="Crew on shift" value={String(engineers.length)} />
        <Kpi label="Low-stock items" value={String(lowStock.length)} delta={lowStock.length ? 'Reorder due' : 'Healthy'} deltaTone={lowStock.length ? 'negative' : 'positive'} />
      </>}
      ai={<AiStrip role="Operations" blurb="I watch the schedule, crew capacity and stock. I can optimise the week, generate the safety paperwork per job, and raise purchase orders before you run out."
        actions={[
          { label: 'Optimise this week’s schedule', run: () => act.toast('Schedule optimised — 2 jobs re-sequenced, 1 crew rebalanced', 'accent') },
          { label: 'Generate RAMS pack', run: () => act.generateArtifact('RAMS — solar install', 'handover', 'pdf') },
          { label: 'Daily ops brief', run: () => act.generateArtifact('Daily operations brief', 'report', 'pdf') },
          { label: 'Raise POs for low stock', run: () => act.toast(`${lowStock.length} purchase orders drafted for supplier review`) },
        ]} />}
    >
      <Section title="This week’s schedule" meta={`${scheduled.length} booked · ${backlog.length} unscheduled`} action={<Button variant="ghost" onClick={() => nav('/jobs')}>View board</Button>}>
        {scheduled.slice(0, 6).map((j) => {
          const crew = j.crew.map((id) => engineers.find((e) => e.id === id)).filter(Boolean)
          return (
            <div key={j.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-divider last:border-0">
              <span className="w-9 h-9 rounded-lg bg-accent-wash text-accent flex items-center justify-center shrink-0"><Wrench size={16} /></span>
              <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate">{j.title} · {j.customer}</div><div className="text-[12px] text-muted-2 truncate">{j.ref} · {j.address}</div></div>
              <div className="flex -space-x-1.5 mr-2">{crew.map((e) => <span key={e!.id} title={e!.name} className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center border-2 border-surface" style={{ background: e!.color }}>{e!.initials}</span>)}</div>
              <div className="text-right shrink-0"><div className="text-[12px] font-semibold text-ink-3">{j.date ? fmtDate(j.date) : '—'} {j.start}</div><StatusChip tone={j.status === 'in-progress' ? 'warning' : 'accent'}>{j.status}</StatusChip></div>
            </div>
          )
        })}
      </Section>

      <Section title="Stock & materials" meta={`${lowStock.length} below reorder point`}>
        {stock.map((s) => {
          const low = s.qty <= s.reorderAt
          return (
            <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-divider last:border-0">
              <span className="w-9 h-9 rounded-lg bg-control text-muted-b flex items-center justify-center shrink-0"><Box size={16} /></span>
              <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate">{s.name}</div><div className="text-[12px] text-muted-2">{s.sku} · {s.supplier}</div></div>
              <div className="w-28 shrink-0"><Progress value={(s.qty / (s.reorderAt * 1.6)) * 100} color={low ? '#E8721A' : '#0E9F6E'} height={6} /><div className="text-[11px] text-muted-2 mt-1">{s.qty} in stock · reorder at {s.reorderAt}</div></div>
              {low ? <button onClick={() => act.toast(`PO drafted — ${s.name} × ${s.reorderAt * 2 - s.qty} to ${s.supplier}`)} className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-border-blue bg-accent-wash text-accent shrink-0">Raise PO</button> : <StatusChip tone="positive">OK</StatusChip>}
            </div>
          )
        })}
      </Section>
    </DeptShell>
  )
}

/* ============================== FINANCE ============================== */
export function Finance() {
  const nav = useNavigate()
  const { deals, projects, expenses } = useState_()
  const act = useActions()
  const open = deals.filter((d) => !d.won && !d.lost)
  const openVal = open.reduce((s, d) => s + d.value, 0)
  const wonVal = deals.filter((d) => d.won).reduce((s, d) => s + d.value, 0)
  const invoices = projects.flatMap((p) => (p.invoices ?? []).map((i) => ({ ...i, projectId: p.id, customer: p.customer, address: p.address })))
  const outstanding = invoices.filter((i) => i.status !== 'paid').reduce((s, i) => s + i.amount, 0)
  const overdue = invoices.filter((i) => i.status === 'overdue')
  const pendingExp = expenses.filter((e) => e.status === 'pending')

  return (
    <DeptShell
      title="Finance"
      crumb="Cashflow, invoicing & forecasting"
      topAction={<Button icon={<ArrowUpRight size={16} />} onClick={() => nav('/documents')}>Open documents</Button>}
      owns="Quotes → invoices · cashflow · forecasts · expenses · board packs"
      connects={['Xero', 'HMRC (MTD VAT)', 'Stripe', 'GoCardless']}
      kpis={<>
        <Kpi label="Open pipeline" value={money(openVal, { compact: true })} variant="blue" />
        <Kpi label="Won revenue" value={money(wonVal, { compact: true })} deltaTone="positive" />
        <Kpi label="Outstanding (AR)" value={money(outstanding, { compact: true })} />
        <Kpi label="Overdue" value={money(overdue.reduce((s, i) => s + i.amount, 0), { compact: true })} delta={overdue.length ? `${overdue.length} invoice${overdue.length > 1 ? 's' : ''}` : 'None'} deltaTone={overdue.length ? 'negative' : 'positive'} />
      </>}
      ai={<AiStrip role="Finance" blurb="Ask me for numbers and I’ll build the file — a live cashflow forecast or P&L as a real spreadsheet, a board deck from your pipeline, or I’ll chase every overdue invoice. Just like Claude in Excel, but wired to your live data."
        actions={[
          { label: 'Build cashflow forecast (.xlsx)', run: () => act.generateArtifact('Cashflow forecast — 13 week', 'model', 'xlsx') },
          { label: 'Generate board pack (.pptx)', run: () => act.generateArtifact('Board pack — Q3 finance', 'deck', 'pptx') },
          { label: 'P&L this quarter (.xlsx)', run: () => act.generateArtifact('P&L — this quarter', 'report', 'xlsx') },
          { label: 'Chase overdue invoices', run: () => { overdue.forEach((i) => act.addActivity({ type: 'email', subject: `Chase overdue invoice ${i.number} — ${i.customer}`, due: 'Today', priority: 'High', who: 'Simplr AI', source: 'ai' })); act.toast(`${overdue.length || 'No'} chase emails drafted`) } },
        ]} />}
    >
      <Section title="Invoices" meta={`${money(outstanding, { compact: true })} outstanding`} action={<Button variant="ghost" onClick={() => nav('/documents')}>All documents</Button>}>
        {invoices.length === 0 && <div className="px-4 py-6 text-[13px] text-muted-2 text-center">No invoices yet — they appear here as installs progress.</div>}
        {invoices.slice(0, 7).map((i) => {
          const tone: ChipTone = i.status === 'paid' ? 'positive' : i.status === 'overdue' ? 'negative' : i.status === 'sent' ? 'accent' : 'neutral'
          return (
            <div key={i.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-divider last:border-0">
              <span className="w-9 h-9 rounded-lg bg-control text-muted-b flex items-center justify-center shrink-0"><File size={16} /></span>
              <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate">{i.number} · {i.customer}</div><div className="text-[12px] text-muted-2 truncate capitalize">{i.kind} · {i.address}</div></div>
              <div className="text-[13px] font-bold text-ink-2 mr-2">{money(i.amount)}</div>
              <StatusChip tone={tone}>{i.status}</StatusChip>
              {i.status !== 'paid' && <button onClick={() => act.setInvoiceStatus(i.projectId, i.id, 'paid')} className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-positive-border bg-positive-wash text-positive shrink-0">Mark paid</button>}
            </div>
          )
        })}
      </Section>

      <Section title="Expenses" meta={`${pendingExp.length} awaiting approval`}>
        {expenses.map((e) => {
          const tone: ChipTone = e.status === 'reimbursed' ? 'positive' : e.status === 'approved' ? 'accent' : 'warning'
          return (
            <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-divider last:border-0">
              <span className="w-9 h-9 rounded-lg bg-control text-muted-b flex items-center justify-center shrink-0"><Dollar size={16} /></span>
              <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate">{e.vendor} · {e.category}</div><div className="text-[12px] text-muted-2">{e.who} · {fmtDate(e.date)}</div></div>
              <div className="text-[13px] font-bold text-ink-2 mr-2">{money(e.amount)}</div>
              <StatusChip tone={tone}>{e.status}</StatusChip>
              {e.status === 'pending' && <button onClick={() => act.setExpenseStatus(e.id, 'approved')} className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-border-blue bg-accent-wash text-accent shrink-0">Approve</button>}
            </div>
          )
        })}
      </Section>
    </DeptShell>
  )
}

/* ============================== HR / PEOPLE ============================== */
export function HR() {
  const nav = useNavigate()
  const { employees, leaveRequests, policies, certifications } = useState_()
  const act = useActions()
  const emp = (id: string) => employees.find((e) => e.id === id)
  const pending = leaveRequests.filter((l) => l.status === 'pending')
  const expiringCerts = certifications.filter((c) => daysUntil(c.expires) < 60).sort((a, b) => daysUntil(a.expires) - daysUntil(b.expires))
  const reviewPolicies = policies.filter((p) => p.status === 'review-due')

  return (
    <DeptShell
      title="HR & People"
      crumb="Team, leave, policies & compliance"
      topAction={<Button icon={<ArrowUpRight size={16} />} onClick={() => nav('/team')}>Team directory</Button>}
      owns="Records · leave · onboarding · policies · certification tracking"
      connects={['Payroll (Staffology)', 'Pension (NEST)', 'DBS checks']}
      kpis={<>
        <Kpi label="Headcount" value={String(employees.length)} variant="blue" />
        <Kpi label="Requests to action" value={String(pending.length)} delta={pending.length ? 'Awaiting you' : 'Clear'} deltaTone={pending.length ? 'negative' : 'positive'} />
        <Kpi label="Certs expiring <60d" value={String(expiringCerts.length)} delta={expiringCerts.length ? 'Renew soon' : 'All valid'} deltaTone={expiringCerts.length ? 'negative' : 'positive'} />
        <Kpi label="Policies to review" value={String(reviewPolicies.length)} />
      </>}
      ai={<AiStrip role="HR" blurb="I keep the people admin off your plate — draft contracts, letters and policies, keep the handbook current with the law, build onboarding checklists, and flag every certificate before it lapses."
        actions={[
          { label: 'Draft a policy', run: () => act.generateArtifact('Remote & hybrid working policy', 'policy', 'docx') },
          { label: 'Generate employment contract', run: () => act.generateArtifact('Employment contract — installer', 'contract', 'docx') },
          { label: 'Build onboarding checklist', run: () => { ['Send contract & handbook', 'Set up payroll & pension', 'Order PPE & tools', 'Book induction + H&S', 'Assign buddy'].forEach((t) => act.addActivity({ type: 'task', subject: `Onboarding — ${t}`, due: 'This week', priority: 'Medium', who: 'Simplr AI', source: 'ai' })); act.toast('Onboarding checklist added to tasks') } },
          { label: 'Chase expiring certs', run: () => { expiringCerts.forEach((c) => act.addActivity({ type: 'task', subject: `Renew ${c.name} — ${emp(c.employeeId)?.name}`, due: 'This week', priority: 'High', who: 'Simplr AI', source: 'ai' })); act.toast(`${expiringCerts.length} renewal tasks created`) } },
        ]} />}
    >
      <Section title="Leave requests" meta={`${pending.length} pending`}>
        {leaveRequests.slice(0, 6).map((l) => {
          const e = emp(l.employeeId)
          const tone: ChipTone = l.status === 'approved' ? 'positive' : l.status === 'declined' ? 'negative' : 'warning'
          return (
            <div key={l.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-divider last:border-0">
              {e && <span className="w-8 h-8 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0" style={{ background: e.color }}>{initials(e.name)}</span>}
              <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate">{e?.name} · <span className="capitalize font-normal text-muted-b">{l.type}</span></div><div className="text-[12px] text-muted-2">{fmtDate(l.from)}–{fmtDate(l.to)} · {l.days} day{l.days > 1 ? 's' : ''}{l.note ? ` · ${l.note}` : ''}</div></div>
              {l.status === 'pending' ? (
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => act.setLeaveStatus(l.id, 'approved', e?.name)} className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-positive-border bg-positive-wash text-positive">Approve</button>
                  <button onClick={() => act.setLeaveStatus(l.id, 'declined', e?.name)} className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-border text-muted-b hover:bg-control">Decline</button>
                </div>
              ) : <StatusChip tone={tone}>{l.status}</StatusChip>}
            </div>
          )
        })}
      </Section>

      <div className="grid md:grid-cols-2 gap-5">
        <Section title="Certifications" meta="Trade & safety compliance">
          {certifications.sort((a, b) => daysUntil(a.expires) - daysUntil(b.expires)).slice(0, 6).map((c) => {
            const d = daysUntil(c.expires)
            const tone: ChipTone = d < 0 ? 'negative' : d < 30 ? 'negative' : d < 60 ? 'warning' : 'positive'
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-divider last:border-0">
                <span className="w-8 h-8 rounded-lg bg-control text-muted-b flex items-center justify-center shrink-0"><Star size={15} /></span>
                <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate">{c.name}</div><div className="text-[12px] text-muted-2 truncate">{emp(c.employeeId)?.name}</div></div>
                <StatusChip tone={tone}>{d < 0 ? 'Expired' : `${d}d`}</StatusChip>
              </div>
            )
          })}
        </Section>

        <Section title="Policies" meta={`${reviewPolicies.length} due review`}>
          {policies.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-divider last:border-0">
              <span className="w-8 h-8 rounded-lg bg-control text-muted-b flex items-center justify-center shrink-0"><File size={15} /></span>
              <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate">{p.title}</div><div className="text-[12px] text-muted-2">{p.category} · {p.owner}</div></div>
              {p.status === 'review-due'
                ? <button onClick={() => { act.updatePolicy(p.id, { status: 'current', updatedAt: Date.now() }); act.generateArtifact(`${p.title} — updated`, 'policy', 'pdf') }} className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-border-blue bg-accent-wash text-accent shrink-0">Refresh</button>
                : <StatusChip tone="positive">Current</StatusChip>}
            </div>
          ))}
        </Section>
      </div>
    </DeptShell>
  )
}

/* ============================== MARKETING ============================== */
export function Marketing() {
  const nav = useNavigate()
  const { reviews, reachCampaigns, socialPosts, leads } = useState_()
  const act = useActions()
  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '—'
  const unanswered = reviews.filter((r) => !r.responded)
  const liveCamps = reachCampaigns.filter((c) => c.status === 'running')

  return (
    <DeptShell
      title="Marketing"
      crumb="Reputation, content & campaigns"
      topAction={<Button icon={<ArrowUpRight size={16} />} onClick={() => nav('/reach/campaigns')}>Open campaigns</Button>}
      owns="Reviews · content calendar · case studies · referrals"
      connects={['Google Business', 'Meta', 'Mailchimp', 'Checkatrade']}
      kpis={<>
        <Kpi label="Avg rating" value={`${avg}★`} variant="blue" delta={`${reviews.length} reviews`} deltaTone="muted" />
        <Kpi label="Reviews to answer" value={String(unanswered.length)} delta={unanswered.length ? 'Respond' : 'All answered'} deltaTone={unanswered.length ? 'negative' : 'positive'} />
        <Kpi label="Campaigns live" value={String(liveCamps.length)} />
        <Kpi label="Leads (all time)" value={String(leads.length)} deltaTone="positive" />
      </>}
      ai={<AiStrip role="Marketing" blurb="I turn your wins into marketing — a case study and social posts from a closed job, on-brand review responses, the monthly report, and campaign ideas drawn from where your pipeline is thin."
        actions={[
          { label: 'Turn a won deal into a case study', run: () => act.generateArtifact('Case study — Cirrus Hosting', 'case-study', 'pdf') },
          { label: 'Draft review responses', run: () => { unanswered.forEach((r) => act.respondReview(r.id)); act.toast(`${unanswered.length} responses drafted & posted`) } },
          { label: 'Monthly marketing report', run: () => act.generateArtifact('Marketing report — this month', 'report', 'pdf') },
          { label: 'Plan next campaign', run: () => nav('/reach/campaigns') },
        ]} />}
    >
      <Section title="Reviews & reputation" meta={`${avg}★ across ${reviews.length}`} action={<Button variant="ghost" onClick={() => act.toast('Opening Google Business — connected', 'accent')}>Sources</Button>}>
        {reviews.map((r) => (
          <div key={r.id} className="flex items-start gap-3 px-4 py-3 border-b border-divider last:border-0">
            <span className="w-9 h-9 rounded-full bg-accent-wash text-accent text-[12px] font-bold flex items-center justify-center shrink-0">{initials(r.author)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="text-[13px] font-semibold text-ink-2">{r.author}</span><span className="text-[12px] text-warning">{'★'.repeat(r.rating)}<span className="text-input-border">{'★'.repeat(5 - r.rating)}</span></span><span className="text-[11.5px] text-muted-3">{r.source} · {fmtDate(r.date)}</span></div>
              <p className="text-[13px] text-ink-3 mt-1 leading-snug">{r.text}</p>
            </div>
            {r.responded ? <StatusChip tone="positive">Replied</StatusChip> : <button onClick={() => act.respondReview(r.id)} className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-border-blue bg-accent-wash text-accent shrink-0">Respond</button>}
          </div>
        ))}
      </Section>

      <div className="grid md:grid-cols-2 gap-5">
        <Section title="Campaigns" meta={`${liveCamps.length} running`}>
          {reachCampaigns.slice(0, 5).map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-divider last:border-0">
              <span className="w-8 h-8 rounded-lg bg-control text-muted-b flex items-center justify-center shrink-0"><Megaphone size={15} /></span>
              <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate">{c.name}</div><div className="text-[12px] text-muted-2">{c.sent} sent · {c.replies} replies · {c.meetings} meetings</div></div>
              <StatusChip tone={c.status === 'running' ? 'accent' : 'neutral'}>{c.status}</StatusChip>
            </div>
          ))}
          {reachCampaigns.length === 0 && <div className="px-4 py-6 text-[13px] text-muted-2 text-center">No campaigns yet.</div>}
        </Section>

        <Section title="Content calendar" meta={`${socialPosts.length} scheduled`}>
          {socialPosts.slice(0, 5).map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-divider last:border-0">
              <span className="w-8 h-8 rounded-lg bg-control text-muted-b flex items-center justify-center shrink-0"><Clock size={15} /></span>
              <div className="min-w-0 flex-1"><div className="text-[13px] text-ink-2 truncate">{p.body}</div><div className="text-[12px] text-muted-2">{p.channels.join(', ')} · {p.when}</div></div>
              <StatusChip tone={p.status === 'posted' ? 'positive' : 'accent'}>{p.status}</StatusChip>
            </div>
          ))}
          {socialPosts.length === 0 && <div className="px-4 py-6 text-[13px] text-muted-2 text-center">Nothing scheduled — ask the AI to plan a week.</div>}
        </Section>
      </div>
    </DeptShell>
  )
}

/* ============================== DELIVERY / FIELD ============================== */
export function DeliveryDept() {
  const nav = useNavigate()
  const { projects, jobs } = useState_()
  const act = useActions()
  const active = projects.filter((p) => p.milestoneIndex < p.milestones.length - 1)
  const awaitingPto = active
  const fieldJobs = jobs.filter((j) => (j.kind === 'install' || j.kind === 'survey' || j.kind === 'service') && j.status === 'scheduled')

  return (
    <DeptShell
      title="Delivery"
      crumb="Field installs, handover & service"
      topAction={<Button icon={<ArrowUpRight size={16} />} onClick={() => nav('/studio/delivery')}>Delivery board</Button>}
      owns="Site work · checklists · certificates · handover · service"
      connects={['MCS', 'DNO portals', 'Building Control']}
      kpis={<>
        <Kpi label="Active installs" value={String(active.length)} variant="blue" />
        <Kpi label="Field jobs (scheduled)" value={String(fieldJobs.length)} />
        <Kpi label="Awaiting PTO" value={String(awaitingPto.length)} />
        <Kpi label="Handover packs due" value={String(active.filter((p) => p.milestoneIndex >= p.milestones.length - 2).length)} deltaTone="muted" />
      </>}
      ai={<AiStrip role="Delivery" blurb="I do the paperwork the field team hates — generate handover packs and MCS/DNO certificates, summarise site notes back to the office, and trigger the final invoice the moment a job hits PTO."
        actions={[
          { label: 'Generate handover pack', run: () => act.generateArtifact('Handover pack — install', 'handover', 'pdf') },
          { label: 'Create MCS + DNO certificates', run: () => act.generateArtifact('MCS + DNO certificates', 'certificate', 'pdf') },
          { label: 'Summarise site notes', run: () => act.toast('Site notes summarised & posted to the office channel', 'accent') },
          { label: 'Auto-invoice on PTO', run: () => act.toast('Final invoice will trigger automatically at PTO for active jobs') },
        ]} />}
    >
      <Section title="Active installs" meta={`${active.length} in delivery`} action={<Button variant="ghost" onClick={() => nav('/studio/delivery')}>Full board</Button>}>
        {active.slice(0, 6).map((p) => {
          const pct = Math.round((p.milestoneIndex / (p.milestones.length - 1)) * 100)
          return (
            <button key={p.id} onClick={() => nav(`/studio/delivery/${p.id}`)} className="w-full text-left flex items-center gap-3 px-4 py-3 border-b border-divider last:border-0 hover:bg-control transition-colors">
              <span className="w-9 h-9 rounded-lg bg-[#FDF1E7] text-[#C2410C] flex items-center justify-center shrink-0"><Box size={16} /></span>
              <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate">{p.customer} · {p.address}</div><div className="mt-1.5 flex items-center gap-2"><Progress value={pct} color="#E8721A" height={6} /><span className="text-[11px] text-muted-2 shrink-0">{p.milestones[p.milestoneIndex]?.label}</span></div></div>
              <div className="text-[13px] font-bold text-ink-2 shrink-0">{money(p.value, { compact: true })}</div>
            </button>
          )
        })}
        {active.length === 0 && <div className="px-4 py-6 text-[13px] text-muted-2 text-center">No active installs — won solar deals appear here for delivery.</div>}
      </Section>

      <Section title="Field jobs this week" meta={`${fieldJobs.length} scheduled`} action={<Button variant="ghost" onClick={() => nav('/jobs')}>Scheduler</Button>}>
        {fieldJobs.slice(0, 6).map((j) => (
          <div key={j.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-divider last:border-0">
            <span className="w-9 h-9 rounded-lg bg-accent-wash text-accent flex items-center justify-center shrink-0"><Wrench size={16} /></span>
            <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate capitalize">{j.kind} · {j.customer}</div><div className="text-[12px] text-muted-2 truncate">{j.ref} · {j.address}</div></div>
            <div className="text-[12px] font-semibold text-ink-3 shrink-0">{j.date ? fmtDate(j.date) : '—'} {j.start}</div>
          </div>
        ))}
        {fieldJobs.length === 0 && <div className="px-4 py-6 text-[13px] text-muted-2 text-center">No field jobs scheduled.</div>}
      </Section>
    </DeptShell>
  )
}
