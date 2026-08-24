import { useState } from 'react'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Segmented, Kpi, Avatar, Chip, type ChipTone } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Plus, Download, Sparkle, Search } from '../components/icons'
import { Modal, Field, Input, Select } from '../components/overlays'
import { type Org } from '../data/mock'
import { useState_, useActions } from '../store/store'
import { money } from '../lib/format'

function exportCsv(orgs: Org[]) {
  const head = ['Name', 'Industry', 'People', 'Open value', 'Won lifetime', 'Owner', 'Relationship']
  const rows = orgs.map((o) => [o.name, o.industry, o.people, o.openValue, o.wonLifetime, o.owner, o.relationship])
  const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url; a.download = 'organisations.csv'; a.click()
  URL.revokeObjectURL(url)
}

const relTone: Record<Org['relationship'], ChipTone> = {
  Expanding: 'positive',
  'At risk': 'warning',
  New: 'accent',
  Stable: 'neutral',
  'Renewal due': 'accent',
}

export function Organisations() {
  const { orgs } = useState_()
  const act = useActions()
  const [view, setView] = useState('List')
  const [addOpen, setAddOpen] = useState(false)
  const [q, setQ] = useState('')
  const [fIndustry, setFIndustry] = useState('All')
  const [fRel, setFRel] = useState('All')
  const template = '2fr 1.2fr 0.8fr 1fr 1fr 1fr 0.9fr'

  const industries = [...new Set(orgs.map((o) => o.industry))].filter(Boolean).sort()
  const filtered = orgs.filter((o) => {
    if (q && !o.name.toLowerCase().includes(q.toLowerCase())) return false
    if (fIndustry !== 'All' && o.industry !== fIndustry) return false
    if (fRel !== 'All' && o.relationship !== fRel) return false
    return true
  })
  const openTotal = orgs.reduce((s, o) => s + o.openValue, 0)
  const wonTotal = orgs.reduce((s, o) => s + o.wonLifetime, 0)
  const renewals = orgs.filter((o) => o.relationship === 'Renewal due').length
  return (
    <>
      <TopBar
        title="Organisations"
        center={<Segmented options={['List', 'Map', 'Hierarchy']} value={view} onChange={setView} />}
        actions={
          <>
            <Button icon={<Sparkle size={16} />} onClick={() => { orgs.filter((o) => !o.enriched).forEach((o) => act.enrichOrg(o.id, o.name)); }}>Enrich all</Button>
            <Button icon={<Download size={16} />} onClick={() => { exportCsv(orgs); act.toast(`Exported ${orgs.length} organisations`) }}>Export</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAddOpen(true)}>Add organisation</Button>
          </>
        }
      />
      <AddOrgModal open={addOpen} onClose={() => setAddOpen(false)} />
      <PageBody>
        <div className="grid grid-cols-4 gap-4">
          <Kpi label="Accounts" value={String(orgs.length)} delta={`${filtered.length} shown`} deltaTone="muted" />
          <Kpi variant="blue" label="Open value" value={money(openTotal, { compact: true })} delta="Across all accounts" deltaTone="muted" />
          <Kpi label="Won lifetime" value={money(wonTotal, { compact: true })} delta="Total to date" />
          <Kpi variant="deep" label="Renewals due" value={String(renewals)} delta="Relationship flag" />
        </div>

        {/* filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="h-9 w-[240px] rounded-control border border-border bg-surface flex items-center gap-2 px-3">
            <Search size={15} className="text-muted-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search organisations" className="bg-transparent outline-none flex-1 text-[13px] text-ink-2 placeholder:text-muted-3" />
          </div>
          <select value={fIndustry} onChange={(e) => setFIndustry(e.target.value)} className="h-9 px-2.5 rounded-control border border-input-border bg-white text-[13px] text-ink-2 outline-none focus:border-accent"><option>All</option>{industries.map((i) => <option key={i}>{i}</option>)}</select>
          <select value={fRel} onChange={(e) => setFRel(e.target.value)} className="h-9 px-2.5 rounded-control border border-input-border bg-white text-[13px] text-ink-2 outline-none focus:border-accent"><option>All</option><option>New</option><option>Expanding</option><option>Stable</option><option>At risk</option><option>Renewal due</option></select>
          {(q || fIndustry !== 'All' || fRel !== 'All') && <button onClick={() => { setQ(''); setFIndustry('All'); setFRel('All') }} className="text-[12.5px] text-accent font-medium">Clear</button>}
          <span className="ml-auto text-[12.5px] text-muted-2">{filtered.length} of {orgs.length}</span>
        </div>

        {view === 'Map' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-12 bg-surface border border-border rounded-card">
            <div className="text-[15px] font-semibold text-ink-2">Map view</div>
            <div className="text-[13px] text-muted-b max-w-[420px]">Plotting accounts by location connects with a maps backend. Meanwhile, use List or the Industry grouping.</div>
          </div>
        ) : view === 'Hierarchy' ? (
          <div className="flex flex-col gap-4">
            {industries.filter((ind) => filtered.some((o) => o.industry === ind)).map((ind) => {
              const group = filtered.filter((o) => o.industry === ind)
              return (
                <div key={ind} className="bg-surface border border-border rounded-card p-4">
                  <div className="flex items-center gap-2 mb-2.5"><div className="text-[14px] font-bold text-ink">{ind}</div><Chip tone="neutral">{group.length}</Chip><span className="ml-auto text-[12.5px] text-muted-2">{money(group.reduce((s, o) => s + o.openValue, 0), { compact: true })} open</span></div>
                  <div className="flex flex-col divide-y divide-divider">
                    {group.map((o) => (
                      <div key={o.id} className="flex items-center gap-2.5 py-2">
                        <Avatar name={o.name} size={26} square variant="neutral" />
                        <span className="text-[13px] font-medium text-ink-2 flex-1">{o.name}</span>
                        <span className="text-[12px] text-muted-2">{o.people} people</span>
                        <Chip tone={relTone[o.relationship]} dot>{o.relationship}</Chip>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
        <Table
          template={template}
          columns={[
            { key: 'org', header: 'Organisation' },
            { key: 'industry', header: 'Industry' },
            { key: 'people', header: 'People', align: 'right' },
            { key: 'open', header: 'Open value', align: 'right' },
            { key: 'won', header: 'Won lifetime', align: 'right' },
            { key: 'owner', header: 'Owner' },
            { key: 'rel', header: 'Relationship' },
          ]}
          footer={<><span>{filtered.length} of {orgs.length} organisations</span></>}
        >
          {filtered.map((o) => (
            <Row key={o.id} template={template}>
              <Cell>
                <div className="flex items-center gap-2.5">
                  <Avatar name={o.name} size={32} square variant="neutral" />
                  <div className="font-semibold text-ink-2 truncate">{o.name}</div>
                  {(o as { enriched?: boolean }).enriched && <span title="AI-enriched" className="text-accent shrink-0"><Sparkle size={13} /></span>}
                </div>
              </Cell>
              <Cell muted>{o.industry}</Cell>
              <Cell align="right" className="text-ink-2">{o.people}</Cell>
              <Cell align="right" className="font-semibold text-ink-2">{money(o.openValue, { compact: true })}</Cell>
              <Cell align="right" muted>{money(o.wonLifetime, { compact: true })}</Cell>
              <Cell muted>{o.owner}</Cell>
              <Cell><Chip tone={relTone[o.relationship]} dot>{o.relationship}</Chip></Cell>
            </Row>
          ))}
        </Table>
        )}
      </PageBody>
    </>
  )
}

function AddOrgModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const act = useActions()
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [owner, setOwner] = useState('Jordan Miles')
  const [relationship, setRelationship] = useState<Org['relationship']>('New')
  const [people, setPeople] = useState('')
  const reset = () => { setName(''); setIndustry(''); setPeople(''); setRelationship('New') }
  return (
    <Modal open={open} onClose={onClose} title="Add organisation" subtitle="Create a new account"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { if (name.trim()) { act.addOrg({ name: name.trim(), industry: industry || '—', owner, relationship, people: Number(people) || 0 }); reset(); onClose() } }}>Add organisation</Button></>}>
      <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Renewables Ltd" autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Industry"><Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Renewables" /></Field>
        <Field label="People"><Input type="number" value={people} onChange={(e) => setPeople(e.target.value)} placeholder="0" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Owner"><Select value={owner} onChange={(e) => setOwner(e.target.value)}><option>Jordan Miles</option><option>Priya Nair</option><option>Marcus Webb</option></Select></Field>
        <Field label="Relationship"><Select value={relationship} onChange={(e) => setRelationship(e.target.value as Org['relationship'])}><option value="New">New</option><option value="Expanding">Expanding</option><option value="Stable">Stable</option><option value="At risk">At risk</option><option value="Renewal due">Renewal due</option></Select></Field>
      </div>
    </Modal>
  )
}
