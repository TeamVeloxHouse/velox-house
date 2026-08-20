import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Segmented, Avatar, Chip } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Modal, Field, Input } from '../components/overlays'
import { Plus, Filter, Columns, Search } from '../components/icons'
import { useState_, useSelectors, useActions } from '../store/store'
import type { Person } from '../store/types'

export function People() {
  const nav = useNavigate()
  const { people, deals } = useState_()
  const sel = useSelectors()
  const act = useActions()
  const [view, setView] = useState('List')
  const [q, setQ] = useState('')
  const [showNew, setShowNew] = useState(false)
  const template = '28px 1.7fr 1.4fr 1.3fr 1fr 0.8fr 1fr'

  const filtered = people.filter((p) => !q || (p.name + p.org + p.role).toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <TopBar
        title="People"
        center={<Segmented options={['List', 'Board', 'Timeline']} value={view} onChange={setView} />}
        actions={<><Button icon={<Filter size={16} />}>Filter</Button><Button icon={<Columns size={16} />}>Columns</Button><Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowNew(true)}>Add person</Button></>}
      />
      <PageBody>
        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-[360px] h-[38px] border border-border rounded-control flex items-center gap-2.5 px-3 text-muted-3 text-[14px] bg-surface">
            <Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="bg-transparent outline-none flex-1 text-ink-2 placeholder:text-muted-3" />
          </div>
          <span className="ml-auto text-[13px] text-muted-2">{filtered.length} people</span>
        </div>
        <Table
          template={template}
          columns={[{ key: 'c', header: '' }, { key: 'name', header: 'Name' }, { key: 'org', header: 'Organisation' }, { key: 'phone', header: 'Phone' }, { key: 'owner', header: 'Owner' }, { key: 'deals', header: 'Deals', align: 'right' }, { key: 'last', header: 'Last activity' }]}
          footer={<><span>{filtered.length} people</span><span className="flex gap-3"><button>Prev</button><button className="text-ink-3 font-medium">Next</button></span></>}
        >
          {filtered.map((p) => {
            const acts = sel.personActivities(p.id)
            const dealCount = deals.filter((d) => d.personIds.includes(p.id)).length
            const last = acts[0]
            return (
              <Row key={p.id} template={template} onClick={() => nav(`/people/${p.id}`)}>
                <Cell><span className="w-[18px] h-[18px] rounded-[5px] border border-input-border inline-block" /></Cell>
                <Cell><div className="flex items-center gap-2.5"><Avatar name={p.name} size={30} /><div className="min-w-0"><div className="font-semibold text-ink-2 truncate">{p.name}</div><div className="text-[12px] text-muted-2">{p.role}</div></div></div></Cell>
                <Cell className="text-ink-2 font-medium">{p.org}</Cell>
                <Cell muted>{p.phone || '—'}</Cell>
                <Cell muted>{p.owner}</Cell>
                <Cell align="right" className="font-semibold text-ink-2">{dealCount}</Cell>
                <Cell muted>{last ? `${last.type} · ${rel(last.createdAt)}` : '—'}</Cell>
              </Row>
            )
          })}
        </Table>
      </PageBody>

      <NewPersonModal open={showNew} onClose={() => setShowNew(false)} onCreate={(p) => { const person = act.addPerson(p); setShowNew(false); nav(`/people/${person.id}`) }} />
    </>
  )
}

function rel(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 60) return `${Math.max(1, m)}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function NewPersonModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (p: Partial<Person> & { name: string }) => void }) {
  const [name, setName] = useState('')
  const [org, setOrg] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="Add person" subtitle="Create a new contact" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => name.trim() && onCreate({ name, org, role, email, phone })}>Add person</Button></>}>
      <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Organisation"><Input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Company" /></Field>
        <Field label="Role"><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Job title" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></Field>
        <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44…" /></Field>
      </div>
    </Modal>
  )
}
