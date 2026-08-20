import { useState } from 'react'
import { TopBar } from '../components/TopBar'
import { Button, Kpi, Chip, Avatar, type ChipTone } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Plus } from '../components/icons'
import { Modal, Field, Input, Select } from '../components/overlays'
import { useActions, useState_ } from '../store/store'
import type { CustomEntity, CustomField } from '../store/types'
import { classNames } from '../lib/format'

const tree = [
  { group: 'Company', items: ['Users & permissions', 'Teams', 'Billing', 'Security'] },
  { group: 'Data', items: ['Pipelines & stages', 'Custom fields', 'Labels', 'Import & export'] },
  { group: 'Connected', items: ['Email & calendar', 'Marketplace', 'API & webhooks'] },
]

type URole = 'Admin' | 'Member'
type UStatus = 'Active' | 'Invited'
const statusTone: Record<UStatus, ChipTone> = { Active: 'positive', Invited: 'warning' }

const users: { name: string; email: string; role: URole; team: string; status: UStatus }[] = [
  { name: 'Jordan Miles', email: 'jordan@simplr.io', role: 'Admin', team: 'Enterprise', status: 'Active' },
  { name: 'Priya Nair', email: 'priya@simplr.io', role: 'Member', team: 'Enterprise', status: 'Active' },
  { name: 'Marcus Webb', email: 'marcus@simplr.io', role: 'Member', team: 'Mid-market', status: 'Active' },
  { name: 'Sana Ali', email: 'sana@simplr.io', role: 'Member', team: 'Mid-market', status: 'Invited' },
  { name: 'Devan Rao', email: 'devan@simplr.io', role: 'Admin', team: 'Ops', status: 'Active' },
]

export function Settings() {
  const act = useActions()
  const [active, setActive] = useState('Users & permissions')
  const [invite, setInvite] = useState(false)
  const [rows, setRows] = useState(users)
  const template = '2fr 2fr 1.2fr 1.2fr 1fr'
  return (
    <>
      <TopBar
        title="Settings"
        crumbs={['Team plan · 12 seats']}
        actions={
          <>
            <Button onClick={() => { if (confirm('Reset all demo data to its starting state?')) act.reset() }}>Reset demo data</Button>
            <Button onClick={() => act.toast('Audit log (demo)', 'accent')}>Audit log</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setInvite(true)}>Invite user</Button>
          </>
        }
      />
      <InviteModal open={invite} onClose={() => setInvite(false)} onInvite={(name, email, role, team) => { setRows((r) => [...r, { name, email, role: role as URole, team, status: 'Invited' }]); act.toast(`Invitation sent to ${email}`); setInvite(false) }} />
      <div className="flex-1 flex min-h-0">
        <aside className="w-[236px] shrink-0 bg-surface border-r border-border p-4 overflow-y-auto flex flex-col gap-5">
          {tree.map((t) => (
            <div key={t.group}>
              <div className="eyebrow text-muted-3 mb-2">{t.group}</div>
              <div className="flex flex-col gap-0.5">
                {t.items.map((it) => (
                  <button
                    key={it}
                    onClick={() => setActive(it)}
                    className={classNames(
                      'text-left px-2.5 py-1.5 rounded-lg text-[13px]',
                      active === it ? 'bg-accent-wash-2 text-accent-700 font-semibold' : 'text-ink-3 hover:bg-control',
                    )}
                  >
                    {it}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        <main className="flex-1 overflow-y-auto p-7 flex flex-col gap-5">
          {active === 'Custom fields' ? (
            <CustomFieldsPanel />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Kpi label="Seats used" value="12 / 15" delta="3 available" deltaTone="muted" />
                <Kpi variant="blue" label="Admins" value="3" delta="Across 3 teams" deltaTone="muted" />
                <Kpi label="2FA enforced" value="Yes" delta="All members enrolled" />
              </div>
              {active !== 'Users & permissions' && (
                <div className="text-[13px] text-muted-b bg-surface border border-border rounded-card p-4">
                  <b className="text-ink-2">{active}</b> — configured here. This panel is wired for demo; the users &amp; custom-fields panels are fully interactive.
                </div>
              )}
              <Table
                template={template}
                columns={[
                  { key: 'name', header: 'Name' },
                  { key: 'email', header: 'Email' },
                  { key: 'role', header: 'Role' },
                  { key: 'team', header: 'Team' },
                  { key: 'status', header: 'Status' },
                ]}
                footer={<><span>{rows.length} users</span><span>Team plan</span></>}
              >
                {rows.map((u) => (
                  <Row key={u.email} template={template}>
                    <Cell>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.name} size={30} />
                        <span className="font-semibold text-ink-2">{u.name}</span>
                      </div>
                    </Cell>
                    <Cell muted>{u.email}</Cell>
                    <Cell><Chip tone={u.role === 'Admin' ? 'accent' : 'neutral'}>{u.role}</Chip></Cell>
                    <Cell muted>{u.team}</Cell>
                    <Cell><Chip tone={statusTone[u.status]} dot>{u.status}</Chip></Cell>
                  </Row>
                ))}
              </Table>
            </>
          )}
        </main>
      </div>
    </>
  )
}

const entityLabel: Record<CustomEntity, string> = { deal: 'Deals', person: 'People', org: 'Organisations' }

function CustomFieldsPanel() {
  const { customFields } = useState_()
  const act = useActions()
  const [add, setAdd] = useState(false)
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[16px] font-bold text-ink">Custom fields</div>
          <div className="text-[13px] text-muted-b mt-0.5">Add your own fields to any record — they appear on the record and are editable inline.</div>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdd(true)}>Add field</Button>
      </div>
      {(['deal', 'person', 'org'] as CustomEntity[]).map((entity) => {
        const fields = customFields.filter((f) => f.entity === entity)
        return (
          <div key={entity}>
            <div className="eyebrow text-muted-3 mb-2">{entityLabel[entity]}</div>
            <div className="bg-surface border border-border rounded-card divide-y divide-divider">
              {fields.length === 0 && <div className="px-4 py-3 text-[13px] text-muted-2">No custom fields yet.</div>}
              {fields.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-[13px] font-semibold text-ink-2 flex-1">{f.label}</span>
                  <Chip tone="neutral">{f.type}{f.options ? ` · ${f.options.length}` : ''}</Chip>
                  <button onClick={() => act.removeField(f.id, f.label)} className="text-[12px] text-negative font-medium hover:underline">Remove</button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      <AddFieldModal open={add} onClose={() => setAdd(false)} onAdd={(entity, label, type, options) => { act.addField(entity, label, type, options); setAdd(false) }} />
    </>
  )
}

function AddFieldModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (entity: CustomEntity, label: string, type: CustomField['type'], options?: string[]) => void }) {
  const [entity, setEntity] = useState<CustomEntity>('deal')
  const [label, setLabel] = useState('')
  const [type, setType] = useState<CustomField['type']>('text')
  const [options, setOptions] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="New custom field" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => label.trim() && onAdd(entity, label, type, type === 'select' ? options.split(',').map((s) => s.trim()).filter(Boolean) : undefined)}>Add field</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Applies to"><Select value={entity} onChange={(e) => setEntity(e.target.value as CustomEntity)}><option value="deal">Deals</option><option value="person">People</option><option value="org">Organisations</option></Select></Field>
        <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value as CustomField['type'])}>{['text', 'number', 'select', 'date', 'url'].map((t) => (<option key={t} value={t}>{t}</option>))}</Select></Field>
      </div>
      <Field label="Field name"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Contract length" autoFocus /></Field>
      {type === 'select' && <Field label="Options (comma-separated)"><Input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="1 year, 2 years, 3 years" /></Field>}
    </Modal>
  )
}

function InviteModal({ open, onClose, onInvite }: { open: boolean; onClose: () => void; onInvite: (name: string, email: string, role: string, team: string) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Member')
  const [team, setTeam] = useState('Enterprise')
  return (
    <Modal open={open} onClose={onClose} title="Invite user" subtitle="They’ll get an email to join your workspace" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => email.trim() && onInvite(name || email.split('@')[0], email, role, team)}>Send invite</Button></>}>
      <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></Field>
      <Field label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role"><Select value={role} onChange={(e) => setRole(e.target.value)}><option>Member</option><option>Admin</option></Select></Field>
        <Field label="Team"><Select value={team} onChange={(e) => setTeam(e.target.value)}><option>Enterprise</option><option>Mid-market</option><option>Ops</option></Select></Field>
      </div>
    </Modal>
  )
}
