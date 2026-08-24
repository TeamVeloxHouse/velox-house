import { useState } from 'react'
import { TopBar } from '../components/TopBar'
import { Button, Segmented, Kpi, Avatar } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Modal, Field, Input, Textarea } from '../components/overlays'
import { Plus, Download, Check, ArrowUpRight, Search } from '../components/icons'
import { ScorePill } from '../components/ai-widgets'
import { leadScore } from '../lib/intelligence'
import { useState_, useActions } from '../store/store'
import type { Lead } from '../store/types'
import { classNames } from '../lib/format'

export function Leads() {
  const { leads } = useState_()
  const act = useActions()
  const [view, setView] = useState('Inbox')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [showNew, setShowNew] = useState(false)
  const [showImport, setShowImport] = useState(false)
  // filters
  const [source, setSource] = useState('All sources')
  const [owner, setOwner] = useState('All owners')
  const [minScore, setMinScore] = useState(0)
  const [timeframe, setTimeframe] = useState('All time')
  const [query, setQuery] = useState('')
  const template = '28px 2fr 1.5fr 1fr 1fr 1fr 0.8fr 0.6fr'

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
                <button key={f.label} onClick={() => { if (f.label === 'Archived') { setView('Archived') } else if (f.label === 'High score (≥75)') { setView('Inbox'); setMinScore(75) } else { setView('Inbox'); setMinScore(0) } }} className={classNames('flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px]', f.active ? 'bg-accent-wash-2 text-accent-700 font-semibold' : 'text-ink-3 hover:bg-control')}>
                  <span>{f.label}</span><span className={f.active ? 'text-accent-700' : 'text-muted-3'}>{f.count}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="eyebrow text-muted-3 mb-2">Sources</div>
            <div className="flex flex-col gap-0.5">
              <button onClick={() => setSource('All sources')} className={classNames('flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px]', source === 'All sources' ? 'bg-accent-wash-2 text-accent-700 font-semibold' : 'text-ink-3 hover:bg-control')}><span>All sources</span><span className={source === 'All sources' ? 'text-accent-700' : 'text-muted-3'}>{leads.filter((l) => !l.archived).length}</span></button>
              {sources.map((s) => (
                <button key={s.label} onClick={() => setSource(s.label)} className={classNames('flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px]', source === s.label ? 'bg-accent-wash-2 text-accent-700 font-semibold' : 'text-ink-3 hover:bg-control')}>
                  <span className="truncate">{s.label}</span><span className={source === s.label ? 'text-accent-700' : 'text-muted-3'}>{s.count}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-7 flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-4">
            <Kpi label="Open leads" value={String(leads.filter((l) => !l.archived).length)} delta="In your inbox" deltaTone="muted" />
            <Kpi label="Avg. lead score" value={String(Math.round(leads.filter((l) => !l.archived).reduce((s, l) => s + l.score, 0) / Math.max(1, leads.filter((l) => !l.archived).length)))} delta="Qualified threshold 60" deltaTone="muted" />
            <Kpi variant="blue" label="Converted" value={String(leads.filter((l) => l.converted).length)} delta="To deals + contacts" />
          </div>

          {/* filter bar */}
          <div className="flex items-center gap-2 flex-wrap bg-surface border border-border rounded-card px-3 py-2.5">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-3" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, company…" className="h-8 pl-8 pr-3 rounded-control border border-input-border bg-white text-[12.5px] text-ink-2 outline-none focus:border-accent w-52" />
            </div>
            <select value={source} onChange={(e) => setSource(e.target.value)} className="h-8 px-2.5 rounded-control border border-input-border bg-white text-[12.5px] text-ink-2 outline-none focus:border-accent">
              <option>All sources</option>
              {sources.map((s) => (<option key={s.label}>{s.label}</option>))}
            </select>
            <select value={owner} onChange={(e) => setOwner(e.target.value)} className="h-8 px-2.5 rounded-control border border-input-border bg-white text-[12.5px] text-ink-2 outline-none focus:border-accent">
              <option>All owners</option>
              {owners.map((o) => (<option key={o}>{o}</option>))}
            </select>
            <Segmented options={['All time', '24 hours', '7 days', '30 days']} value={timeframe} onChange={setTimeframe} />
            <Segmented options={['Any', '60+', '75+']} value={minScore === 0 ? 'Any' : minScore === 60 ? '60+' : '75+'} onChange={(v) => setMinScore(v === 'Any' ? 0 : v === '60+' ? 60 : 75)} />
            {activeFilterCount > 0 && <button onClick={clearFilters} className="ml-auto text-[12.5px] text-accent font-semibold">Clear filters ({activeFilterCount})</button>}
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
              { key: 'lead', header: 'Lead' }, { key: 'company', header: 'Company' }, { key: 'source', header: 'Source' }, { key: 'owner', header: 'Owner' }, { key: 'created', header: 'Created' }, { key: 'score', header: 'Score', align: 'right' }, { key: 'act', header: '' },
            ]}
            footer={<><span>{visible.length} leads</span><span className="flex gap-3"><button>Prev</button><button className="text-ink-3 font-medium">Next</button></span></>}
          >
            {visible.map((l) => (
              <Row key={l.id} template={template} highlight={sel.has(l.id)}>
                <Cell><Checkbox checked={sel.has(l.id)} onClick={() => toggle(l.id)} /></Cell>
                <Cell><div className="flex items-center gap-2.5"><Avatar name={l.name} size={30} /><div className="min-w-0"><div className="font-semibold text-ink-2 truncate">{l.name}</div><div className="text-[12px] text-muted-2">{l.role}</div></div></div></Cell>
                <Cell className="text-ink-2 font-medium">{l.company}</Cell>
                <Cell muted>{l.source}</Cell>
                <Cell muted>{l.owner}</Cell>
                <Cell muted>{l.created}</Cell>
                <Cell align="right"><span className="inline-flex justify-end"><ScorePill score={leadScore(l)} /></span></Cell>
                <Cell align="right">{view === 'Inbox' && <button onClick={() => act.convertLead(l)} title="Convert to deal" className="text-accent hover:bg-accent-wash rounded-md p-1"><ArrowUpRight size={16} /></button>}</Cell>
              </Row>
            ))}
          </Table>
        </main>
      </div>

      <NewLeadModal open={showNew} onClose={() => setShowNew(false)} onCreate={(p) => { act.addLead(p); setShowNew(false) }} />
    </>
  )
}

export function Checkbox({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick() }} className="w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center transition-colors" style={{ borderColor: checked ? '#1D4ED8' : '#C3CBD8', background: checked ? '#1D4ED8' : 'transparent' }}>
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

function ImportLeadsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const act = useActions()
  const [text, setText] = useState('')
  const rows = text.split('\n').map((l) => l.split(/[,\t]/).map((c) => c.trim())).filter((c) => c[0])
  const parsed = rows.map((c) => ({ name: c[0], company: c[1] || '—', role: c[2] || '', score: 65 }))
  return (
    <Modal open={open} onClose={onClose} title="Import leads" subtitle="Paste rows as: Name, Company, Role — one per line"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { if (parsed.length) { act.bulkAddLeads(parsed); act.toast(`Imported ${parsed.length} lead${parsed.length === 1 ? '' : 's'}`); setText(''); onClose() } }}>Import {parsed.length || ''} lead{parsed.length === 1 ? '' : 's'}</Button></>}>
      <Field label="Paste your list"><Textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Jane Smith, Acme Solar, Director\nTom Reyes, Sunhill Renewables, Ops Manager'} autoFocus /></Field>
      <div className="text-[12px] text-muted-2">{parsed.length} row{parsed.length === 1 ? '' : 's'} detected. CSV file upload &amp; column mapping connect with the import backend.</div>
    </Modal>
  )
}
