import { useState } from 'react'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Segmented, Kpi, Avatar, Chip, type ChipTone } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Plus, Download, Sparkle } from '../components/icons'
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
  const template = '2fr 1.2fr 0.8fr 1fr 1fr 1fr 0.9fr'
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
          <Kpi label="Accounts" value="128" delta="+6 this quarter" />
          <Kpi variant="blue" label="Open value" value="$2.02M" delta="Across 42 deals" deltaTone="muted" />
          <Kpi label="Won lifetime" value="$5.5M" delta="+$890K YTD" />
          <Kpi variant="deep" label="Renewals due" value="7" delta="Next 90 days" />
        </div>
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
          footer={<><span>{orgs.length} of 128 organisations</span><span className="flex gap-3"><button>Prev</button><button className="text-ink-3 font-medium">Next</button></span></>}
        >
          {orgs.map((o) => (
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
