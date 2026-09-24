import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Button, Kpi, Panel, Segmented } from '../components/ui'
import { Modal, Field, Input, Select, Textarea } from '../components/overlays'
import { Dropdown } from '../components/Dropdown'
import { MonthColumns, HBars, DataTable, Delta, Legend, C } from '../components/charts'
import { Plus, Download, Upload, Check, ArrowUpRight, Search, Phone, Envelope, MapPin, Bolt, Pie, Wrench, Clock, Layers, Calendar, Person, Sun, Target, Dollar } from '../components/icons'
import { useState_, useActions } from '../store/store'
import { LEAD_STATUSES, type Deal, type Lead, type LeadStatus } from '../store/types'
import { classNames, money } from '../lib/format'
import { SHOWROOM_META, SOS } from '../lib/solarHouseData'
import { showroomFor, dealFromLead, parseCsv, autoMap, LEAD_FIELDS, CSV_TEMPLATE, DEFAULT_CPL, type LeadFieldKey } from '../lib/leadOps'

/* Leads — where every new homeowner lead lands before it enters the sales pipeline: CSV batches from
 * Solar on Steroids, website forms, ads, referrals. Work them (call, assign, qualify), then push the
 * good ones to the pipeline. Analytics: where leads come from, month by month, and what they're worth. */

export const LEAD_STATUS_META: Record<LeadStatus, { label: string; tone: string; dot: string }> = {
  new: { label: 'New', tone: 'text-[#0A5A4C] bg-[#D6F7F0]', dot: '#2FBFA5' },
  working: { label: 'Working', tone: 'text-[#15223B] bg-[#E9EDF4]', dot: '#15223B' },
  nurturing: { label: 'Nurturing', tone: 'text-[#4A5A78] bg-[#EDF0F5]', dot: '#4A5A78' },
  qualified: { label: 'Qualified', tone: 'text-[#0A5A4C] bg-[#E1F6F1]', dot: '#0E7A66' },
  unqualified: { label: 'Unqualified', tone: 'text-muted-2 bg-control', dot: '#8A93A3' },
}
const HOUR = 3_600_000, DAY = 86_400_000
const rel = (t?: number) => { if (!t) return '—'; const m = Math.round((Date.now() - t) / 60000); return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : m < 2880 ? 'Yesterday' : `${Math.round(m / 1440)}d ago` }
const fmtDate = (t?: number) => (t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—')
function StatusPill({ status }: { status: LeadStatus }) {
  const m = LEAD_STATUS_META[status]
  return <span className={classNames('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap', m.tone)}><span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />{m.label}</span>
}
const ScorePill = ({ s }: { s: number }) => <span className={classNames('text-[11.5px] font-bold rounded-md px-1.5 py-0.5 tabular-nums w-fit', s >= 75 ? 'bg-[#15223B] text-[#62E4CC]' : s >= 60 ? 'bg-[#E1F6F1] text-[#0A5A4C]' : 'bg-[#F1F3F7] text-muted-b')}>{Math.round(s)}</span>

function useTabs(on: 'inbox' | 'analytics') {
  const nav = useNavigate()
  return { items: [{ id: 'inbox', label: 'Lead inbox', icon: Bolt }, { id: 'analytics', label: 'Analytics', icon: Pie }], value: on, onChange: (id: string) => nav(id === 'inbox' ? '/leads' : '/leads/analytics') }
}

/* ============================ Inbox ============================ */
type StatusView = 'To work' | 'Working' | 'Pushed' | 'Unqualified' | 'All'
export function Leads() {
  const nav = useNavigate()
  const { leads, deals } = useState_()
  const act = useActions()
  const tabs = useTabs('inbox')
  const [batch, setBatch] = useState<string>('all') // 'all' | batch id | 'src:<source>'
  const [status, setStatus] = useState<StatusView>('To work')
  const [owner, setOwner] = useState('all')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const now = Date.now()

  const live = leads.filter((l) => !l.archived)
  const batches = useMemo(() => {
    const m = new Map<string, { id: string; label: string; receivedAt: number; file?: string; leads: Lead[] }>()
    live.forEach((l) => { if (!l.batch) return; const b = m.get(l.batch.id) ?? { ...l.batch, leads: [] }; b.leads.push(l); m.set(l.batch.id, b) })
    return [...m.values()].sort((a, b) => b.receivedAt - a.receivedAt)
  }, [live])
  const sources = useMemo(() => { const m = new Map<string, number>(); live.filter((l) => !l.batch).forEach((l) => m.set(l.source, (m.get(l.source) ?? 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1]) }, [live])
  const owners = [...new Set(live.map((l) => l.owner))].sort()

  const inScope = live.filter((l) => batch === 'all' ? true : batch.startsWith('src:') ? !l.batch && l.source === batch.slice(4) : l.batch?.id === batch)
  const statusOf = (l: Lead): StatusView => (l.converted || l.pushedDealId ? 'Pushed' : l.status === 'unqualified' ? 'Unqualified' : l.status === 'new' ? 'To work' : 'Working')
  const visible = inScope
    .filter((l) => status === 'All' || statusOf(l) === status)
    .filter((l) => owner === 'all' || l.owner === owner)
    .filter((l) => !q || `${l.name} ${l.phone} ${l.email} ${l.postcode} ${l.address} ${l.company}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  const count = (s: StatusView) => inScope.filter((l) => s === 'All' || statusOf(l) === s).length
  const weekAgo = now - 7 * DAY
  const kpi = {
    toWork: live.filter((l) => statusOf(l) === 'To work').length,
    waiting: live.filter((l) => statusOf(l) === 'To work' && (l.createdAt ?? now) < now - HOUR).length,
    thisWeek: live.filter((l) => (l.createdAt ?? 0) > weekAgo).length,
    pushed: live.filter((l) => statusOf(l) === 'Pushed' && (l.createdAt ?? 0) > weekAgo).length,
    sos: live.filter((l) => l.source === SOS && (l.createdAt ?? 0) > new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()).length,
  }
  const selected = visible.filter((l) => sel.has(l.id))
  const allSel = visible.length > 0 && visible.every((l) => sel.has(l.id))

  function push(list: Lead[]) {
    const ok = list.filter((l) => !l.pushedDealId && !l.converted)
    ok.forEach((l) => { const d = act.addDeal(dealFromLead(l)); act.updateLeads([l.id], { pushedDealId: d.id, converted: true, status: 'qualified' }) })
    act.toast(`${ok.length} lead${ok.length === 1 ? '' : 's'} pushed to the pipeline — they're on the Deals board as new enquiries`)
    setSel(new Set())
  }
  function scheduleCalls(list: Lead[]) {
    const today = new Date().toISOString().slice(0, 10)
    list.forEach((l) => act.addActivity({ type: 'call', subject: `First call — ${l.name}`, body: [l.phone, l.interest, l.notes].filter(Boolean).join(' · '), leadId: l.id, dueDate: today, due: 'Today', priority: 'High', who: l.owner, purpose: 'First contact', location: 'Phone', estimateMins: 15 }))
    act.updateLeads(list.map((l) => l.id), { status: 'working' })
    act.toast(`${list.length} first call${list.length === 1 ? '' : 's'} added to My Tasks`)
    setSel(new Set())
  }
  const current = batches.find((b) => b.id === batch)
  const openLead = live.find((l) => l.id === open)

  return (
    <>
      <TopBar title="Leads" crumbs={['Before the pipeline']} identity={{ icon: Bolt, accent: '#15223B' }} tabs={tabs}
        actions={<><Button icon={<Plus size={15} />} onClick={() => { const l = act.addLead({ name: 'New lead', company: '', source: 'Manual', status: 'new', role: 'Homeowner' }); setOpen(l.id) }}>Add lead</Button><Button variant="primary" icon={<Upload size={15} />} onClick={() => setImporting(true)}>Import CSV batch</Button></>} />
      <main className="flex-1 min-h-0 flex flex-col">
        <div className="px-7 pt-5 grid grid-cols-5 gap-4 shrink-0">
          <Kpi variant="navy" icon={Bolt} label="Leads to work" value={String(kpi.toWork)} delta="not contacted yet" />
          <Kpi icon={Clock} label="Waiting over an hour" value={String(kpi.waiting)} delta="speed wins — call these first" deltaTone="muted" />
          <Kpi icon={Calendar} label="In this week" value={String(kpi.thisWeek)} delta="all sources" deltaTone="muted" />
          <Kpi icon={ArrowUpRight} label="Pushed this week" value={String(kpi.pushed)} delta="now in the sales pipeline" deltaTone="muted" />
          <Kpi variant="teal" icon={Layers} label="Solar on Steroids" value={String(kpi.sos)} delta="leads this month" />
        </div>
        <div className="flex-1 min-h-0 flex gap-5 px-7 py-4">
          {/* batches & sources */}
          <aside className="w-[290px] shrink-0 min-h-0 flex flex-col rounded-card bg-white border border-[#E1E6EC] shadow-card overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-4">
              <button onClick={() => setBatch('all')} className={classNames('w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[13px] font-semibold text-left', batch === 'all' ? 'bg-[#15223B] text-white' : 'text-ink-2 hover:bg-control')}>
                <Bolt size={15} className={batch === 'all' ? 'text-[#62E4CC]' : 'text-muted-b'} /><span className="flex-1">All leads</span><span className={classNames('text-[11px] font-bold rounded-full px-1.5', batch === 'all' ? 'bg-[#62E4CC] text-[#15223B]' : 'bg-[#EEF1F5] text-muted-b')}>{live.length}</span>
              </button>
              <div>
                <div className="px-2 pb-1.5 eyebrow text-muted-3 flex items-center"><span className="flex-1">CSV batches</span><button onClick={() => setImporting(true)} className="text-muted-3 hover:text-ink"><Plus size={13} /></button></div>
                <div className="flex flex-col gap-1.5">
                  {batches.map((b) => {
                    const worked = b.leads.filter((l) => statusOf(l) !== 'To work').length
                    const on = batch === b.id
                    return (
                      <button key={b.id} onClick={() => setBatch(b.id)} className={classNames('w-full text-left rounded-[10px] border px-3 py-2.5 transition-colors', on ? 'border-[#15223B] bg-[#F1FBF8]' : 'border-[#EEF1F5] hover:border-[#D5DBE3]')}>
                        <div className="text-[12.5px] font-bold text-ink truncate">{b.label}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-2"><span>{b.leads.length} leads</span><span>·</span><span>{b.leads.length - worked} to work</span><span className="ml-auto">{rel(b.receivedAt)}</span></div>
                        <div className="h-1.5 rounded-full bg-[#EEF1F5] mt-2 overflow-hidden"><div className="h-full rounded-full bg-[#0E7A66]" style={{ width: `${(worked / Math.max(1, b.leads.length)) * 100}%` }} /></div>
                      </button>
                    )
                  })}
                  {!batches.length && <div className="px-2 text-[12px] text-muted-3">No batches yet — import a CSV.</div>}
                </div>
              </div>
              <div>
                <div className="px-2 pb-1.5 eyebrow text-muted-3">Other sources</div>
                {sources.map(([s, n]) => (
                  <button key={s} onClick={() => setBatch(`src:${s}`)} className={classNames('w-full flex items-center gap-2 px-3 py-1.5 rounded-[8px] text-[12.5px] text-left', batch === `src:${s}` ? 'bg-[#E9EDF4] text-[#15223B] font-semibold' : 'text-ink-3 hover:bg-control')}>
                    <span className="flex-1 truncate">{s}</span><span className="text-muted-3 tabular-nums">{n}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* list */}
          <section className="flex-1 min-w-0 min-h-0 flex flex-col gap-3">
            {current && (
              <div className="shrink-0 rounded-card bg-white border border-[#E1E6EC] shadow-card px-5 py-3.5 flex items-center gap-5 flex-wrap">
                <span className="w-10 h-10 rounded-[11px] bg-[#15223B] text-[#62E4CC] flex items-center justify-center"><Layers size={18} /></span>
                <div className="min-w-0"><div className="text-[15px] font-bold text-ink truncate">{current.label}</div><div className="text-[12px] text-muted-2">{current.file ?? 'CSV import'} · received {new Date(current.receivedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div></div>
                <div className="flex items-center gap-4 ml-2 text-[12px] text-muted-b">
                  {(['To work', 'Working', 'Pushed', 'Unqualified'] as StatusView[]).map((s) => <span key={s}><b className="text-[16px] text-ink tabular-nums">{current.leads.filter((l) => statusOf(l) === s).length}</b> {s.toLowerCase()}</span>)}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Button onClick={() => scheduleCalls(current.leads.filter((l) => statusOf(l) === 'To work'))} icon={<Phone size={14} />}>Queue first calls</Button>
                  <Button variant="primary" icon={<ArrowUpRight size={14} />} onClick={() => push(current.leads.filter((l) => statusOf(l) === 'Working' && l.score >= 60))}>Push qualified</Button>
                </div>
              </div>
            )}
            <div className="shrink-0 flex items-center gap-2.5 flex-wrap">
              <Segmented options={(['To work', 'Working', 'Pushed', 'Unqualified', 'All'] as StatusView[]).map((s) => `${s} · ${count(s)}`)} value={`${status} · ${count(status)}`} onChange={(v) => { setStatus(v.split(' · ')[0] as StatusView); setSel(new Set()) }} />
              <Dropdown value={owner} onChange={(e) => setOwner(e.target.value)} className="h-9 px-3 rounded-[10px] border border-[#E1E6EC] bg-white text-[13px] font-semibold text-ink-3"><option value="all">All advisers</option>{owners.map((o) => <option key={o}>{o}</option>)}</Dropdown>
              <label className="h-9 flex-1 min-w-[200px] max-w-[320px] rounded-[10px] border border-[#E1E6EC] bg-white flex items-center gap-2 px-3"><Search size={14} className="text-muted-3" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone, email or postcode" className="flex-1 min-w-0 bg-transparent outline-none text-[13px]" /></label>
            </div>
            {selected.length > 0 && (
              <div className="shrink-0 rounded-[12px] bg-[#15223B] text-white px-4 py-2.5 flex items-center gap-2 text-[13px]">
                <b className="mr-2">{selected.length} selected</b>
                <button onClick={() => push(selected)} className="h-8 px-3 rounded-[8px] bg-[#62E4CC] text-[#15223B] font-bold flex items-center gap-1.5"><ArrowUpRight size={14} />Push to pipeline</button>
                <button onClick={() => scheduleCalls(selected)} className="h-8 px-3 rounded-[8px] bg-white/10 hover:bg-white/20 font-semibold flex items-center gap-1.5"><Phone size={13} />Queue calls</button>
                <div className="relative">
                  <button onClick={() => setAssignOpen((o) => !o)} className="h-8 px-3 rounded-[8px] bg-white/10 hover:bg-white/20 font-semibold flex items-center gap-1.5"><Person size={13} />Assign</button>
                  {assignOpen && <div className="absolute top-full mt-1 left-0 z-20 w-[200px] rounded-[10px] bg-white text-ink-2 shadow-lg border border-[#E1E6EC] p-1">{owners.map((o) => <button key={o} onClick={() => { act.updateLeads(selected.map((l) => l.id), { owner: o }); act.toast(`${selected.length} leads assigned to ${o}`); setAssignOpen(false); setSel(new Set()) }} className="w-full text-left px-2.5 py-1.5 rounded-[7px] text-[13px] hover:bg-[#F1FBF8]">{o}</button>)}</div>}
                </div>
                <button onClick={() => { act.updateLeads(selected.map((l) => l.id), { status: 'unqualified' }); act.toast(`${selected.length} marked unqualified`); setSel(new Set()) }} className="h-8 px-3 rounded-[8px] bg-white/10 hover:bg-white/20 font-semibold">Unqualified</button>
                <button onClick={() => { act.updateLeads(selected.map((l) => l.id), { archived: true }); act.toast(`${selected.length} archived`); setSel(new Set()) }} className="h-8 px-3 rounded-[8px] bg-white/10 hover:bg-white/20 font-semibold">Archive</button>
                <button onClick={() => setSel(new Set())} className="ml-auto text-white/70 hover:text-white text-[12.5px]">Clear</button>
              </div>
            )}
            <div className="flex-1 min-h-0 flex flex-col rounded-card bg-white border border-[#E1E6EC] shadow-card overflow-hidden">
              {(() => {
                const T = '34px minmax(160px,1.3fr) minmax(160px,1.3fr) 130px 64px 140px 80px 54px 104px 140px'
                return (
                  <>
                    <div className="shrink-0 grid gap-3 px-4 h-10 items-center bg-[#FAFBFC] border-b border-[#EEF1F5] text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted-3" style={{ gridTemplateColumns: T }}>
                      <input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(visible.map((l) => l.id)))} className="w-4 h-4 accent-[#15223B]" />
                      <span>Lead</span><span>Address</span><span>Interested in</span><span className="text-right">Bill</span><span>Source</span><span>Received</span><span>Score</span><span>Status</span><span />
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      {visible.map((l) => (
                        <div key={l.id} onClick={() => setOpen(l.id)} className={classNames('grid gap-3 px-4 py-2.5 items-center border-b border-[#F0F2F5] cursor-pointer', sel.has(l.id) || open === l.id ? 'bg-[#F1FBF8]' : 'hover:bg-[#FAFCFB]')} style={{ gridTemplateColumns: T }}>
                          <input type="checkbox" checked={sel.has(l.id)} onClick={(e) => e.stopPropagation()} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n })} className="w-4 h-4 accent-[#15223B]" />
                          <div className="min-w-0"><div className="text-[13px] font-bold text-ink truncate">{l.name}</div><div className="text-[11.5px] text-muted-2 tabular-nums truncate">{l.phone ?? l.email ?? '—'}</div></div>
                          <div className="min-w-0 text-[12.5px] text-ink-3 truncate">{l.address ?? l.company}{l.postcode && <> · <b className="text-ink-2">{l.postcode}</b></>}</div>
                          <div className="text-[12px] text-ink-3 truncate">{l.interest ?? '—'}</div>
                          <div className="text-[12.5px] text-ink-2 text-right tabular-nums">{l.monthlyBill ? `£${l.monthlyBill}` : '—'}</div>
                          <div className="min-w-0 text-[12px] text-ink-3 truncate">{l.batch ? <span className="font-semibold text-[#15223B]">{l.source}</span> : l.source}</div>
                          <div className="text-[12px] text-muted-b">{rel(l.createdAt)}</div>
                          <ScorePill s={l.score} />
                          <StatusPill status={statusOf(l) === 'Pushed' ? 'qualified' : l.status} />
                          <div className="flex items-center gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                            {l.phone && <a href={`tel:${l.phone.replace(/\s/g, '')}`} onClick={() => act.updateLeads([l.id], { status: 'working', contactedAt: Date.now() })} className="w-8 h-8 rounded-[8px] border border-[#E1E6EC] text-ink-3 hover:bg-control flex items-center justify-center" title={`Call ${l.phone}`}><Phone size={13} /></a>}
                            {l.pushedDealId ? <button onClick={() => nav(`/deals/${l.pushedDealId}`)} className="h-8 px-2.5 rounded-[8px] border border-[#E1E6EC] text-[11.5px] font-semibold text-ink-3 hover:bg-control">Open deal</button>
                              : l.converted ? <span className="text-[11.5px] text-muted-3">In pipeline</span>
                                : <button onClick={() => push([l])} className="h-8 px-2.5 rounded-[8px] bg-[#15223B] text-white text-[11.5px] font-semibold flex items-center gap-1 hover:bg-[#1E2F4E]"><ArrowUpRight size={12} className="text-[#62E4CC]" />Push</button>}
                          </div>
                        </div>
                      ))}
                      {!visible.length && <div className="py-14 text-center text-[13px] text-muted-2">Nothing here.</div>}
                    </div>
                  </>
                )
              })()}
            </div>
          </section>
        </div>
      </main>
      {openLead && <LeadPanel lead={openLead} deals={deals} onClose={() => setOpen(null)} onPush={() => push([openLead])} onCall={() => scheduleCalls([openLead])} />}
      <ImportBatchModal open={importing} onClose={() => setImporting(false)} existing={[...leads, ...deals.filter((d) => d.journey).map((d) => ({ phone: d.journey!.phone, email: d.journey!.email }))]} onImported={(id) => { setImporting(false); setBatch(id); setStatus('To work') }} />
    </>
  )
}

/* ---- the lead, in full: a proper side panel with everything needed to qualify it ---- */
function LeadPanel({ lead: l, deals, onClose, onPush, onCall }: { lead: Lead; deals: Deal[]; onClose: () => void; onPush: () => void; onCall: () => void }) {
  const nav = useNavigate()
  const act = useActions()
  const { activities } = useState_()
  const [notes, setNotes] = useState(l.notes ?? '')
  const [name, setName] = useState(l.name)
  useEffect(() => { setNotes(l.notes ?? ''); setName(l.name) }, [l.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const sr = SHOWROOM_META[showroomFor(l.postcode)]
  const d = dealFromLead(l)
  const kwh = d.journey!.property.annualKwh
  const digits = (s?: string) => (s ?? '').replace(/\D/g, '').slice(-10)
  const dupes = deals.filter((x) => x.id !== l.pushedDealId && x.journey && ((l.phone && digits(x.journey.phone) === digits(l.phone)) || (l.email && x.journey.email === l.email)))
  const history = activities.filter((a) => a.leadId === l.id)
  const Line = ({ icon: I, children }: { icon: typeof Phone; children: React.ReactNode }) => <div className="flex items-start gap-2.5 text-[13px] text-ink-2 py-1.5"><I size={14} className="text-muted-3 mt-0.5 shrink-0" /><span className="min-w-0">{children}</span></div>
  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-[#15223B]/25" />
      <aside onClick={(e) => e.stopPropagation()} className="relative w-[640px] max-w-[92vw] h-full bg-[#F6F8FA] shadow-[0_0_60px_-10px_rgba(21,34,59,0.45)] flex flex-col">
        <div className="shrink-0 bg-[#15223B] text-white px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="w-12 h-12 rounded-full bg-[#62E4CC] text-[#15223B] text-[16px] font-extrabold flex items-center justify-center shrink-0">{l.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('')}</span>
            <div className="min-w-0 flex-1">
              <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== l.name && act.updateLeads([l.id], { name })} className="w-full bg-transparent text-[20px] font-bold outline-none focus:bg-white/10 rounded px-1 -mx-1" />
              <div className="text-[12.5px] text-white/70 mt-0.5">{l.source}{l.batch ? ` · ${l.batch.label}` : ''} · received {rel(l.createdAt)}</div>
              <div className="flex items-center gap-2 mt-2 flex-wrap"><StatusPill status={l.pushedDealId ? 'qualified' : l.status} /><span className="text-[11.5px] font-semibold rounded-full px-2 py-0.5 bg-white/10">Score {Math.round(l.score)}</span><span className="text-[11.5px] font-semibold rounded-full px-2 py-0.5 bg-white/10 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: sr.color }} />{sr.name} showroom</span></div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-[8px] hover:bg-white/10 text-white/80 flex items-center justify-center">✕</button>
          </div>
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {l.pushedDealId
              ? <button onClick={() => nav(`/deals/${l.pushedDealId}`)} className="h-9 px-4 rounded-[10px] bg-[#62E4CC] text-[#15223B] text-[13px] font-bold flex items-center gap-1.5"><ArrowUpRight size={14} />Open in pipeline</button>
              : <button onClick={onPush} className="h-9 px-4 rounded-[10px] bg-[#62E4CC] text-[#15223B] text-[13px] font-bold flex items-center gap-1.5"><ArrowUpRight size={14} />Push to pipeline</button>}
            {l.phone && <a href={`tel:${l.phone.replace(/\s/g, '')}`} onClick={() => act.updateLeads([l.id], { status: 'working', contactedAt: Date.now() })} className="h-9 px-3.5 rounded-[10px] bg-white/10 hover:bg-white/20 text-[13px] font-semibold flex items-center gap-1.5"><Phone size={14} />Call</a>}
            <button onClick={onCall} className="h-9 px-3.5 rounded-[10px] bg-white/10 hover:bg-white/20 text-[13px] font-semibold flex items-center gap-1.5"><Calendar size={14} />Queue call</button>
            <button onClick={() => { act.updateLeads([l.id], { status: 'unqualified' }); act.toast(`${l.name} marked unqualified`) }} className="h-9 px-3.5 rounded-[10px] bg-white/10 hover:bg-white/20 text-[13px] font-semibold">Unqualified</button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-5 grid grid-cols-2 gap-4 content-start">
          <Panel title="Contact" icon={Person}>
            {l.phone && <Line icon={Phone}><a href={`tel:${l.phone.replace(/\s/g, '')}`} className="font-semibold hover:underline">{l.phone}</a></Line>}
            {l.email && <Line icon={Envelope}><a href={`mailto:${l.email}`} className="hover:underline break-all">{l.email}</a></Line>}
            <Line icon={MapPin}><a href={`https://www.google.com/maps/search/${encodeURIComponent(`${l.address ?? l.company} ${l.postcode ?? ''}`)}`} target="_blank" rel="noreferrer" className="hover:underline">{l.address ?? l.company}{l.postcode ? `, ${l.postcode}` : ''}</a></Line>
          </Panel>
          <Panel title="What they want" icon={Sun}>
            <div className="grid grid-cols-2 gap-2">
              {[['Interested in', l.interest ?? '—'], ['Monthly bill', l.monthlyBill ? `£${l.monthlyBill}` : '—'], ['Est. usage', `${kwh.toLocaleString('en-GB')} kWh/yr`], ['Likely system', money(d.value, { compact: true })]].map(([k, v]) => <div key={k} className="rounded-[10px] bg-[#F7F9FB] border border-[#EEF1F5] px-3 py-2"><div className="text-[11px] text-muted-2">{k}</div><div className="text-[13.5px] font-bold text-ink mt-0.5">{v}</div></div>)}
            </div>
          </Panel>
          <Panel title="Notes" icon={Wrench} className="col-span-2">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (l.notes ?? '') && act.updateLeads([l.id], { notes })} rows={3} placeholder="What you learnt on the call…" />
          </Panel>
          <Panel title="Owner & qualification" icon={Target}>
            <Field label="Adviser"><Select value={l.owner} onChange={(e) => act.updateLeads([l.id], { owner: e.target.value })}>{[...new Set([l.owner, 'Jordan Miles', 'Amy Price', 'Beth Collins', 'Tom Hale', 'Rhys Evans', 'Kate Morris', 'Sophie Grant'])].map((o) => <option key={o}>{o}</option>)}</Select></Field>
            <div className="mt-3"><Field label="Status"><Select value={l.status} onChange={(e) => act.updateLeads([l.id], { status: e.target.value as LeadStatus })}>{LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_META[s].label}</option>)}</Select></Field></div>
          </Panel>
          <Panel title="Timeline" icon={Clock}>
            <div className="flex flex-col gap-2 text-[12.5px]">
              <div className="flex gap-2"><span className="w-2 h-2 rounded-full bg-[#2FBFA5] mt-1.5 shrink-0" /><span><b>Received</b> via {l.source} · {fmtDate(l.createdAt)}{l.batch?.file ? ` (${l.batch.file})` : ''}</span></div>
              {l.contactedAt && <div className="flex gap-2"><span className="w-2 h-2 rounded-full bg-[#15223B] mt-1.5 shrink-0" /><span><b>First contact</b> · {fmtDate(l.contactedAt)} — {Math.round((l.contactedAt - (l.createdAt ?? l.contactedAt)) / HOUR)}h after it came in</span></div>}
              {history.map((a) => <div key={a.id} className="flex gap-2"><span className="w-2 h-2 rounded-full bg-[#4A5A78] mt-1.5 shrink-0" /><span><b>{a.subject}</b> · {a.due ?? fmtDate(a.createdAt)}</span></div>)}
              {l.pushedDealId && <div className="flex gap-2"><span className="w-2 h-2 rounded-full bg-[#0E7A66] mt-1.5 shrink-0" /><span><b>Pushed to pipeline</b></span></div>}
            </div>
          </Panel>
          {dupes.length > 0 && (
            <div className="col-span-2 rounded-[12px] border border-[#E1E6EC] bg-white px-4 py-3 text-[12.5px] text-ink-2 flex items-center gap-2">
              <Check size={14} className="text-[#0E7A66]" />Already in the CRM as <button onClick={() => nav(`/deals/${dupes[0].id}`)} className="font-bold underline">{dupes[0].name}</button> ({dupes[0].won ? 'customer' : dupes[0].stage}) — check before pushing.
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

/* ---- CSV import: label the batch, map columns, preview, skip duplicates ---- */
const ADVISERS = ['Jordan Miles', 'Amy Price', 'Beth Collins', 'Tom Hale', 'Rhys Evans', 'Kate Morris', 'Sophie Grant']
function ImportBatchModal({ open, onClose, existing, onImported }: { open: boolean; onClose: () => void; existing: { phone?: string; email?: string }[]; onImported: (batchId: string) => void }) {
  const act = useActions()
  const file = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState(SOS)
  const [label, setLabel] = useState('')
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [owner, setOwner] = useState('Round robin')
  const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  useEffect(() => { if (open) { setText(''); setFileName(''); setSource(SOS); setLabel(`${SOS} · ${today()}`) } }, [open])
  const grid = useMemo(() => parseCsv(text), [text])
  const header = grid[0] ?? []
  const [map, setMap] = useState<Record<LeadFieldKey, number>>(autoMap([]))
  useEffect(() => setMap(autoMap(header)), [header.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  const digits = (s?: string) => (s ?? '').replace(/\D/g, '').slice(-10)
  const seenPhones = new Set(existing.map((e) => digits(e.phone)).filter(Boolean)), seenEmails = new Set(existing.map((e) => e.email?.toLowerCase()).filter(Boolean))
  const cell = (r: string[], k: LeadFieldKey) => (map[k] >= 0 ? (r[map[k]] ?? '').trim() : '')
  const rows = grid.slice(1).map((r) => ({ name: cell(r, 'name'), phone: cell(r, 'phone'), email: cell(r, 'email'), address: cell(r, 'address'), postcode: cell(r, 'postcode').toUpperCase(), monthlyBill: Number(cell(r, 'monthlyBill').replace(/[^\d.]/g, '')) || undefined, interest: cell(r, 'interest'), notes: cell(r, 'notes') })).filter((r) => r.name)
  const isDupe = (r: { phone: string; email: string }) => !!((r.phone && seenPhones.has(digits(r.phone))) || (r.email && seenEmails.has(r.email.toLowerCase())))
  const fresh = rows.filter((r) => !isDupe(r))
  if (!open) return null
  function doImport() {
    if (!fresh.length) return
    const now = Date.now(), id = `batch-${now}`
    const batch = { id, label: label.trim() || `${source} · ${today()}`, receivedAt: now, file: fileName || 'pasted.csv' }
    act.importLeadBatch(fresh.map((r, i) => ({ id: `${id}-${i}`, name: r.name, role: 'Homeowner', company: `${r.address}${r.postcode ? `, ${r.postcode}` : ''}`, address: r.address, postcode: r.postcode, phone: r.phone || undefined, email: r.email || undefined, monthlyBill: r.monthlyBill, interest: r.interest || undefined, notes: r.notes || undefined, source, owner: owner === 'Round robin' ? ADVISERS[i % ADVISERS.length] : owner, created: 'Just now', createdAt: now, score: Math.round(50 + Math.min(40, (r.monthlyBill ?? 100) / 6)), status: 'new' as const, batch })))
    onImported(id)
  }
  return (
    <Modal open onClose={onClose} title="Import a lead batch" subtitle="Upload the CSV from your lead supplier — every lead keeps its batch so you can track what it turns into"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={<Upload size={14} />} onClick={doImport}>{fresh.length ? `Import ${fresh.length} leads` : 'Import'}</Button></>}>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Source"><Select value={source} onChange={(e) => { setSource(e.target.value); setLabel(`${e.target.value} · ${today()}`) }}>{[SOS, 'Facebook lead ad', 'Google search', 'Website enquiry', 'Referral', 'Other supplier'].map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Batch name"><Input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
        <Field label="Assign to"><Select value={owner} onChange={(e) => setOwner(e.target.value)}>{['Round robin', ...ADVISERS].map((o) => <option key={o}>{o}</option>)}</Select></Field>
      </div>
      <div className="rounded-[12px] border-2 border-dashed border-[#D5DBE3] bg-[#F7F9FB] px-4 py-5 flex items-center gap-4">
        <span className="w-10 h-10 rounded-[11px] bg-[#15223B] text-[#62E4CC] flex items-center justify-center"><Upload size={18} /></span>
        <div className="flex-1 text-[13px] text-ink-2">{fileName ? <><b>{fileName}</b> · {rows.length} rows</> : <>Choose the CSV file — <button onClick={() => file.current?.click()} className="font-bold underline">browse</button> — or paste the rows below.</>}</div>
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`} download="lead-import-template.csv" className="text-[12px] font-semibold text-ink-3 hover:text-ink flex items-center gap-1"><Download size={13} />Template</a>
        <input ref={file} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { setText(String(rd.result || '')); setFileName(f.name) }; rd.readAsText(f) }} />
      </div>
      {!fileName && <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="…or paste CSV rows (with a header row) here" />}
      {header.length > 0 && (
        <>
          <div className="eyebrow text-muted-3">Match the columns</div>
          <div className="grid grid-cols-4 gap-2">
            {LEAD_FIELDS.map((f) => (
              <label key={f.key} className="text-[11.5px] text-muted-b flex flex-col gap-1">{f.label}
                <Select value={String(map[f.key])} onChange={(e) => setMap((m) => ({ ...m, [f.key]: Number(e.target.value) }))}><option value="-1">— not in file —</option>{header.map((h, i) => <option key={i} value={String(i)}>{h}</option>)}</Select>
              </label>
            ))}
          </div>
          <div className="rounded-[12px] border border-[#E6EAF0] overflow-hidden">
            <div className="px-3 py-2 bg-[#FAFBFC] text-[12px] text-ink-2 flex items-center gap-3"><b>{fresh.length} new leads</b>{rows.length - fresh.length > 0 && <span className="text-muted-b">{rows.length - fresh.length} already in the CRM — will be skipped</span>}</div>
            {rows.slice(0, 5).map((r, i) => <div key={i} className={classNames('px-3 py-1.5 border-t border-[#F0F2F5] text-[12px] grid grid-cols-[1.2fr_1fr_1.4fr_0.8fr] gap-2', isDupe(r) && 'text-muted-3 line-through')}><b className="truncate">{r.name}</b><span className="truncate">{r.phone}</span><span className="truncate">{r.address} {r.postcode}</span><span className="truncate">{r.interest}</span></div>)}
          </div>
        </>
      )}
    </Modal>
  )
}

/* ============================ Analytics ============================ */
const RANGES = ['This month', 'Last 3 months', 'Last 6 months', 'Custom'] as const
export function LeadsAnalytics() {
  const { deals, leads } = useState_()
  const tabs = useTabs('analytics')
  const [range, setRange] = useState<(typeof RANGES)[number]>('Last 3 months')
  const monthsAll = useMemo(() => Array.from({ length: 12 }, (_, i) => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - 11 + i, 1).getTime() }), [])
  const [from, setFrom] = useState(monthsAll[8]); const [to, setTo] = useState(monthsAll[11])
  const [cpl, setCpl] = useState<Record<string, number>>(() => { try { return { ...DEFAULT_CPL, ...JSON.parse(localStorage.getItem('shc.leads.cpl') || '{}') } } catch { return DEFAULT_CPL } })
  const setOneCpl = (s: string, v: number) => setCpl((c) => { const n = { ...c, [s]: v }; try { localStorage.setItem('shc.leads.cpl', JSON.stringify(n)) } catch { /* ignore */ } return n })
  const mStart = (n: number) => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - n, 1).getTime() }
  const [a, b] = range === 'This month' ? [mStart(0), Date.now()] : range === 'Last 3 months' ? [mStart(2), Date.now()] : range === 'Last 6 months' ? [mStart(5), Date.now()] : [from, new Date(new Date(to).getFullYear(), new Date(to).getMonth() + 1, 1).getTime() - 1]
  const span = b - a
  // every lead that became an enquiry is a deal with a dated journey; plus leads still in the inbox
  const at = (d: Deal, k: string) => d.journey?.steps.find((s) => s.key === k)?.at
  const enq = (d: Deal) => at(d, 'enquiry') ?? 0
  const inRange = (t: number, lo = a, hi = b) => t >= lo && t <= hi
  const all = deals.filter((d) => d.journey)
  const cur = all.filter((d) => inRange(enq(d)))
  const prev = all.filter((d) => inRange(enq(d), a - span, a - 1))
  const inbox = leads.filter((l) => !l.pushedDealId && !l.converted && inRange(l.createdAt ?? 0))
  // first response time: the recorded response on the enquiry ("35 min", "3 h"), else contact − enquiry
  const respH = (d: Deal): number | null => {
    const r = String(d.journey!.steps[0]?.data?.response ?? '')
    const m = r.match(/([\d.]+)\s*(min|h)/)
    if (m) return m[2] === 'min' ? Number(m[1]) / 60 : Number(m[1])
    const c = at(d, 'contacted'); return c ? (c - enq(d)) / HOUR : null
  }
  const fastList = cur.filter((d) => { const h = respH(d); return h != null && h <= 1 })
  const slowList = cur.filter((d) => { const h = respH(d); return h != null && h > 1 })
  const signed = cur.filter((d) => d.won)
  const revenue = signed.reduce((s, d) => s + d.value, 0)
  const cost = [...cur.map((d) => d.journey!.source), ...inbox.map((l) => l.source)].reduce((s, src) => s + (cpl[src] ?? 0), 0)
  const months = monthsAll.filter((m) => m >= new Date(new Date(a).getFullYear(), new Date(a).getMonth(), 1).getTime() && m <= b)
  const monthKey = (t: number) => `${new Date(t).getFullYear()}-${new Date(t).getMonth()}`
  const chart = months.map((m) => { const list = all.filter((d) => monthKey(enq(d)) === monthKey(m)); return { label: new Date(m).toLocaleDateString('en-GB', { month: 'short' }), value: list.length + leads.filter((l) => !l.pushedDealId && !l.converted && monthKey(l.createdAt ?? 0) === monthKey(m)).length, sub: `${list.filter((d) => d.won).length} went on to sign` } })
  const srcs = [...new Set([...cur.map((d) => d.journey!.source), ...inbox.map((l) => l.source)])]
  const srcRows = srcs.map((s) => {
    const list = cur.filter((d) => d.journey!.source === s), inb = inbox.filter((l) => l.source === s).length
    const n = list.length + inb, sg = list.filter((d) => d.won), rev = sg.reduce((x, d) => x + d.value, 0), c = n * (cpl[s] ?? 0)
    return { s, n, contacted: list.filter((d) => at(d, 'contacted')).length, cons: list.filter((d) => at(d, 'consultation')).length, signed: sg.length, rev, c, cps: sg.length ? c / sg.length : 0, roi: c ? rev / c : 0 }
  }).sort((x, y) => y.n - x.n)
  // Solar on Steroids batches (weekly CSVs) — what each batch turned into
  type BR = { label: string; t: number; n: number; contacted: number; cons: number; signed: number; rev: number }
  const batchMap = new Map<string, BR>()
  all.filter((d) => d.journey!.source === SOS && inRange(enq(d))).forEach((d) => { const lab = String(d.journey!.steps[0]?.data?.batch ?? 'Unbatched'); const r = batchMap.get(lab) ?? { label: lab, t: enq(d), n: 0, contacted: 0, cons: 0, signed: 0, rev: 0 }; r.n++; if (at(d, 'contacted')) r.contacted++; if (at(d, 'consultation')) r.cons++; if (d.won) { r.signed++; r.rev += d.value } r.t = Math.min(r.t, enq(d)); batchMap.set(lab, r) })
  inbox.filter((l) => l.batch).forEach((l) => { const r = batchMap.get(l.batch!.label) ?? { label: l.batch!.label, t: l.batch!.receivedAt, n: 0, contacted: 0, cons: 0, signed: 0, rev: 0 }; r.n++; if (l.contactedAt) r.contacted++; batchMap.set(l.batch!.label, r) })
  const batchRows = [...batchMap.values()].sort((x, y) => y.t - x.t)
  const speed = [['Under 15 min', 0, 0.25], ['15 min – 1 h', 0.25, 1], ['1 – 4 h', 1, 4], ['4 – 24 h', 4, 24], ['Over a day', 24, 1e9]] as const
  const MONTH_OPTS = monthsAll.map((m) => ({ v: m, l: new Date(m).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) }))
  const rate = (xs: Deal[]) => (xs.length ? Math.round((xs.filter((d) => d.won).length / xs.length) * 100) : 0)

  return (
    <>
      <TopBar title="Leads" crumbs={['Before the pipeline']} identity={{ icon: Bolt, accent: '#15223B' }} tabs={tabs}
        center={<div className="flex items-center gap-2"><Segmented options={[...RANGES]} value={range} onChange={(v) => setRange(v as typeof range)} />{range === 'Custom' && <><Dropdown value={String(from)} onChange={(e) => setFrom(Number(e.target.value))} className="h-9 px-3 rounded-[10px] bg-white text-[13px] font-semibold">{MONTH_OPTS.map((o) => <option key={o.v} value={String(o.v)}>{o.l}</option>)}</Dropdown><span className="text-[12px] font-semibold">to</span><Dropdown value={String(to)} onChange={(e) => setTo(Number(e.target.value))} className="h-9 px-3 rounded-[10px] bg-white text-[13px] font-semibold">{MONTH_OPTS.map((o) => <option key={o.v} value={String(o.v)}>{o.l}</option>)}</Dropdown></>}</div>} />
      <main className="flex-1 overflow-y-auto">
        <div className="px-7 py-6 flex flex-col gap-5 max-w-[1560px]">
          <div className="grid grid-cols-5 gap-4">
            <Kpi variant="navy" icon={Bolt} label="Leads in" value={String(cur.length + inbox.length)} delta={`${prev.length} the period before`} />
            <Kpi icon={Clock} label="Called within an hour" value={`${cur.length ? Math.round((fastList.length / cur.length) * 100) : 0}%`} meter={cur.length ? (fastList.length / cur.length) * 100 : 0} delta="speed to first contact" deltaTone="muted" />
            <Kpi icon={Target} label="Lead → signed" value={`${cur.length ? Math.round((signed.length / cur.length) * 100) : 0}%`} delta={`${signed.length} signed so far from these leads`} deltaTone="muted" />
            <Kpi icon={Dollar} label="Cost per sale" value={signed.length ? money(cost / signed.length, { compact: true }) : '—'} delta={`${money(cost, { compact: true })} lead spend`} deltaTone="muted" />
            <Kpi variant="teal" icon={Sun} label="Signed value" value={money(revenue, { compact: true })} delta={cost ? `${(revenue / cost).toFixed(1)}× return on lead spend` : 'no lead spend recorded'} />
          </div>
          <Panel title="Leads by month" sub="Every lead that came in, across all sources — with how many went on to sign" icon={Calendar}
            action={<span className="flex items-center gap-2 text-[12px] text-muted-b">vs previous period <Delta now={cur.length + inbox.length} prev={prev.length} /></span>}>
            <div className="mb-3"><Legend items={[{ label: 'Leads received', swatch: C.actual }]} /></div>
            <MonthColumns data={chart} fmt={(n) => String(Math.round(n))} height={210} />
          </Panel>
          <Panel title="Sources — volume, conversion and return" sub="Set what each lead costs you to see cost per sale and return" icon={Layers} pad={false}>
            <div className="p-4">
              <DataTable
                cols={[{ label: 'Source', w: 'minmax(150px,1.4fr)' }, { label: 'Leads', align: 'right' }, { label: 'Contacted', align: 'right' }, { label: 'Consultation', align: 'right' }, { label: 'Signed', align: 'right' }, { label: 'Lead → signed', align: 'right' }, { label: 'Signed £', align: 'right' }, { label: '£ per lead', align: 'right', w: '96px' }, { label: 'Cost per sale', align: 'right' }, { label: 'Return', align: 'right' }]}
                rows={srcRows.map((r) => [
                  <b key="s" className={r.s === SOS ? 'text-[#15223B]' : ''}>{r.s}</b>, r.n, `${r.n ? Math.round((r.contacted / r.n) * 100) : 0}%`, `${r.n ? Math.round((r.cons / r.n) * 100) : 0}%`, r.signed, `${r.n ? Math.round((r.signed / r.n) * 100) : 0}%`, money(r.rev, { compact: true }),
                  <input key="c" type="number" value={cpl[r.s] ?? 0} onChange={(e) => setOneCpl(r.s, Number(e.target.value) || 0)} className="w-16 h-7 px-1.5 text-right rounded-[6px] border border-[#E1E6EC] text-[12px] font-semibold outline-none focus:border-accent-400" />,
                  r.cps ? money(r.cps, { compact: true }) : '—', r.roi ? <b key="r">{r.roi.toFixed(1)}×</b> : '—',
                ])}
              />
            </div>
          </Panel>
          <div className="grid grid-cols-[1.4fr_1fr] gap-5">
            <Panel title="Solar on Steroids — batch by batch" sub="Each weekly CSV and what it's turned into so far" icon={Layers} pad={false}>
              <div className="p-4">
                <DataTable cols={[{ label: 'Batch', w: 'minmax(170px,1.6fr)' }, { label: 'Leads', align: 'right' }, { label: 'Contacted', align: 'right' }, { label: 'Consultation', align: 'right' }, { label: 'Signed', align: 'right' }, { label: 'Signed £', align: 'right' }, { label: 'Cost', align: 'right' }, { label: 'Return', align: 'right' }]}
                  rows={batchRows.slice(0, 14).map((r) => { const c = r.n * (cpl[SOS] ?? 0); return [<b key="b">{r.label.replace(`${SOS} · `, 'w/c ')}</b>, r.n, r.contacted, r.cons, r.signed, money(r.rev, { compact: true }), money(c, { compact: true }), c ? `${(r.rev / c).toFixed(1)}×` : '—'] })} />
              </div>
            </Panel>
            <Panel title="Speed to first contact" sub="How quickly leads got a call — the biggest lever on conversion" icon={Phone}>
              <HBars data={speed.map(([label, lo, hi]) => ({ label, value: cur.filter((d) => { const h = respH(d); return h != null && h >= lo && h < hi }).length }))} fmt={String} color="#15223B" />
              <div className="mt-4 text-[12.5px] text-muted-b">Leads called inside an hour sign at <b className="text-ink">{rate(fastList)}%</b>, against <b className="text-ink">{rate(slowList)}%</b> for slower ones.</div>
            </Panel>
          </div>
        </div>
      </main>
    </>
  )
}
