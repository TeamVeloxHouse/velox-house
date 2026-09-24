import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Segmented, Avatar, Chip } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Modal, Field, Input } from '../components/overlays'
import { Plus, Filter, Search } from '../components/icons'
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
  const [showFilter, setShowFilter] = useState(false)
  const [fOwner, setFOwner] = useState('All')
  const [fHasDeals, setFHasDeals] = useState(false)
  const template = '28px 1.7fr 1.4fr 1.3fr 1fr 0.8fr 1fr'

  const owners = [...new Set(people.map((p) => p.owner))]
  const dealCountFor = (id: string) => deals.filter((d) => d.personIds.includes(id)).length
  const filterN = (fOwner !== 'All' ? 1 : 0) + (fHasDeals ? 1 : 0)
  const filtered = people.filter((p) => {
    if (q && !(p.name + p.org + p.role).toLowerCase().includes(q.toLowerCase())) return false
    if (fOwner !== 'All' && p.owner !== fOwner) return false
    if (fHasDeals && dealCountFor(p.id) === 0) return false
    return true
  })
  const byLast = [...filtered].map((p) => ({ p, last: sel.personActivities(p.id)[0] })).sort((a, b) => (b.last?.createdAt ?? 0) - (a.last?.createdAt ?? 0))
  const byOrg = [...new Set(filtered.map((p) => p.org))].filter(Boolean).sort()

  return (
    <>
      <TopBar
        title="People"
        center={<Segmented options={['List', 'Board', 'Timeline']} value={view} onChange={setView} />}
        actions={<><Button icon={<Filter size={16} />} onClick={() => setShowFilter((v) => !v)}>Filter{filterN > 0 ? ` · ${filterN}` : ''}</Button><Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowNew(true)}>Add person</Button></>}
      />
      <PageBody>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 max-w-[360px] h-[38px] border border-border rounded-control flex items-center gap-2.5 px-3 text-muted-3 text-[14px] bg-surface">
            <Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="bg-transparent outline-none flex-1 text-ink-2 placeholder:text-muted-3" />
          </div>
          {showFilter && (
            <>
              <select value={fOwner} onChange={(e) => setFOwner(e.target.value)} className="h-[38px] px-2.5 rounded-control border border-input-border bg-white text-[13px] text-ink-2 outline-none focus:border-accent"><option>All</option>{owners.map((o) => <option key={o}>{o}</option>)}</select>
              <button onClick={() => setFHasDeals((v) => !v)} className={`h-[38px] px-3 rounded-control border text-[13px] font-medium ${fHasDeals ? 'bg-accent text-white border-accent' : 'border-border text-muted-b hover:bg-control'}`}>Has deals</button>
            </>
          )}
          {filterN > 0 && <button onClick={() => { setFOwner('All'); setFHasDeals(false) }} className="text-[12.5px] text-accent font-medium">Clear</button>}
          <span className="ml-auto text-[13px] text-muted-2">{filtered.length} people</span>
        </div>

        {view === 'Board' ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {byOrg.map((org) => {
              const group = filtered.filter((p) => p.org === org)
              return (
                <div key={org} className="bg-surface border border-border rounded-card p-4">
                  <div className="flex items-center gap-2 mb-2.5"><Avatar name={org} size={26} square variant="neutral" /><div className="text-[13.5px] font-bold text-ink truncate flex-1">{org}</div><Chip tone="neutral">{group.length}</Chip></div>
                  <div className="flex flex-col divide-y divide-divider">
                    {group.map((p) => (
                      <button key={p.id} onClick={() => nav(`/people/${p.id}`)} className="flex items-center gap-2.5 py-2 text-left hover:opacity-80">
                        <Avatar name={p.name} size={28} />
                        <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate">{p.name}</div><div className="text-[12px] text-muted-2 truncate">{p.role}</div></div>
                        {dealCountFor(p.id) > 0 && <Chip tone="accent">{dealCountFor(p.id)}</Chip>}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : view === 'Timeline' ? (
          <div className="bg-surface border border-border rounded-card divide-y divide-divider">
            {byLast.map(({ p, last }) => (
              <button key={p.id} onClick={() => nav(`/people/${p.id}`)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-control">
                <Avatar name={p.name} size={32} />
                <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate">{p.name} <span className="text-muted-2 font-normal">· {p.org}</span></div><div className="text-[12px] text-muted-2 truncate">{last ? `${last.type} — ${last.subject}` : 'No activity yet'}</div></div>
                <span className="text-[12px] text-muted-3 shrink-0">{last ? rel(last.createdAt) : '—'}</span>
              </button>
            ))}
          </div>
        ) : (
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
        )}
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
