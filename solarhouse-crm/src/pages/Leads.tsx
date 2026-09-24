import { useState, useRef, useMemo, useEffect } from 'react'
import { TopBar } from '../components/TopBar'
import { Button, Segmented, Kpi, Avatar } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Modal, Field, Input, Textarea } from '../components/overlays'
import { Plus, Download, Check, ArrowUpRight, Search, Phone, Envelope, Note, Sparkle, Target } from '../components/icons'
import { ScorePill } from '../components/ai-widgets'
import { leadScore, leadNextAction } from '../lib/intelligence'
import { useState_, useActions, useSelectors } from '../store/store'
import { LEAD_STATUSES, type Lead, type LeadStatus } from '../store/types'
import { classNames, money } from '../lib/format'
import { useNavigate } from 'react-router-dom'
import { Dropdown } from '../components/Dropdown'

export const LEAD_STATUS_META: Record<LeadStatus, { label: string; tone: string; dot: string }> = {
  new: { label: 'New', tone: 'text-[#0A5A4C] bg-[#D6F7F0]', dot: '#2FBFA5' },
  working: { label: 'Working', tone: 'text-[#15223B] bg-[#E9EDF4]', dot: '#15223B' },
  nurturing: { label: 'Nurturing', tone: 'text-[#4A5A78] bg-[#EDF0F5]', dot: '#4A5A78' },
  qualified: { label: 'Qualified', tone: 'text-[#0A5A4C] bg-[#E1F6F1]', dot: '#0E7A66' },
  unqualified: { label: 'Unqualified', tone: 'text-muted-2 bg-control', dot: '#8A93A3' },
}
function StatusPill({ status }: { status: LeadStatus }) {
  const m = LEAD_STATUS_META[status]
  return <span className={classNames('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold', m.tone)}><span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />{m.label}</span>
}

export function Leads() {
  const { leads } = useState_()
  const act = useActions()
  const [view, setView] = useState('Inbox')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [showNew, setShowNew] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [drawerId, setDrawerId] = useState<string | null>(null)
  // filters
  const [source, setSource] = useState('All sources')
  const [owner, setOwner] = useState('All owners')
  const [minScore, setMinScore] = useState(0)
  const [timeframe, setTimeframe] = useState('All time')
  const [query, setQuery] = useState('')
  const template = '28px 1.9fr 1.4fr 1fr 1fr 0.9fr 0.7fr 0.5fr'

  const now = Date.now()
  const inTime = (ts?: number) => {
    if (timeframe === 'All time' || !ts) return timeframe === 'All time'
    const win = timeframe === '24 hours' ? 86_400_000 : timeframe === '7 days' ? 7 * 86_400_000 : 30 * 86_400_000
    return ts >= now - win
  }
  const q = query.trim().toLowerCase()
  const visible = leads
    .filter((l) => (view === 'Inbox' ? !l.archived : l.archived))
    .filter((l) => source === 'All sources' || l.source === source)
    .filter((l) => owner === 'All owners' || l.owner === owner)
    .filter((l) => l.score >= minScore)
    .filter((l) => (timeframe === 'All time' ? true : inTime(l.createdAt)))
    .filter((l) => !q || l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q) || l.role.toLowerCase().includes(q))
  const allSel = visible.length > 0 && sel.size === visible.length
  const owners = [...new Set(leads.map((l) => l.owner))]
  const activeFilterCount = (source !== 'All sources' ? 1 : 0) + (owner !== 'All owners' ? 1 : 0) + (minScore > 0 ? 1 : 0) + (timeframe !== 'All time' ? 1 : 0) + (q ? 1 : 0)
  const clearFilters = () => { setSource('All sources'); setOwner('All owners'); setMinScore(0); setTimeframe('All time'); setQuery('') }

  const filters = [
    { label: 'All open leads', count: leads.filter((l) => !l.archived).length, active: view === 'Inbox' && minScore === 0 },
    { label: 'High score (≥75)', count: leads.filter((l) => !l.archived && l.score >= 75).length, active: minScore === 75 },
    { label: 'Archived', count: leads.filter((l) => l.archived).length, active: view === 'Archived' },
  ]
  const sources = [...new Set(leads.map((l) => l.source))].map((s) => ({ label: s, count: leads.filter((l) => l.source === s && !l.archived).length })).filter((s) => s.count > 0)
  const openLeads = leads.filter((l) => !l.archived)
  const avgScore = Math.round(openLeads.reduce((s, l) => s + l.score, 0) / Math.max(1, openLeads.length))

  function toggle(id: string) {
    setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function bulkConvert() {
    visible.filter((l) => sel.has(l.id)).forEach((l) => act.convertLead(l))
    setSel(new Set())
  }
  function bulkArchive() {
    visible.filter((l) => sel.has(l.id)).forEach((l) => act.archiveLead(l.id, l.name))
    setSel(new Set())
  }

  return (
    <>
      <TopBar
        title="Leads"
        center={<Segmented options={['Inbox', 'Archived']} value={view} onChange={setView} />}
        actions={<><Button icon={<Download size={16} />} onClick={() => setShowImport(true)}>Import</Button><Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowNew(true)}>Add lead</Button></>}
      />
      <ImportLeadsModal open={showImport} onClose={() => setShowImport(false)} />
      <div className="flex-1 flex min-h-0">
        <aside className="w-[212px] shrink-0 bg-surface border-r border-border p-4 overflow-y-auto flex flex-col gap-5">
          <div>
            <div className="eyebrow text-muted-3 mb-2">Saved filters</div>
            <div className="flex flex-col gap-0.5">
              {filters.map((f) => (
                <button key={f.label} onClick={() => { if (f.label === 'Archived') { setView('Archived') } else if (f.label === 'High score (≥75)') { setView('Inbox'); setMinScore(75) } else { setView('Inbox'); setMinScore(0) } }} className={classNames('flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px]', f.active ? 'bg-[#D6F7F0] text-[#15223B] font-semibold' : 'text-ink-3 hover:bg-control')}>
                  <span>{f.label}</span><span className={f.active ? 'text-[#15223B]' : 'text-muted-3'}>{f.count}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="eyebrow text-muted-3 mb-2">Sources</div>
            <div className="flex flex-col gap-0.5">
              <button onClick={() => setSource('All sources')} className={classNames('flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px]', source === 'All sources' ? 'bg-[#D6F7F0] text-[#15223B] font-semibold' : 'text-ink-3 hover:bg-control')}><span>All sources</span><span className={source === 'All sources' ? 'text-[#15223B]' : 'text-muted-3'}>{leads.filter((l) => !l.archived).length}</span></button>
              {sources.map((s) => (
                <button key={s.label} onClick={() => setSource(s.label)} className={classNames('flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px]', source === s.label ? 'bg-[#D6F7F0] text-[#15223B] font-semibold' : 'text-ink-3 hover:bg-control')}>
                  <span className="truncate">{s.label}</span><span className={source === s.label ? 'text-[#15223B]' : 'text-muted-3'}>{s.count}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-7 flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-4">
            {/* hierarchy: navy = the headline, plain = the quality read, teal = the outcome */}
            <Kpi variant="navy" icon={Envelope} label="Open leads" value={String(leads.filter((l) => !l.archived).length)} delta="Waiting in your inbox" />
            <Kpi icon={Target} label="Avg. lead score" value={String(avgScore)} meter={avgScore} meterMark={60} delta={avgScore >= 60 ? 'Above the qualified line (60)' : 'Below the qualified line (60)'} deltaTone={avgScore >= 60 ? 'positive' : 'negative'} />
            <Kpi variant="teal" icon={ArrowUpRight} label="Converted" value={String(leads.filter((l) => l.converted).length)} delta="Now deals + contacts" />
          </div>

          {/* filter bar — one row: search + pickers on the left, time and score switches grouped with labels */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <label className="h-9 flex-1 min-w-[220px] max-w-[340px] flex items-center gap-2 px-3 rounded-[10px] border border-[#E1E6EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)] focus-within:border-accent-400">
              <Search size={15} className="text-muted-3 shrink-0" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, company…" className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-ink-2 placeholder:text-muted-3" />
            </label>
            <Dropdown value={source} onChange={(e) => setSource(e.target.value)} className="h-9 px-3 rounded-[10px] border border-[#E1E6EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)] text-[13px] font-semibold text-ink-3 outline-none">
              <option>All sources</option>
              {sources.map((s) => (<option key={s.label}>{s.label}</option>))}
            </Dropdown>
            <Dropdown value={owner} onChange={(e) => setOwner(e.target.value)} className="h-9 px-3 rounded-[10px] border border-[#E1E6EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)] text-[13px] font-semibold text-ink-3 outline-none">
              <option>All owners</option>
              {owners.map((o) => (<option key={o}>{o}</option>))}
            </Dropdown>
            <div className="flex items-center gap-2 ml-auto">
              <span className="eyebrow text-muted-3">Created</span>
              <Segmented options={['All time', '24 hours', '7 days', '30 days']} value={timeframe} onChange={setTimeframe} />
              <span className="eyebrow text-muted-3 ml-2">Score</span>
              <Segmented options={['Any', '60+', '75+']} value={minScore === 0 ? 'Any' : minScore === 60 ? '60+' : '75+'} onChange={(v) => setMinScore(v === 'Any' ? 0 : v === '60+' ? 60 : 75)} />
            </div>
            {activeFilterCount > 0 && <button onClick={clearFilters} className="text-[12.5px] text-accent font-semibold">Clear filters ({activeFilterCount})</button>}
          </div>

          {sel.size > 0 && (
            <div className="flex items-center gap-3 bg-accent-wash-3 border border-[#D3E0FA] rounded-control px-4 py-2.5 text-[13px]">
              <span className="font-semibold text-accent-700">{sel.size} selected</span>
              <Button variant="primary" icon={<ArrowUpRight size={15} />} onClick={bulkConvert}>Convert to deal</Button>
              <Button color="#B01B4F" onClick={bulkArchive}>Archive</Button>
              <button className="ml-auto text-[13px] text-muted-b" onClick={() => setSel(new Set())}>Clear</button>
            </div>
          )}

          <Table
            template={template}
            columns={[
              { key: 'c', header: <Checkbox checked={allSel} onClick={() => setSel(allSel ? new Set() : new Set(visible.map((l) => l.id)))} /> },
              { key: 'lead', header: 'Lead' }, { key: 'company', header: 'Company' }, { key: 'source', header: 'Source' }, { key: 'status', header: 'Status' }, { key: 'created', header: 'Created' }, { key: 'score', header: 'Score', align: 'right' }, { key: 'act', header: '' },
            ]}
            footer={<><span>{visible.length} leads</span><span className="flex gap-3"><button>Prev</button><button className="text-ink-3 font-medium">Next</button></span></>}
          >
            {visible.map((l) => (
              <Row key={l.id} template={template} highlight={sel.has(l.id)} onClick={() => setDrawerId(l.id)}>
                <Cell><Checkbox checked={sel.has(l.id)} onClick={() => toggle(l.id)} /></Cell>
                <Cell><div className="flex items-center gap-2.5"><Avatar name={l.name} size={30} /><div className="min-w-0"><div className="font-semibold text-ink-2 truncate">{l.name}</div><div className="text-[12px] text-muted-2">{l.role}</div></div></div></Cell>
                <Cell className="text-ink-2 font-medium">{l.company}</Cell>
                <Cell muted>{l.source}</Cell>
                <Cell><StatusPill status={l.status} /></Cell>
                <Cell muted>{l.created}</Cell>
                <Cell align="right"><span className="inline-flex justify-end"><ScorePill score={leadScore(l)} /></span></Cell>
                <Cell align="right">{view === 'Inbox' && !l.converted && <button onClick={(e) => { e.stopPropagation(); act.convertLead(l) }} title="Convert to deal" className="text-accent hover:bg-accent-wash rounded-md p-1"><ArrowUpRight size={16} /></button>}</Cell>
              </Row>
            ))}
          </Table>
        </main>
      </div>

      <NewLeadModal open={showNew} onClose={() => setShowNew(false)} onCreate={(p) => { act.addLead(p); setShowNew(false) }} />
      <LeadDrawer leadId={drawerId} onClose={() => setDrawerId(null)} />
    </>
  )
}

const KIND_ICON = { call: Phone, email: Envelope, task: Note, convert: ArrowUpRight, archive: Check } as const

function LeadDrawer({ leadId, onClose }: { leadId: string | null; onClose: () => void }) {
  const { leads } = useState_()
  const sel = useSelectors()
  const act = useActions()
  const nav = useNavigate()
  const lead = leads.find((l) => l.id === leadId)
  const [tab, setTab] = useState<'Note' | 'Call' | 'Email'>('Note')
  const [draft, setDraft] = useState('')
  useEffect(() => { setDraft(''); setTab('Note') }, [leadId])
  if (!lead) return null

  const timeline = sel.leadActivities(lead.id)
  const nba = leadNextAction(lead, timeline.length)
  const NbaIcon = KIND_ICON[nba.kind]

  function log() {
    if (!draft.trim()) return
    const map = { Note: 'note', Call: 'call', Email: 'email' } as const
    act.logActivity({ type: map[tab], subject: draft.slice(0, 80), body: draft, leadId: lead!.id, done: tab !== 'Email', source: 'manual' }, `${tab} logged on ${lead!.name}`)
    setDraft('')
  }
  function runNba() {
    if (nba.kind === 'convert') { const d = act.convertLead(lead!); onClose(); nav(`/deals/${d.id}`); return }
    if (nba.kind === 'archive') { act.archiveLead(lead!.id, lead!.name); onClose(); return }
    const map = { call: 'call', email: 'email', task: 'task' } as const
    act.logActivity({ type: map[nba.kind as 'call' | 'email' | 'task'], subject: nba.title, body: nba.rationale, leadId: lead!.id, due: 'Today', priority: 'High', done: false, source: 'ai' }, `Ovi added: ${nba.title}`)
  }

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-[rgba(11,18,32,0.35)] backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-[440px] max-w-[calc(100vw-24px)] h-full bg-canvas shadow-modal border-l border-border flex flex-col animate-[slidein_.18s_ease-out]">
        {/* header */}
        <div className="shrink-0 bg-surface border-b border-border px-5 py-4 flex items-start gap-3">
          <Avatar name={lead.name} size={44} />
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-bold text-ink truncate">{lead.name}</div>
            <div className="text-[13px] text-muted-b truncate">{lead.role || '—'} · {lead.company}</div>
          </div>
          <ScorePill score={leadScore(lead)} />
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-2 hover:bg-control text-[18px] leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {/* status stepper */}
          <div>
            <div className="eyebrow text-muted-3 mb-2">Lifecycle status</div>
            <div className="flex flex-wrap gap-1.5">
              {LEAD_STATUSES.map((s) => {
                const on = lead.status === s
                const m = LEAD_STATUS_META[s]
                return (
                  <button key={s} onClick={() => act.setLeadStatus(lead.id, s, lead.name)} className={classNames('px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors', on ? 'text-white border-transparent' : 'text-ink-3 border-border hover:bg-control')} style={on ? { background: m.dot } : undefined}>{m.label}</button>
                )
              })}
            </div>
          </div>

          {/* Ovi recommendation */}
          <div className="rounded-card bg-deep-panel p-4">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: '#57C9B4' }}><Sparkle size={14} /> OVI RECOMMENDS</div>
            <div className="text-[14px] font-bold text-white mt-1.5">{nba.title}</div>
            <div className="text-[12.5px] leading-relaxed mt-1" style={{ color: '#A7E6DA' }}>{nba.rationale}</div>
            <button onClick={runNba} className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white bg-accent-gradient shadow-primary rounded-lg px-3 py-1.5"><NbaIcon size={14} /> {nba.kind === 'convert' ? 'Convert now' : nba.kind === 'archive' ? 'Archive lead' : 'Do it'}</button>
          </div>

          {/* details */}
          <div className="bg-surface border border-border rounded-card p-4 grid grid-cols-2 gap-y-2.5 gap-x-3">
            <Detail label="Status" node={<StatusPill status={lead.status} />} />
            <Detail label="Source" value={lead.source} />
            <Detail label="Owner" value={lead.owner} />
            <Detail label="Created" value={lead.created} />
            <Detail label="Email" value={lead.email || `${lead.name.split(' ')[0].toLowerCase()}@${lead.company.split(' ')[0].toLowerCase()}.com`} />
            <Detail label="Phone" value={lead.phone || '—'} />
            {lead.value != null && <Detail label="Est. value" value={money(lead.value)} />}
          </div>

          {/* activity composer */}
          <div className="bg-surface border border-border rounded-card p-4">
            <div className="flex gap-4 border-b border-divider -mx-4 px-4 pb-2 mb-3">
              {(['Note', 'Call', 'Email'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={classNames('text-[13px] pb-1.5 -mb-[9px] border-b-2 transition-colors', tab === t ? 'border-accent text-ink font-semibold' : 'border-transparent text-muted-b hover:text-ink-3')}>{t}</button>
              ))}
            </div>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Log a ${tab.toLowerCase()} on this lead…`} className="w-full h-[60px] resize-none outline-none text-[13px] text-ink-2 placeholder:text-muted-3 bg-transparent" />
            <div className="flex justify-end"><Button variant="primary" onClick={log}>Log {tab.toLowerCase()}</Button></div>
          </div>

          {/* timeline */}
          <div>
            <div className="eyebrow text-muted-3 mb-2">History · {timeline.length}</div>
            {timeline.length === 0 && <div className="text-[13px] text-muted-2">No context yet — log a note, call or email above to start building the lead's history.</div>}
            <div className="flex flex-col gap-3">
              {timeline.map((t) => (
                <div key={t.id} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-accent-wash text-accent flex items-center justify-center shrink-0 mt-0.5">{t.source === 'ai' ? <Sparkle size={12} /> : <Note size={12} />}</span>
                  <div className="min-w-0"><div className="text-[13px] font-semibold text-ink-2">{t.subject}</div>{t.body && <div className="text-[12.5px] text-muted leading-relaxed mt-0.5">{t.body}</div>}<div className="text-[11.5px] text-muted-3 mt-0.5">{t.who}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* footer actions */}
        <div className="shrink-0 border-t border-border bg-surface px-5 py-3.5 flex items-center gap-2">
          {!lead.converted ? (
            <Button variant="primary" icon={<ArrowUpRight size={16} />} onClick={() => { const d = act.convertLead(lead); onClose(); nav(`/deals/${d.id}`) }}>Convert to deal</Button>
          ) : (
            <span className="text-[13px] text-positive font-semibold flex items-center gap-1.5"><Check size={15} /> Converted to a deal</span>
          )}
          {!lead.archived && <Button color="#B01B4F" onClick={() => { act.archiveLead(lead.id, lead.name); onClose() }}>Archive</Button>}
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value, node }: { label: string; value?: string; node?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] text-muted-2">{label}</span>
      {node ?? <span className="text-[13px] font-medium text-ink-2 truncate">{value}</span>}
    </div>
  )
}

export function Checkbox({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick() }} className="w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center transition-colors" style={{ borderColor: checked ? '#13927B' : '#C3CBD8', background: checked ? '#13927B' : 'transparent' }}>
      {checked && <Check size={12} className="text-white" strokeWidth={2.4} />}
    </button>
  )
}

function NewLeadModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (p: Partial<Lead> & { name: string; company: string }) => void }) {
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [score, setScore] = useState('70')
  const valid = name.trim() && company.trim()
  return (
    <Modal open={open} onClose={onClose} title="Add lead" subtitle="Capture a new inbound opportunity" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => valid && onCreate({ name, company, role, score: Number(score) || 60, source: 'Manual' })}>Add lead</Button></>}>
      <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus /></Field>
      <Field label="Company"><Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role"><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Job title" /></Field>
        <Field label="Score"><Input type="number" value={score} onChange={(e) => setScore(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

/** Minimal RFC-4180-ish CSV/TSV parser: handles quoted fields, escaped quotes, and \r\n. */
function parseDelimited(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQ = false
  const push = () => { row.push(field); field = '' }
  const endRow = () => { push(); if (row.some((c) => c.trim() !== '')) rows.push(row); row = [] }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false }
      else field += c
    } else if (c === '"') inQ = true
    else if (c === ',' || c === '\t') push()
    else if (c === '\n') endRow()
    else if (c === '\r') { if (text[i + 1] === '\n') i++; endRow() }
    else field += c
  }
  if (field !== '' || row.length) endRow()
  return rows.map((r) => r.map((c) => c.trim()))
}

type MapKey = 'name' | 'company' | 'role' | 'score'
const HEADER_HINTS: Record<MapKey, string[]> = {
  name: ['name', 'full name', 'contact', 'lead'],
  company: ['company', 'organisation', 'organization', 'account', 'business'],
  role: ['role', 'title', 'job', 'position'],
  score: ['score', 'rating'],
}

function ImportLeadsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const act = useActions()
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')

  const grid = useMemo(() => parseDelimited(text), [text])
  // Treat the first row as a header if any cell matches a known column name.
  const firstRowIsHeader = useMemo(() => {
    if (grid.length < 2) return false
    const all = Object.values(HEADER_HINTS).flat()
    return grid[0].some((c) => all.some((hint) => c.toLowerCase().includes(hint)))
  }, [grid])
  const headers = firstRowIsHeader ? grid[0] : grid[0]?.map((_, i) => `Column ${i + 1}`) ?? []
  const dataRows = firstRowIsHeader ? grid.slice(1) : grid

  // Auto-map columns from the header, else fall back to position (0=name,1=company,2=role).
  const autoMap = useMemo<Record<MapKey, number>>(() => {
    const m: Record<MapKey, number> = { name: 0, company: 1, role: 2, score: -1 }
    if (firstRowIsHeader) {
      ;(Object.keys(HEADER_HINTS) as MapKey[]).forEach((k) => {
        const idx = grid[0].findIndex((h) => HEADER_HINTS[k].some((hint) => h.toLowerCase().includes(hint)))
        m[k] = idx
      })
    }
    return m
  }, [grid, firstRowIsHeader])
  const [map, setMap] = useState<Record<MapKey, number>>(autoMap)
  // Re-sync mapping whenever the parsed shape changes (new paste / new file).
  const mapKey = `${headers.join('|')}·${firstRowIsHeader}`
  useEffect(() => { setMap(autoMap) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mapKey])

  const at = (row: string[], k: MapKey) => (map[k] >= 0 ? (row[map[k]] ?? '').trim() : '')
  const parsed = dataRows
    .map((r) => ({ name: at(r, 'name'), company: at(r, 'company') || '—', role: at(r, 'role'), score: Math.min(100, Math.max(0, Number(at(r, 'score')) || 65)) }))
    .filter((p) => p.name)

  function loadFile(f?: File) {
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => { setText(String(reader.result || '')); setFileName(f.name) }
    reader.readAsText(f)
  }

  const cols = headers.length
  const colOptions = [{ i: -1, label: '— none —' }, ...headers.map((h, i) => ({ i, label: h }))]

  return (
    <Modal open={open} onClose={onClose} title="Import leads" width={620}
      subtitle="Upload a CSV or paste rows — map the columns, then import"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { if (parsed.length) { act.bulkAddLeads(parsed, 'CSV import'); act.toast(`Imported ${parsed.length} lead${parsed.length === 1 ? '' : 's'}`); setText(''); setFileName(''); onClose() } }}>Import {parsed.length || ''} lead{parsed.length === 1 ? '' : 's'}</Button></>}>
      <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={(e) => loadFile(e.target.files?.[0])} />
      <button
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); loadFile(e.dataTransfer.files?.[0]) }}
        className="w-full rounded-control border border-dashed border-input-border bg-surface-tint hover:border-accent hover:bg-accent-wash/40 transition-colors py-4 flex flex-col items-center gap-1 text-center"
      >
        <Download size={18} className="text-accent rotate-180" />
        <span className="text-[13px] font-medium text-ink-2">{fileName || 'Choose a CSV file or drag it here'}</span>
        <span className="text-[11.5px] text-muted-2">Headers are detected automatically · or paste below</span>
      </button>

      <Field label="…or paste rows (CSV / TSV)"><Textarea rows={5} value={text} onChange={(e) => { setText(e.target.value); setFileName('') }} placeholder={'name, company, role\nJane Smith, Acme Solar, Director\nTom Reyes, Sunhill Renewables, Ops Manager'} /></Field>

      {cols > 0 && (
        <div className="rounded-control border border-border bg-surface p-3 flex flex-col gap-3">
          <div className="text-[12px] font-semibold text-ink-3">Match your columns</div>
          <div className="grid grid-cols-2 gap-2.5">
            {(['name', 'company', 'role', 'score'] as MapKey[]).map((k) => (
              <label key={k} className="flex items-center justify-between gap-2 text-[12.5px]">
                <span className="text-muted-2 capitalize">{k}{k === 'name' ? ' *' : ''}</span>
                <Dropdown value={map[k]} onChange={(e) => setMap((m) => ({ ...m, [k]: Number(e.target.value) }))} className="h-8 px-2 rounded-control border border-input-border bg-white text-[12.5px] text-ink-2 outline-none focus:border-accent max-w-[62%]">
                  {colOptions.map((o) => (<option key={o.i} value={o.i}>{o.label}</option>))}
                </Dropdown>
              </label>
            ))}
          </div>
          {parsed.length > 0 && (
            <div className="text-[11.5px] text-muted-2 leading-relaxed border-t border-divider pt-2">
              <span className="font-semibold text-ink-3">Preview:</span> {parsed.slice(0, 3).map((p) => `${p.name}${p.company !== '—' ? ` · ${p.company}` : ''}`).join('  •  ')}{parsed.length > 3 ? ` …+${parsed.length - 3} more` : ''}
            </div>
          )}
        </div>
      )}

      <div className="text-[12px] text-muted-2">{parsed.length} lead{parsed.length === 1 ? '' : 's'} ready to import{map.name < 0 ? ' — map the Name column first' : ''}.</div>
    </Modal>
  )
}
