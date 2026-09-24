import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Button } from '../components/ui'
import { Modal, Field, Input, Select } from '../components/overlays'
import { Plus, Bars, Search, Grid, Check, Phone, ChevronRight, ChevronDown, Clock, Target, Flow, Person } from '../components/icons'
import { useState_, useActions } from '../store/store'
import type { Deal, Showroom } from '../store/types'
import { money, classNames } from '../lib/format'
import { SH_STAGES, SHOWROOM_META, JOURNEY } from '../lib/solarHouseData'
import { stageAge, dueLabel, currentStep, enquiredAt, advancePatch, labelOf, STAGE_GUIDE } from '../lib/journey'

/* Solar House deals — built for ~100 enquiries a month across four showrooms.
 * Board for the overview, Table for sorting/bulk work, Work queue for clearing a busy stage. */

const ME = 'Jordan Miles'
const SHOWROOMS = Object.keys(SHOWROOM_META) as Showroom[]
const DAY = 86_400_000
type View = 'board' | 'table' | 'queue'
type Sort = 'oldest' | 'value' | 'newest' | 'due'
const initials = (n: string) => n.split(/[\s&]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
const town = (d: Deal) => d.org.split(',').slice(-1)[0]?.trim() ?? ''

const LS = 'shc.deals.prefs.v1'
function loadPrefs() { try { return JSON.parse(localStorage.getItem(LS) || '{}') } catch { return {} } }

export function DealsBoard() {
  const nav = useNavigate()
  const { deals } = useState_()
  const act = useActions()
  const p0 = loadPrefs()
  const [view, setView] = useState<View>(p0.view ?? 'board')
  const [showroom, setShowroom] = useState<Showroom | 'all'>(p0.showroom ?? 'all')
  const [q, setQ] = useState('')
  const [owner, setOwner] = useState('All')
  const [attention, setAttention] = useState(false)
  const [sort, setSort] = useState<Sort>('oldest')
  const [queueStage, setQueueStage] = useState<string>(SH_STAGES[0])
  const [showNew, setShowNew] = useState(false)
  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify({ view, showroom })) } catch { /* ignore */ } }, [view, showroom])

  const now = Date.now()
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const shDeals = useMemo(() => deals.filter((d) => d.journey), [deals])
  const owners = useMemo(() => [...new Set(shDeals.map((d) => d.owner))].sort(), [shDeals])

  const needsAttention = (d: Deal) => stageAge(d).tone !== 'ok' || (d.journey?.nextAction ? dueLabel(d.journey.nextAction.due, now).overdue : !d.won)
  const base = shDeals.filter((d) =>
    !d.lost &&
    (showroom === 'all' || d.journey!.showroom === showroom) &&
    (owner === 'All' || d.owner === owner) &&
    (!q || `${d.name} ${d.org} ${d.journey?.postcode} ${d.journey?.phone}`.toLowerCase().includes(q.toLowerCase())) &&
    (!attention || needsAttention(d)))
  // Board/queue show the live pipeline; signed deals only for this month (the rest live in Deliver).
  const live = base.filter((d) => !d.won || (currentStep(d) && (d.journey!.steps.find((s) => s.key === 'signed')?.at ?? 0) >= monthStart))

  const sorter = (a: Deal, b: Deal) =>
    sort === 'value' ? b.value - a.value : sort === 'newest' ? enquiredAt(b) - enquiredAt(a)
      : sort === 'due' ? (a.journey?.nextAction?.due ?? Infinity) - (b.journey?.nextAction?.due ?? Infinity)
        : (currentStep(a)?.at ?? 0) - (currentStep(b)?.at ?? 0)
  const byStage = useMemo(() => {
    const m: Record<string, Deal[]> = {}
    SH_STAGES.forEach((s) => (m[s] = []))
    live.forEach((d) => m[d.stage]?.push(d))
    Object.values(m).forEach((arr) => arr.sort(sorter))
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, showroom, owner, q, attention, sort])

  // headline numbers (respect the showroom filter)
  const inShowroom = shDeals.filter((d) => showroom === 'all' || d.journey!.showroom === showroom)
  const enquiriesMonth = inShowroom.filter((d) => enquiredAt(d) >= monthStart).length
  const signedMonth = inShowroom.filter((d) => (d.journey!.steps.find((s) => s.key === 'signed')?.at ?? 0) >= monthStart)
  const installsMonth = inShowroom.filter((d) => { const s = d.journey!.steps.find((x) => x.key === 'install'); return s?.done && s.done >= monthStart }).length
  const open = live.filter((d) => !d.won)
  const signedAll = inShowroom.filter((d) => d.won)
  const avgDaysToSign = signedAll.length ? Math.round(signedAll.reduce((s, d) => s + ((d.journey!.steps.find((x) => x.key === 'signed')!.at - enquiredAt(d)) / DAY), 0) / signedAll.length) : 0
  const decided = inShowroom.filter((d) => d.won || d.lost)
  const conv = decided.length ? Math.round((decided.filter((d) => d.won).length / decided.length) * 100) : 0

  return (
    <>
      <TopBar title="Deals" crumbs={['Sales']} actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowNew(true)}>New enquiry</Button>} />

      {/* showroom switcher + tools */}
      <div className="sh-toolbar shrink-0 px-7 pt-3 pb-3 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <ShowroomTab on={showroom === 'all'} onClick={() => setShowroom('all')} label="All showrooms" count={shDeals.filter((d) => !d.lost && !d.won).length} />
          {SHOWROOMS.map((s) => (
            <ShowroomTab key={s} on={showroom === s} onClick={() => setShowroom(s)} label={SHOWROOM_META[s].name} color={SHOWROOM_META[s].color}
              count={shDeals.filter((d) => d.journey!.showroom === s && !d.lost && !d.won).length} />
          ))}
          <div className="ml-auto inline-flex bg-[#E9EDF2] border border-[#DDE3EA] rounded-control p-[3px] gap-0.5">
            {([['board', Bars, 'Board'], ['table', Grid, 'Table'], ['queue', Flow, 'Work queue']] as const).map(([id, I, l]) => (
              <button key={id} onClick={() => setView(id)} className={classNames('h-[30px] px-3 rounded-[7px] flex items-center gap-1.5 text-[12.5px] font-semibold transition-colors', view === id ? 'bg-white text-accent font-bold shadow-[0_1px_3px_rgba(11,18,32,0.14)]' : 'text-ink-3 hover:text-ink-3')}><I size={14} />{l}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="h-9 w-[250px] rounded-control border border-border bg-surface flex items-center gap-2 px-3">
            <Search size={15} className="text-muted-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, street, postcode, phone…" className="bg-transparent outline-none flex-1 text-[13px] text-ink-2 placeholder:text-muted-3" />
          </div>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className="h-9 px-3 rounded-control border border-border bg-surface text-[13px] text-ink-3 outline-none focus:border-accent">
            <option value="All">All advisers</option>{owners.map((o) => <option key={o}>{o}</option>)}
          </select>
          <button onClick={() => setOwner((o) => (o === ME ? 'All' : ME))} className={classNames('h-9 px-3 rounded-control border text-[12.5px] font-semibold transition-colors', owner === ME ? 'bg-accent text-white border-accent' : 'border-border text-ink-3 hover:bg-control')}>My deals</button>
          <button onClick={() => setAttention((a) => !a)} className={classNames('h-9 px-3 rounded-control border text-[12.5px] font-semibold flex items-center gap-1.5 transition-colors', attention ? 'bg-[#B01B4F] text-white border-[#B01B4F]' : 'border-border text-ink-3 hover:bg-control')}><Clock size={13} />Needs attention</button>
          {view !== 'table' && (
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-9 px-3 rounded-control border border-border bg-surface text-[13px] text-ink-3 outline-none focus:border-accent">
              <option value="oldest">Longest in stage first</option><option value="due">Next action due first</option><option value="value">Highest value first</option><option value="newest">Newest enquiry first</option>
            </select>
          )}
          <div className="ml-auto flex items-center gap-5 text-[12px] text-muted-b">
            <Stat v={String(enquiriesMonth)} l="enquiries this month" />
            <Stat v={String(signedMonth.length)} l={`signed · ${money(signedMonth.reduce((s, d) => s + d.value, 0), { compact: true })}`} />
            <Stat v={String(installsMonth)} l="installed" />
            <Stat v={`${conv}%`} l="win rate" />
            <Stat v={`${avgDaysToSign}d`} l="enquiry → signed" />
          </div>
        </div>
      </div>

      {view === 'board' && <Board byStage={byStage} onOpen={(d) => nav(`/deals/${d.id}`)} onQueue={(s) => { setQueueStage(s); setView('queue') }} onDrop={(id, s) => {
        // Dragging one stage forward completes the current journey stage properly; anything else is a plain move.
        const d = deals.find((x) => x.id === id)
        const p = d && SH_STAGES.indexOf(s as (typeof SH_STAGES)[number]) === SH_STAGES.indexOf(d.stage as (typeof SH_STAGES)[number]) + 1 ? advancePatch(d, ME) : null
        if (p && p.stage === s) { act.updateDeal(id, p); act.toast(`${d!.name} → ${s}`) } else act.moveStage(id, s)
      }} />}
      {view === 'table' && <TableView deals={base} onOpen={(d) => nav(`/deals/${d.id}`)} />}
      {view === 'queue' && <WorkQueue byStage={byStage} stage={queueStage} setStage={setQueueStage} />}
      {view !== 'queue' && open.length === 0 && live.length === 0 && <div className="p-10 text-center text-[13px] text-muted-2">No deals match.</div>}

      <NewEnquiryModal open={showNew} onClose={() => setShowNew(false)} onCreate={(id) => { setShowNew(false); nav(`/deals/${id}`) }} />
    </>
  )
}

function ShowroomTab({ on, onClick, label, count, color }: { on: boolean; onClick: () => void; label: string; count: number; color?: string }) {
  return (
    <button onClick={onClick} className={classNames('h-9 pl-3 pr-2 rounded-full border flex items-center gap-2 text-[13px] font-semibold transition-colors', on ? 'chip-on' : 'bg-surface border-border text-ink-3 hover:border-input-border')}>
      {color && <span className="w-2 h-2 rounded-full" style={{ background: color }} />}{label}
      <span className={classNames('text-[11px] rounded-full px-1.5 py-px font-bold', on ? 'chip-on-count' : 'bg-control text-muted-b')}>{count}</span>
    </button>
  )
}
function Stat({ v, l }: { v: string; l: string }) { return <span><b className="text-[14px] text-ink font-bold">{v}</b> {l}</span> }

/* ─────────── Board ─────────── */
const COL_CAP = 30
// One distinct colour per stage (validated for colour-blind separation); always shown with the label.
export const STAGE_COLOR: Record<string, string> = {
  'New enquiry': '#0284C7', Contacted: '#7C3AED', Consultation: '#DB2777', 'Proposal sent': '#D97706', Survey: '#0891B2', Signed: '#16A34A',
}
function Board({ byStage, onOpen, onQueue, onDrop }: { byStage: Record<string, Deal[]>; onOpen: (d: Deal) => void; onQueue: (s: string) => void; onDrop: (id: string, s: string) => void }) {
  const [drag, setDrag] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  return (
    <main className="flex-1 min-h-0 overflow-x-auto p-5 pt-3 flex flex-col gap-2.5">
      <div className="flex items-center gap-4 text-[11.5px] text-muted-b shrink-0">
        <span className="font-semibold text-ink-3">Card edge = next action</span>
        {([['#DC2626', 'Overdue'], ['#F59E0B', 'Due today or tomorrow'], ['#34D399', 'On track'], ['#16A34A', 'Signed']] as const).map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><span className="w-[3px] h-3.5 rounded-full" style={{ background: c }} />{l}</span>)}
        <span className="ml-auto">Badge = days in this stage</span>
      </div>
      <div className="grid gap-3 flex-1 min-h-0" style={{ gridTemplateColumns: `repeat(${SH_STAGES.length}, minmax(236px, 1fr))` }}>
        {SH_STAGES.map((stage, i) => {
          const col = byStage[stage] ?? []
          const late = col.filter((d) => stageAge(d).tone === 'late').length
          const shown = expanded[stage] ? col : col.slice(0, COL_CAP)
          const value = col.reduce((s, d) => s + d.value, 0)
          const avgDays = col.length ? Math.round(col.reduce((s, d) => s + stageAge(d).days, 0) / col.length) : 0
          const c = STAGE_COLOR[stage]
          return (
            <div key={stage} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag) onDrop(drag, stage); setDrag(null) }}
              className={classNames('flex flex-col min-h-0 rounded-xl border overflow-hidden', drag ? 'border-dashed border-accent-400' : 'border-[#E1E6EC]')}
              style={{ background: `color-mix(in srgb, ${c} 5%, #F3F5F8)` }}>
              {/* Stage header: its own colour (identity), numbered, so the flow reads left → right */}
              <div className="px-3 pt-0 pb-2.5 bg-white border-b border-[#E6EAF0]">
                <div className="h-[4px] -mx-3 mb-2.5" style={{ background: c }} />
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md text-[10.5px] font-extrabold text-white flex items-center justify-center shrink-0" style={{ background: c }}>{i + 1}</span>
                  <span className="text-[13.5px] font-extrabold text-ink truncate">{stage}</span>
                  <span className="text-[11px] font-bold rounded-full px-1.5 min-w-[22px] text-center" style={{ color: c, background: `color-mix(in srgb, ${c} 12%, white)` }}>{col.length}</span>
                  {col.length > 0 && <button onClick={() => onQueue(stage)} title="Work through this stage one by one" className="ml-auto h-6 px-2 rounded-md bg-white border border-[#CDD5DF] text-[11px] font-bold text-ink-2 hover:border-accent hover:text-accent flex items-center gap-1 shadow-[0_1px_2px_rgba(16,24,40,0.06)]"><Flow size={11} />Work</button>}
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-[11.5px] text-muted-b">
                  <span className="font-bold text-ink-2">{money(value, { compact: true })}</span><span>·</span><span>avg {avgDays}d here</span>
                  {late > 0 && <span className="ml-auto text-[#B01B4F] font-bold">{late} overdue</span>}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1.5">
                {shown.map((d) => <DealCard key={d.id} d={d} onOpen={() => onOpen(d)} onDragStart={() => setDrag(d.id)} onDragEnd={() => setDrag(null)} />)}
                {col.length > COL_CAP && (
                  <button onClick={() => setExpanded((e) => ({ ...e, [stage]: !e[stage] }))} className="h-8 rounded-lg border border-dashed border-input-border text-[12px] font-semibold text-muted-b hover:text-accent hover:border-accent">
                    {expanded[stage] ? 'Show fewer' : `Show all ${col.length}`}
                  </button>
                )}
                {!col.length && <div className="text-[12px] text-muted-3 text-center py-6">Nothing here</div>}
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}

function DealCard({ d, onOpen, onDragStart, onDragEnd }: { d: Deal; onOpen: () => void; onDragStart: () => void; onDragEnd: () => void }) {
  const age = stageAge(d)
  const na = d.journey?.nextAction
  const due = na ? dueLabel(na.due) : null
  const sr = SHOWROOM_META[d.journey!.showroom]
  // Urgency, not stage, colours the card's left edge — driven by the NEXT ACTION so it stays a real
  // triage signal: red = action overdue, amber = due today/tomorrow, green = fine. (Time in stage has its own badge.)
  const dueSoon = !!na && na.due - Date.now() < 2 * 86_400_000
  const edge = d.won ? '#16A34A' : due?.overdue ? '#DC2626' : dueSoon ? '#F59E0B' : '#34D399'
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onOpen}
      className="bg-white rounded-lg border border-[#E1E6EC] border-l-[3px] pl-2.5 pr-3 py-2.5 cursor-pointer shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:shadow-[0_4px_12px_-4px_rgba(16,24,40,0.16)] hover:-translate-y-px transition-all"
      style={{ borderLeftColor: edge }}>
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sr.color }} title={`${sr.name} showroom`} />
        <span className="text-[13px] font-semibold text-ink-2 truncate flex-1">{d.name}</span>
        <span className="text-[12.5px] font-bold text-ink shrink-0">{money(d.value, { compact: true })}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-1 text-[11.5px] text-muted-2">
        <span className="truncate flex-1">{town(d)}</span>
        {d.won ? <span className="text-positive font-semibold">Signed</span> : <span className="font-semibold rounded px-1 py-px" style={{ color: age.color, background: age.bg }}>{age.days}d</span>}
      </div>
      {na && !d.won && (
        <div className="flex items-center gap-1.5 mt-1.5 text-[11.5px]">
          <span className={classNames('truncate flex-1', due!.overdue ? 'text-[#B01B4F] font-semibold' : 'text-ink-3')}>{na.label}</span>
          <span className={classNames('shrink-0', due!.overdue ? 'text-[#B01B4F]' : 'text-muted-3')}>{due!.text}</span>
          <span className="w-5 h-5 rounded-full bg-[#E8ECF3] text-[#15223B] text-[9px] font-bold flex items-center justify-center shrink-0" title={d.owner}>{initials(d.owner)}</span>
        </div>
      )}
    </div>
  )
}

/* ─────────── Table ─────────── */
type Col = 'name' | 'showroom' | 'stage' | 'days' | 'value' | 'next' | 'owner' | 'source' | 'enquired'
function TableView({ deals, onOpen }: { deals: Deal[]; onOpen: (d: Deal) => void }) {
  const act = useActions()
  const [sortBy, setSortBy] = useState<Col>('days')
  const [dir, setDir] = useState<1 | -1>(-1)
  const [group, setGroup] = useState(true)
  const [status, setStatus] = useState<'open' | 'signed' | 'all'>('open')
  const [sel, setSel] = useState<string[]>([])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const rows = deals.filter((d) => (status === 'open' ? !d.won : status === 'signed' ? d.won : true))
  const val = (d: Deal, c: Col): string | number => ({
    name: d.name, showroom: d.journey!.showroom, stage: SH_STAGES.indexOf(d.stage as (typeof SH_STAGES)[number]), days: stageAge(d).days, value: d.value,
    next: d.journey?.nextAction?.due ?? Infinity, owner: d.owner, source: d.journey!.source, enquired: enquiredAt(d),
  }[c])
  const sorted = [...rows].sort((a, b) => { const x = val(a, sortBy), y = val(b, sortBy); return (x < y ? -1 : x > y ? 1 : 0) * dir })
  const head = (c: Col, l: string, cls = '') => (
    <button onClick={() => { if (sortBy === c) setDir((d) => (d === 1 ? -1 : 1)); else { setSortBy(c); setDir(c === 'name' || c === 'owner' ? 1 : -1) } }} className={classNames('flex items-center gap-1 hover:text-ink-3', cls, sortBy === c && 'text-ink-3')}>
      {l}{sortBy === c && <ChevronDown size={11} className={dir === 1 ? 'rotate-180' : ''} />}
    </button>
  )
  const T = '28px minmax(210px,1.6fr) 110px 120px 70px 90px minmax(170px,1.2fr) 120px 130px 90px'
  const groups = group ? SH_STAGES.map((s) => ({ s, items: sorted.filter((d) => d.stage === s) })).filter((g) => g.items.length) : [{ s: '', items: sorted }]
  const toggle = (id: string) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]))

  return (
    <main className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="inline-flex bg-[#E9EDF2] border border-[#DDE3EA] rounded-control p-[3px]">
          {(['open', 'signed', 'all'] as const).map((s) => <button key={s} onClick={() => setStatus(s)} className={classNames('h-8 px-3 rounded-[7px] text-[12.5px] font-semibold capitalize', status === s ? 'bg-white text-accent font-bold shadow-[0_1px_3px_rgba(11,18,32,0.14)]' : 'text-muted-b hover:bg-control')}>{s}</button>)}
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-ink-3 ml-2"><input type="checkbox" checked={group} onChange={(e) => setGroup(e.target.checked)} style={{ accentColor: '#0E7A66' }} />Group by stage</label>
        <span className="ml-auto text-[12.5px] text-muted-2">{rows.length} deals · {money(rows.reduce((s, d) => s + d.value, 0), { compact: true })}</span>
      </div>
      {sel.length > 0 && (
        <div className="sticky top-0 z-10 rounded-card bg-[#15223B] text-white px-4 py-2.5 flex items-center gap-3 text-[13px] shadow-lift">
          <b>{sel.length} selected</b>
          <select onChange={(e) => { if (!e.target.value) return; sel.forEach((id) => act.moveStage(id, e.target.value)); act.toast(`Moved ${sel.length} to ${e.target.value}`); setSel([]); e.target.value = '' }} className="h-8 px-2 rounded-md bg-white/10 border border-white/20 text-white text-[12.5px] outline-none">
            <option value="">Move to stage…</option>{SH_STAGES.map((s) => <option key={s} value={s} className="text-ink">{s}</option>)}
          </select>
          <select onChange={(e) => { if (!e.target.value) return; sel.forEach((id) => act.updateDeal(id, { owner: e.target.value })); act.toast(`Assigned ${sel.length} to ${e.target.value}`); setSel([]); e.target.value = '' }} className="h-8 px-2 rounded-md bg-white/10 border border-white/20 text-white text-[12.5px] outline-none">
            <option value="">Assign adviser…</option>{[...new Set(deals.map((d) => d.owner))].map((o) => <option key={o} value={o} className="text-ink">{o}</option>)}
          </select>
          <button onClick={() => { sel.forEach((id) => { const d = deals.find((x) => x.id === id); if (d) act.markLost(id, d.name, 'Bulk closed') }); setSel([]) }} className="h-8 px-3 rounded-md bg-white/10 hover:bg-white/20 text-[12.5px] font-semibold">Mark lost</button>
          <button onClick={() => setSel([])} className="ml-auto text-white/70 hover:text-white text-[12.5px]">Clear</button>
        </div>
      )}
      <div className="rounded-card bg-surface border border-border shadow-card overflow-hidden">
        <div className="grid gap-3 px-4 h-10 items-center border-b border-divider bg-[#FAFBFC] text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-3" style={{ gridTemplateColumns: T }}>
          <input type="checkbox" checked={sel.length > 0 && sel.length === rows.length} onChange={(e) => setSel(e.target.checked ? rows.map((d) => d.id) : [])} style={{ accentColor: '#0E7A66' }} />
          {head('name', 'Customer')}{head('showroom', 'Showroom')}{head('stage', 'Stage')}{head('days', 'In stage')}{head('value', 'Value')}{head('next', 'Next action')}{head('owner', 'Adviser')}{head('source', 'Source')}{head('enquired', 'Enquired')}
        </div>
        {groups.map((g) => (
          <div key={g.s || 'all'}>
            {group && (
              <button onClick={() => setCollapsed((c) => ({ ...c, [g.s]: !c[g.s] }))} className="w-full h-9 px-4 flex items-center gap-2 bg-[#F6F8FA] border-b border-divider-row text-[12.5px] font-bold text-ink-2">
                <ChevronDown size={13} className={classNames('text-muted-3 transition-transform', collapsed[g.s] && '-rotate-90')} />{g.s}
                <span className="text-muted-2 font-semibold">{g.items.length} · {money(g.items.reduce((s, d) => s + d.value, 0), { compact: true })}</span>
              </button>
            )}
            {!collapsed[g.s] && g.items.map((d) => {
              const age = stageAge(d), na = d.journey?.nextAction, due = na ? dueLabel(na.due) : null, sr = SHOWROOM_META[d.journey!.showroom]
              return (
                <div key={d.id} onClick={() => onOpen(d)} className={classNames('grid gap-3 px-4 py-2.5 items-center border-b border-divider-row text-[12.5px] cursor-pointer hover:bg-[#FAFCFB]', sel.includes(d.id) && 'bg-accent-wash-4')} style={{ gridTemplateColumns: T }}>
                  <input type="checkbox" checked={sel.includes(d.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(d.id)} style={{ accentColor: '#0E7A66' }} />
                  <div className="min-w-0"><div className="font-semibold text-ink-2 truncate">{d.name}</div><div className="text-[11.5px] text-muted-2 truncate">{d.org}</div></div>
                  <span className="flex items-center gap-1.5 text-ink-3"><span className="w-1.5 h-1.5 rounded-full" style={{ background: sr.color }} />{sr.name}</span>
                  <span className="text-ink-3">{d.won ? <span className="text-positive font-semibold">{labelOf(currentStep(d)!.key)}</span> : d.stage}</span>
                  <span className="font-semibold rounded px-1.5 py-px w-fit" style={{ color: age.color, background: age.bg }}>{age.days}d</span>
                  <span className="font-semibold text-ink-2">{money(d.value, { compact: true })}</span>
                  <span className="min-w-0 truncate">{na ? <><span className={due!.overdue ? 'text-[#B01B4F] font-semibold' : 'text-ink-3'}>{na.label}</span> <span className="text-muted-3">· {due!.text}</span></> : <span className="text-muted-3">—</span>}</span>
                  <span className="text-ink-3 truncate">{d.owner}</span>
                  <span className="text-muted-b truncate">{d.journey!.source}</span>
                  <span className="text-muted-2">{new Date(enquiredAt(d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </main>
  )
}

/* ─────────── Work queue — clear a busy stage one customer at a time ─────────── */
function WorkQueue({ byStage, stage, setStage }: { byStage: Record<string, Deal[]>; stage: string; setStage: (s: string) => void }) {
  const act = useActions()
  const nav = useNavigate()
  const list = (byStage[stage] ?? []).filter((d) => !d.won)
  const [idx, setIdx] = useState(0)
  const [reviewed, setReviewed] = useState<string[]>([])
  const [note, setNote] = useState('')
  useEffect(() => { setIdx(0); setReviewed([]) }, [stage])
  const d = list[Math.min(idx, Math.max(0, list.length - 1))]
  const next = () => { if (d) setReviewed((r) => (r.includes(d.id) ? r : [...r, d.id])); setNote(''); setIdx((i) => Math.min(i + 1, list.length - 1)) }
  const prev = () => setIdx((i) => Math.max(0, i - 1))
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'INPUT') return; if (e.key === 'j' || e.key === 'ArrowDown') next(); if (e.key === 'k' || e.key === 'ArrowUp') prev() }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  })

  function log(outcome: string) {
    if (!d) return
    act.addActivity({ type: 'call', subject: `${outcome} — ${d.name}`, body: note || undefined, dealId: d.id, done: true, who: ME })
    act.toast(`Logged: ${outcome}`)
    next()
  }
  function advance() {
    if (!d) return
    const p = advancePatch(d, ME); if (!p) return
    act.updateDeal(d.id, p); act.toast(`${d.name} → ${p.stage}`)
    setNote('')
  }
  function snooze(days: number) {
    if (!d?.journey) return
    act.updateDeal(d.id, { journey: { ...d.journey, nextAction: { label: d.journey.nextAction?.label ?? 'Follow up', due: Date.now() + days * DAY } } })
    act.toast(`Next action moved ${days} day${days > 1 ? 's' : ''}`); next()
  }

  return (
    <main className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 px-5 pt-4 flex items-center gap-2 flex-wrap">
        {SH_STAGES.slice(0, 5).map((s) => (
          <button key={s} onClick={() => setStage(s)} className={classNames('h-9 px-3 rounded-lg border text-[13px] font-semibold flex items-center gap-2', stage === s ? 'bg-accent-wash border-accent text-accent' : 'bg-surface border-border text-ink-3 hover:border-input-border')}>
            {s}<span className="text-[11px] font-bold rounded-full px-1.5 bg-white border border-border">{(byStage[s] ?? []).filter((x) => !x.won).length}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 text-[12.5px] text-muted-b">
          <span><b className="text-ink">{reviewed.length}</b> of {list.length} worked through</span>
          <div className="w-40 h-1.5 rounded-full bg-control overflow-hidden"><div className="h-full bg-accent-500 transition-all" style={{ width: `${list.length ? (reviewed.length / list.length) * 100 : 0}%` }} /></div>
          <span className="text-muted-3">J / K to move</span>
        </div>
      </div>
      {!d ? <div className="flex-1 flex items-center justify-center text-[13px] text-muted-2">Stage clear 🎉</div> : (
        <div className="flex-1 min-h-0 grid grid-cols-[320px_1fr] gap-4 p-5">
          <div className="rounded-card bg-surface border border-border shadow-card overflow-y-auto">
            {list.map((x, i) => {
              const age = stageAge(x), na = x.journey?.nextAction, due = na ? dueLabel(na.due) : null
              return (
                <button key={x.id} onClick={() => setIdx(i)} className={classNames('w-full text-left px-3.5 py-2.5 border-b border-divider-row flex items-center gap-2.5', x.id === d.id ? 'bg-accent-wash-4' : 'hover:bg-[#FAFBFC]')}>
                  <span className={classNames('w-4 h-4 rounded-full flex items-center justify-center shrink-0', reviewed.includes(x.id) ? 'bg-positive text-white' : 'border-2 border-border')}>{reviewed.includes(x.id) && <Check size={9} />}</span>
                  <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate">{x.name}</div><div className={classNames('text-[11.5px] truncate', due?.overdue ? 'text-[#B01B4F]' : 'text-muted-2')}>{na?.label ?? '—'} · {due?.text}</div></div>
                  <span className="text-[11px] font-semibold rounded px-1 py-px" style={{ color: age.color, background: age.bg }}>{age.days}d</span>
                </button>
              )
            })}
          </div>
          <QueueCard d={d} note={note} setNote={setNote} onLog={log} onAdvance={advance} onSnooze={snooze} onOpen={() => nav(`/deals/${d.id}`)} onNext={next} onPrev={prev} pos={`${list.indexOf(d) + 1} / ${list.length}`} />
        </div>
      )}
    </main>
  )
}

function QueueCard({ d, note, setNote, onLog, onAdvance, onSnooze, onOpen, onNext, onPrev, pos }: { d: Deal; note: string; setNote: (s: string) => void; onLog: (o: string) => void; onAdvance: () => void; onSnooze: (n: number) => void; onOpen: () => void; onNext: () => void; onPrev: () => void; pos: string }) {
  const j = d.journey!
  const cur = currentStep(d)!
  const guide = STAGE_GUIDE[cur.key]
  const age = stageAge(d)
  const nextKey = JOURNEY[JOURNEY.findIndex((x) => x.key === cur.key) + 1]
  const facts: [string, ReactNode][] = [
    ['Phone', <a href={`tel:${j.phone.replace(/\s/g, '')}`} className="text-accent font-semibold">{j.phone}</a>], ['Email', j.email], ['Showroom', SHOWROOM_META[j.showroom].name], ['Source', j.source],
    ['Property', `${j.property.type} · ${j.property.bedrooms} bed`], ['Roof', j.property.roofAspect], ['Usage', `${j.property.annualKwh.toLocaleString()} kWh/yr · £${j.property.monthlyBill}/mo`], ['EV', j.property.hasEv ? 'Yes' : 'No'],
  ]
  return (
    <div className="rounded-card bg-surface border border-border shadow-card flex flex-col min-h-0 overflow-y-auto">
      <div className="px-5 py-4 border-b border-divider flex items-start gap-3">
        <span className="w-11 h-11 rounded-full bg-accent-wash text-accent font-bold flex items-center justify-center">{initials(d.name)}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-bold text-ink">{d.name}</div>
          <div className="text-[12.5px] text-muted-b">{j.address}</div>
          <div className="flex items-center gap-2 mt-1.5 text-[12px]">
            <span className="font-semibold rounded px-1.5 py-px" style={{ color: age.color, background: age.bg }}>{age.days} days in {d.stage}</span>
            <span className="text-muted-2">Adviser {d.owner}</span><span className="text-muted-2">· {money(d.value)}</span>
          </div>
        </div>
        <span className="text-[12px] text-muted-3 font-semibold">{pos}</span>
        <button onClick={onPrev} className="w-8 h-8 rounded-control border border-border flex items-center justify-center text-ink-3 hover:bg-control"><ChevronRight size={15} className="rotate-180" /></button>
        <button onClick={onNext} className="w-8 h-8 rounded-control border border-border flex items-center justify-center text-ink-3 hover:bg-control"><ChevronRight size={15} /></button>
      </div>
      <div className="px-5 py-4 grid grid-cols-[1fr_300px] gap-5">
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-accent-wash-4 border border-border-blue p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-700">What this stage needs</div>
            <div className="text-[12.5px] text-ink-3 mt-1">{guide.what}</div>
            <ul className="mt-2 flex flex-col gap-1">{guide.needs.map((n) => <li key={n} className="text-[12.5px] text-ink-2 flex gap-2"><span className="w-1.5 h-1.5 rounded-full bg-accent-500 mt-1.5 shrink-0" />{n}</li>)}</ul>
          </div>
          <div>
            <div className="text-[12px] font-semibold text-ink-3 mb-1.5">Log the outcome</div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional note: what did they say?" className="w-full rounded-control border border-input-border px-3 py-2 text-[13px] outline-none focus:border-accent resize-none" />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['Spoke to them', 'No answer, left voicemail', 'Sent WhatsApp', 'Call back requested'].map((o) => <button key={o} onClick={() => onLog(o)} className="h-8 px-3 rounded-full border border-border text-[12px] font-semibold text-ink-3 hover:border-accent hover:text-accent hover:bg-accent-wash flex items-center gap-1.5"><Phone size={12} />{o}</button>)}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            {nextKey && <button onClick={onAdvance} className="h-10 px-4 rounded-control bg-accent-gradient text-white text-[13px] font-semibold shadow-primary flex items-center gap-1.5"><Check size={15} />Complete · move to {nextKey.label}</button>}
            <button onClick={() => onSnooze(2)} className="h-10 px-3 rounded-control border border-border text-[12.5px] font-semibold text-ink-3 hover:bg-control flex items-center gap-1.5"><Clock size={14} />Snooze 2 days</button>
            <button onClick={onOpen} className="h-10 px-3 rounded-control border border-border text-[12.5px] font-semibold text-ink-3 hover:bg-control flex items-center gap-1.5 ml-auto"><Person size={14} />Full record</button>
          </div>
        </div>
        <div className="rounded-xl border border-divider p-3.5 flex flex-col gap-1.5 h-fit">
          {facts.map(([k, v]) => <div key={k} className="flex justify-between gap-3 text-[12.5px]"><span className="text-muted-2">{k}</span><span className="text-ink-2 text-right truncate">{v}</span></div>)}
          {j.steps.slice(-3).map((s) => <div key={s.key} className="text-[11.5px] text-muted-b border-t border-divider-row pt-1.5 mt-1"><Target size={11} className="inline mr-1 text-muted-3" />{labelOf(s.key)} · {new Date(s.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{s.by ? ` · ${s.by}` : ''}</div>)}
        </div>
      </div>
    </div>
  )
}

/* ─────────── New enquiry ─────────── */
function NewEnquiryModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (id: string) => void }) {
  const act = useActions()
  const [f, setF] = useState({ name: '', phone: '', email: '', address: '', postcode: '', showroom: 'cardiff' as Showroom, source: 'Website enquiry', type: 'Semi-detached' })
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }))
  function create() {
    if (!f.name.trim()) return
    const now = Date.now()
    const owner = { cardiff: 'Jordan Miles', cheltenham: 'Beth Collins', melksham: 'Kate Morris' }[f.showroom]
    const d = act.addDeal({
      name: f.name.trim(), org: `${f.address || 'Address TBC'}${f.postcode ? `, ${f.postcode}` : ''}`, value: 12000, stage: SH_STAGES[0], probability: 10, owner, subtitle: `${f.type}`,
      journey: { showroom: f.showroom, source: f.source, address: `${f.address}${f.postcode ? `, ${f.postcode}` : ''}`, postcode: f.postcode, phone: f.phone, email: f.email,
        property: { type: f.type, bedrooms: 3, roofAspect: 'Unknown', annualKwh: 3600, monthlyBill: 85, heating: 'Mains gas', hasEv: false },
        steps: [{ key: 'enquiry', at: now, by: f.source, data: { channel: f.source } }], nextAction: { label: 'Call back within the hour', due: now + 3_600_000 } },
    })
    act.addActivity({ type: 'call', subject: `Call back within the hour — ${f.name.trim()}`, dealId: d.id, who: owner, due: 'Today', dueDate: new Date().toISOString().slice(0, 10), priority: 'High' })
    onCreate(d.id)
  }
  return (
    <Modal open={open} onClose={onClose} title="New enquiry" subtitle="A homeowner got in touch: log them and the call-back task is created automatically" width={560}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={create}>Create enquiry</Button></>}>
      <Field label="Homeowner name"><Input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Sarah Whitfield" autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone"><Input value={f.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="07…" /></Field>
        <Field label="Email"><Input value={f.email} onChange={(e) => set({ email: e.target.value })} placeholder="name@…" /></Field>
      </div>
      <div className="grid grid-cols-[1fr_140px] gap-3">
        <Field label="Address"><Input value={f.address} onChange={(e) => set({ address: e.target.value })} placeholder="House number & street, town" /></Field>
        <Field label="Postcode"><Input value={f.postcode} onChange={(e) => set({ postcode: e.target.value.toUpperCase() })} placeholder="CF14 2AA" /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Showroom"><Select value={f.showroom} onChange={(e) => set({ showroom: e.target.value as Showroom })}>{SHOWROOMS.map((s) => <option key={s} value={s}>{SHOWROOM_META[s].name}</option>)}</Select></Field>
        <Field label="Source"><Select value={f.source} onChange={(e) => set({ source: e.target.value })}>{['Website enquiry', 'Facebook lead ad', 'Showroom walk-in', 'Google search', 'Referral', 'Instagram', 'Leekes in-store', 'Phone call'].map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Property"><Select value={f.type} onChange={(e) => set({ type: e.target.value })}>{['Detached', 'Semi-detached', 'Terraced', 'Bungalow'].map((s) => <option key={s}>{s}</option>)}</Select></Field>
      </div>
    </Modal>
  )
}
