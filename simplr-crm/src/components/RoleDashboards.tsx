import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Kpi, Chip, type ChipTone } from './ui'
import { Check, ArrowUpRight, Wrench, Megaphone, Dollar } from './icons'
import { useState_, useSelectors, useActions } from '../store/store'
import { money, classNames } from '../lib/format'
import { jobKindMeta } from '../lib/trades'
import type { UserRole, ProjectInvoice } from '../store/types'

// ---- shared building blocks ----
function Card({ title, action, children, className }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={classNames('bg-surface border border-border rounded-card p-5', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-3.5">
          {title && <div className="text-[15px] font-semibold text-ink">{title}</div>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

function Bars({ data, height = 150 }: { data: { m: string; v: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.v))
  return (
    <div className="flex items-end gap-3 pt-4" style={{ height }}>
      {data.map((d, i) => (
        <div key={d.m} className="flex-1 flex flex-col items-center gap-1.5">
          <div className="text-[10.5px] font-semibold text-ink-3 tabular-nums">{money(d.v, { compact: true })}</div>
          <div className="w-full rounded-t" style={{ height: `${(d.v / max) * (height - 40)}px`, background: i === data.length - 1 ? '#8FB0FF' : '#1D4ED8', minHeight: 3 }} />
          <div className="text-[11px] text-muted-2b">{d.m}</div>
        </div>
      ))}
    </div>
  )
}

function SourceBar({ label, count, total, color = '#1D4ED8' }: { label: string; count: number; total: number; color?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[12.5px] text-ink-3 w-32 truncate shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-control overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(count / Math.max(1, total)) * 100}%`, background: color }} /></div>
      <span className="text-[12px] font-semibold text-ink-2 w-8 text-right tabular-nums">{count}</span>
    </div>
  )
}

const invTone: Record<ProjectInvoice['status'], ChipTone> = { paid: 'positive', sent: 'accent', draft: 'neutral', overdue: 'negative' }

// ---- current-week helpers ----
const isoOf = (d: Date) => d.toISOString().slice(0, 10)
function weekIsoSet(): string[] {
  const t = new Date(); const dow = t.getDay(); const mon = new Date(t); mon.setDate(t.getDate() + (dow === 0 ? -6 : 1 - dow))
  return Array.from({ length: 6 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return isoOf(d) })
}

const monthly = (base: number) => ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'].map((m, i) => ({ m, v: Math.round(base * (0.6 + 0.12 * i + (i % 2 ? 0.08 : 0))) }))

// ======================================================================
export function RoleDashboard({ role }: { role: UserRole }) {
  if (role === 'finance') return <FinanceDash />
  if (role === 'operations') return <OperationsDash />
  if (role === 'marketing') return <MarketingDash />
  if (role === 'engineer') return <EngineerDash />
  if (role === 'owner') return <OwnerDash />
  return <SalesDash />
}

// ---------------------------------------------------------------- Finance
function FinanceDash() {
  const { deals, projects, studioConfig } = useState_()
  const invoices = projects.flatMap((p) => (p.invoices ?? []).map((i) => ({ ...i, customer: p.customer })))
  const collected = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
  const outstanding = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0)
  const overdue = invoices.filter((i) => i.status === 'overdue')
  const revenue = deals.filter((d) => d.won).reduce((s, d) => s + d.value, 0)
  const open = invoices.filter((i) => i.status !== 'paid' && i.status !== 'draft').sort((a, b) => (a.status === 'overdue' ? -1 : 1))
  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        <Kpi variant="deep" label="Revenue (won)" value={money(revenue, { compact: true })} delta="This year" />
        <Kpi variant="blue" label="Cash collected" value={money(collected, { compact: true })} delta={`${invoices.filter((i) => i.status === 'paid').length} invoices paid`} deltaTone="muted" />
        <Kpi label="Outstanding" value={money(outstanding, { compact: true })} delta={`${overdue.length} overdue`} deltaTone={overdue.length ? 'negative' : 'muted'} />
        <Kpi label="Gross margin" value={`${studioConfig.marginPct}%`} delta="Default on new quotes" deltaTone="muted" />
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <Card title="Revenue — last 6 months"><Bars data={monthly(revenue / 6)} /></Card>
        <Card title="Cash position">
          <div className="flex flex-col gap-3">
            <Row2 label="Collected" value={money(collected)} tone="#0E7C66" />
            <Row2 label="Outstanding" value={money(outstanding)} />
            <Row2 label="Overdue" value={money(overdue.reduce((s, i) => s + i.amount, 0))} tone="#B01B4F" />
            <div className="border-t border-divider pt-2.5"><Row2 label="Deposits held" value={money(invoices.filter((i) => i.kind === 'deposit' && i.status === 'paid').reduce((s, i) => s + i.amount, 0))} bold /></div>
          </div>
        </Card>
      </div>
      <Card title="Invoices outstanding" action={<span className="text-[12px] text-muted-2">{open.length} open</span>}>
        <div className="flex flex-col divide-y divide-divider">
          {open.map((i) => (
            <div key={i.id} className="flex items-center gap-3 py-2.5">
              <span className="font-mono text-[11px] text-muted-3 w-24 shrink-0">{i.number}</span>
              <span className="text-[13px] font-semibold text-ink-2 flex-1 truncate">{i.customer}</span>
              <span className="text-[12px] text-muted-2 capitalize w-16">{i.kind}</span>
              <span className="text-[12px] text-muted-2 w-24">Due {i.dueDate ?? '—'}</span>
              <span className="text-[13px] font-bold text-ink-2 w-24 text-right tabular-nums">{money(i.amount)}</span>
              <Chip tone={invTone[i.status]} dot>{i.status}</Chip>
            </div>
          ))}
          {open.length === 0 && <div className="text-[13px] text-muted-2 py-3">No outstanding invoices 🎉</div>}
        </div>
      </Card>
    </>
  )
}
function Row2({ label, value, tone, bold }: { label: string; value: string; tone?: string; bold?: boolean }) {
  return <div className="flex items-center justify-between"><span className={classNames('text-[13px]', bold ? 'font-semibold text-ink' : 'text-muted-b')}>{label}</span><span className={classNames('text-[13.5px] tabular-nums', bold ? 'font-bold text-ink' : 'font-semibold')} style={{ color: tone }}>{value}</span></div>
}

// ------------------------------------------------------------- Operations
function OperationsDash() {
  const nav = useNavigate()
  const { jobs, engineers, projects } = useState_()
  const week = weekIsoSet()
  const inWeek = jobs.filter((j) => j.date && week.includes(j.date))
  const today = isoOf(new Date())
  const todays = jobs.filter((j) => j.date === today).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))
  const backlog = jobs.filter((j) => j.status === 'unscheduled' || j.crew.length === 0)
  const installs = inWeek.filter((j) => j.kind === 'install').length
  const util = Math.round((inWeek.length / Math.max(1, engineers.length * 6)) * 100)
  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        <Kpi variant="blue" label="Jobs this week" value={String(inWeek.length)} delta={`${engineers.length} engineers`} deltaTone="muted" />
        <Kpi variant="deep" label="Installs booked" value={String(installs)} delta="This week" />
        <Kpi label="Unscheduled" value={String(backlog.length)} delta={backlog.length ? 'Needs slotting' : 'All booked'} deltaTone={backlog.length ? 'negative' : 'muted'} />
        <Kpi label="Team utilisation" value={`${util}%`} delta="of weekly capacity" deltaTone="muted" />
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Card title="Today’s schedule" action={<button onClick={() => nav('/jobs')} className="text-[13px] text-accent font-semibold">Open board</button>}>
          <div className="flex flex-col gap-2">
            {todays.map((j) => {
              const m = jobKindMeta[j.kind]
              return (
                <button key={j.id} onClick={() => nav('/jobs')} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-left hover:border-accent transition-colors">
                  <span className="text-[11px] font-semibold tabular-nums w-12" style={{ color: m.color }}>{j.start}</span>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
                  <span className="text-[13px] font-semibold text-ink-2 flex-1 truncate">{j.title} · {j.customer}</span>
                  <span className="text-[11px] text-muted-2">{j.crew.map((c) => engineers.find((e) => e.id === c)?.initials).join(', ')}</span>
                </button>
              )
            })}
            {todays.length === 0 && <div className="text-[13px] text-muted-2 py-2">Nothing booked today.</div>}
          </div>
        </Card>
        <Card title="Installations in delivery" action={<button onClick={() => nav('/studio/delivery')} className="text-[13px] text-accent font-semibold">View all</button>}>
          <div className="flex flex-col gap-3">
            {projects.slice(0, 4).map((p) => {
              const pct = Math.round((p.milestoneIndex / Math.max(1, p.milestones.length - 1)) * 100)
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between text-[12.5px] mb-1"><span className="font-semibold text-ink-2 truncate">{p.customer}</span><span className="text-muted-2">{p.milestones[p.milestoneIndex]?.label ?? '—'}</span></div>
                  <div className="h-1.5 rounded-full bg-control overflow-hidden"><div className="h-full rounded-full bg-accent-gradient" style={{ width: `${pct}%` }} /></div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
      {backlog.length > 0 && (
        <Card title="Unscheduled backlog" action={<button onClick={() => nav('/jobs')} className="text-[13px] text-accent font-semibold">Schedule</button>}>
          <div className="flex flex-wrap gap-2">
            {backlog.map((j) => (
              <span key={j.id} className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-[12.5px]"><span className="w-2 h-2 rounded-full" style={{ background: jobKindMeta[j.kind].color }} /><span className="font-semibold text-ink-2">{j.title}</span><span className="text-muted-2">· {j.customer}</span></span>
            ))}
          </div>
        </Card>
      )}
    </>
  )
}

// ---------------------------------------------------------------- Marketing
function MarketingDash() {
  const nav = useNavigate()
  const { leads, emailCampaigns, reachCampaigns } = useState_()
  const open = leads.filter((l) => !l.archived)
  const sources = [...new Set(open.map((l) => l.source))].map((s) => ({ label: s, count: open.filter((l) => l.source === s).length })).sort((a, b) => b.count - a.count)
  const meetings = reachCampaigns.reduce((s, c) => s + c.meetings, 0)
  const replies = reachCampaigns.reduce((s, c) => s + c.replies, 0)
  const sent = reachCampaigns.reduce((s, c) => s + c.sent, 0)
  const live = emailCampaigns.filter((c) => c.status === 'Live' || c.status === 'Sending').length
  const palette = ['#7C5CFF', '#1D4ED8', '#0E9F6E', '#E8721A', '#B01B4F', '#2FA4B5']
  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        <Kpi variant="deep" label="Open leads" value={String(open.length)} delta={`${sources.length} sources`} />
        <Kpi variant="blue" label="Live campaigns" value={String(live)} delta={`${emailCampaigns.length} total`} deltaTone="muted" />
        <Kpi label="Reply rate" value={`${Math.round((replies / Math.max(1, sent)) * 100)}%`} delta={`${replies} replies`} />
        <Kpi label="Meetings booked" value={String(meetings)} delta="From outreach" />
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1.3fr' }}>
        <Card title="Leads by source" action={<button onClick={() => nav('/leads')} className="text-[13px] text-accent font-semibold">All leads</button>}>
          <div className="flex flex-col gap-2.5">
            {sources.map((s, i) => (<SourceBar key={s.label} label={s.label} count={s.count} total={open.length} color={palette[i % palette.length]} />))}
            {sources.length === 0 && <div className="text-[13px] text-muted-2">No leads yet.</div>}
          </div>
        </Card>
        <Card title="Campaign performance" action={<button onClick={() => nav('/campaigns')} className="text-[13px] text-accent font-semibold">Campaigns</button>}>
          <div className="flex flex-col divide-y divide-divider">
            {emailCampaigns.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-2.5">
                <span className="text-[13px] font-semibold text-ink-2 flex-1 truncate">{c.name}</span>
                <span className="text-[12px] text-muted-2 w-20 text-right">{c.sent} sent</span>
                <span className="text-[12px] text-muted-2 w-20 text-right">{c.opens}% open</span>
                <Chip tone={c.status === 'Live' || c.status === 'Sending' ? 'positive' : c.status === 'Draft' ? 'neutral' : 'accent'} dot>{c.status}</Chip>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- Engineer
function EngineerDash() {
  const nav = useNavigate()
  const { jobs, engineers } = useState_()
  const [engId, setEngId] = useState(engineers[0]?.id ?? '')
  const eng = engineers.find((e) => e.id === engId) ?? engineers[0]
  const week = weekIsoSet()
  const mine = jobs.filter((j) => j.crew.includes(eng?.id ?? '') && j.date && week.includes(j.date))
  const today = isoOf(new Date())
  const todays = mine.filter((j) => j.date === today).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))
  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12px] text-muted-2">Viewing schedule for</span>
        {engineers.map((e) => (
          <button key={e.id} onClick={() => setEngId(e.id)} className={classNames('flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors', e.id === engId ? 'border-accent bg-accent-wash-2 text-accent-700' : 'border-border text-ink-3 hover:bg-control')}>
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ background: e.color }}>{e.initials}</span>{e.name.split(' ')[0]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-4">
        <Kpi variant="blue" label="Jobs today" value={String(todays.length)} delta={eng?.name.split(' ')[0]} deltaTone="muted" />
        <Kpi variant="deep" label="Jobs this week" value={String(mine.length)} delta="Assigned to you" />
        <Kpi label="Installs" value={String(mine.filter((j) => j.kind === 'install').length)} delta="This week" deltaTone="muted" />
        <Kpi label="Surveys" value={String(mine.filter((j) => j.kind === 'survey' || j.kind === 'showroom').length)} delta="This week" deltaTone="muted" />
      </div>
      <Card title="Your week" action={<button onClick={() => nav('/jobs')} className="text-[13px] text-accent font-semibold">Open board</button>}>
        <div className="flex flex-col gap-2">
          {mine.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.start ?? '').localeCompare(b.start ?? '')).map((j) => {
            const m = jobKindMeta[j.kind]
            return (
              <div key={j.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: m.bg, borderLeft: `3px solid ${m.color}` }}>
                <span className="text-[11px] font-semibold w-24 shrink-0" style={{ color: m.color }}>{j.date?.slice(8)}/{j.date?.slice(5, 7)} · {j.start}</span>
                <span className="text-[13px] font-semibold text-ink-2 flex-1 truncate">{j.title} · {j.customer}</span>
                <span className="text-[11.5px] text-muted-2 truncate max-w-[220px]">{j.address}</span>
              </div>
            )
          })}
          {mine.length === 0 && <div className="text-[13px] text-muted-2 py-2">No jobs booked this week.</div>}
        </div>
      </Card>
    </>
  )
}

// ---------------------------------------------------------------- Sales
function SalesDash() {
  const nav = useNavigate()
  const { deals } = useState_()
  const sel = useSelectors()
  const act = useActions()
  const open = deals.filter((d) => !d.won && !d.lost)
  const openValue = open.reduce((s, d) => s + d.value, 0)
  const wonValue = deals.filter((d) => d.won).reduce((s, d) => s + d.value, 0)
  const tasks = sel.openTasks().slice(0, 5)
  const closing = open.slice(0, 5)
  const healthTone: Record<string, ChipTone> = { Healthy: 'positive', 'At risk': 'warning', Stalled: 'negative', 'No next step': 'warning' }
  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        <Kpi variant="blue" label="Open pipeline" value={money(openValue, { compact: true })} delta={`${open.length} deals`} deltaTone="muted" />
        <Kpi label="Closed won" value={money(wonValue, { compact: true })} delta={`${deals.filter((d) => d.won).length} deals`} />
        <Kpi label="Win rate" value="31%" delta="−2.1 pts" deltaTone="negative" />
        <Kpi variant="deep" label="Open tasks" value={String(sel.openTaskCount())} delta="Across your deals" />
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <Card title="Pipeline by value"><Bars data={monthly(openValue / 5)} /></Card>
        <Card title="Today" action={<span className="text-[12px] text-accent font-semibold">{tasks.length} open</span>}>
          <div className="flex flex-col gap-1">
            {tasks.map((t) => (
              <button key={t.id} onClick={() => act.toggleActivity(t.id)} className="flex items-start gap-3 py-1.5 text-left">
                <span className="mt-0.5 w-[18px] h-[18px] rounded-[5px] border shrink-0 flex items-center justify-center" style={{ borderColor: t.done ? '#1D4ED8' : '#C3CBD8', background: t.done ? '#1D4ED8' : 'transparent' }}>{t.done && <Check size={12} className="text-white" strokeWidth={2.4} />}</span>
                <span className="min-w-0"><span className={classNames('block text-[13px] font-medium', t.done ? 'text-muted-3 line-through' : 'text-ink-2')}>{t.subject}</span><span className="block text-[12px] text-muted-2">{t.due ?? 'No due date'}</span></span>
              </button>
            ))}
            {tasks.length === 0 && <div className="text-[13px] text-muted-2 py-2">All caught up 🎉</div>}
          </div>
        </Card>
      </div>
      <Card title="Deals in your pipeline" action={<button onClick={() => nav('/deals')} className="text-[13px] text-accent font-semibold">View pipeline</button>}>
        <div className="flex flex-col divide-y divide-divider">
          {closing.map((d) => (
            <button key={d.id} onClick={() => nav(`/deals/${d.id}`)} className="flex items-center gap-3 py-2.5 text-left">
              <span className="text-[13px] font-semibold text-ink-2 flex-1 truncate">{d.name} <span className="text-muted-2 font-normal">· {d.org}</span></span>
              <span className="text-[13px] font-semibold text-ink-2 w-24 text-right tabular-nums">{money(d.value)}</span>
              <Chip tone="accent">{d.stage}</Chip>
              <Chip tone={healthTone[d.health] ?? 'neutral'} dot>{d.health}</Chip>
            </button>
          ))}
        </div>
      </Card>
    </>
  )
}

// ---------------------------------------------------------------- Owner
function OwnerDash() {
  const nav = useNavigate()
  const { deals, projects, jobs, leads } = useState_()
  const open = deals.filter((d) => !d.won && !d.lost)
  const openValue = open.reduce((s, d) => s + d.value, 0)
  const revenue = deals.filter((d) => d.won).reduce((s, d) => s + d.value, 0)
  const invoices = projects.flatMap((p) => p.invoices ?? [])
  const outstanding = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0)
  const week = weekIsoSet()
  const jobsWeek = jobs.filter((j) => j.date && week.includes(j.date)).length
  const tiles: { label: string; icon: (p: { size?: number; className?: string }) => JSX.Element; to: string; sub: string; accent: string }[] = [
    { label: 'Sales pipeline', icon: ArrowUpRight, to: '/deals', sub: `${open.length} open · ${money(openValue, { compact: true })}`, accent: '#3B6BF5' },
    { label: 'Operations', icon: Wrench, to: '/jobs', sub: `${jobsWeek} jobs this week`, accent: '#E8721A' },
    { label: 'Finance', icon: Dollar, to: '/documents', sub: `${money(outstanding, { compact: true })} outstanding`, accent: '#0E9F6E' },
    { label: 'Marketing', icon: Megaphone, to: '/campaigns', sub: `${leads.filter((l) => !l.archived).length} open leads`, accent: '#7C5CFF' },
  ]
  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        <Kpi variant="deep" label="Revenue (won)" value={money(revenue, { compact: true })} delta="This year" />
        <Kpi variant="blue" label="Open pipeline" value={money(openValue, { compact: true })} delta={`${open.length} deals`} deltaTone="muted" />
        <Kpi label="Jobs this week" value={String(jobsWeek)} delta="Across the team" deltaTone="muted" />
        <Kpi label="Cash outstanding" value={money(outstanding, { compact: true })} delta="Awaiting payment" deltaTone={outstanding ? 'negative' : 'muted'} />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {tiles.map((t) => (
          <button key={t.label} onClick={() => nav(t.to)} className="bg-surface border border-border rounded-card p-4 text-left hover:border-accent hover:shadow-card transition-all">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white mb-2.5" style={{ background: t.accent }}><t.icon size={17} /></span>
            <div className="text-[13.5px] font-bold text-ink">{t.label}</div>
            <div className="text-[12px] text-muted-2 mt-0.5">{t.sub}</div>
          </button>
        ))}
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <Card title="Revenue — last 6 months"><Bars data={monthly(revenue / 6)} /></Card>
        <Card title="Business health">
          <div className="flex flex-col gap-3">
            <Row2 label="Win rate" value="31%" />
            <Row2 label="Avg. deal size" value={money(Math.round(openValue / Math.max(1, open.length)))} />
            <Row2 label="Installs in delivery" value={String(projects.length)} />
            <Row2 label="Team members" value="5" />
          </div>
        </Card>
      </div>
    </>
  )
}
