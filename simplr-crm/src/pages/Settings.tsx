import { useState } from 'react'
import { TopBar } from '../components/TopBar'
import { Button, Kpi, Chip, Avatar, type ChipTone } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Plus, Check, Sparkle, Envelope, Video, Megaphone, Link as LinkIcon, Search } from '../components/icons'
import { Modal, Field, Input, Select } from '../components/overlays'
import { BrandLogo } from '../components/BrandLogo'
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
          ) : active === 'Email & calendar' ? (
            <ConnectionsPanel />
          ) : active === 'Marketplace' ? (
            <MarketplacePanel />
          ) : active === 'API & webhooks' ? (
            <ApiPanel />
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

const providerDomain: Record<string, string> = {
  'Microsoft 365': 'microsoft.com', Outlook: 'outlook.com', Gmail: 'google.com', Teams: 'microsoft.com',
  'Google Meet': 'meet.google.com', Zoom: 'zoom.us', LinkedIn: 'linkedin.com', X: 'x.com',
  Facebook: 'facebook.com', Instagram: 'instagram.com',
}

/* ---------- Email, calendar & social connections ---------- */
function ConnectionsPanel() {
  const { connections } = useState_()
  const act = useActions()
  const [imap, setImap] = useState(false)
  const email = connections.filter((c) => c.kind === 'email')
  const meeting = connections.filter((c) => c.kind === 'meeting')
  const social = connections.filter((c) => c.kind === 'social')

  const Section = ({ title, sub, items, icon: Icon }: { title: string; sub: string; items: typeof connections; icon: any }) => (
    <div>
      <div className="flex items-center gap-2 mb-2"><Icon size={16} className="text-accent" /><div className="text-[14px] font-bold text-ink">{title}</div></div>
      <div className="text-[12.5px] text-muted-b mb-2.5">{sub}</div>
      <div className="bg-surface border border-border rounded-card divide-y divide-divider">
        {items.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
            <BrandLogo domain={providerDomain[c.provider]} name={c.provider} color={c.color} initials={c.provider.slice(0, 2)} size={32} radius={8} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-ink-2">{c.provider}{c.protocol && <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-3 font-semibold">{c.protocol}</span>}</div>
              <div className="text-[12px] text-muted-2 truncate">{c.account ?? (c.connected ? 'Connected' : 'Not connected')}</div>
            </div>
            {c.connected ? (
              <>
                <Chip tone="positive" dot>Connected</Chip>
                <button onClick={() => act.toggleConnection(c.id, c.provider, true)} className="text-[12px] text-muted-b hover:text-negative font-medium">Disconnect</button>
              </>
            ) : (
              <Button onClick={() => (c.protocol === 'imap' ? setImap(true) : act.toggleConnection(c.id, c.provider, false))}>Connect</Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <>
      <div>
        <div className="text-[16px] font-bold text-ink">Connections</div>
        <div className="text-[13px] text-muted-b mt-0.5">Connect any email, calendar or social account. Simplr uses OAuth for Google &amp; Microsoft, generic IMAP/SMTP for everything else, and a unified social API — so any address works.</div>
      </div>
      <Section title="Email" sub="Send and sync from any address. Add unlimited accounts per user." items={email} icon={Envelope} />
      <button onClick={() => setImap(true)} className="self-start text-[13px] text-accent font-semibold flex items-center gap-1.5"><Plus size={15} /> Add another email account</button>
      <Section title="Calendar & meetings" sub="Two-way calendar sync and the AI notetaker join link." items={meeting} icon={Video} />
      <Section title="Social channels" sub="Schedule posts to every network through one unified API (Ayrshare / Unipile)." items={social} icon={Megaphone} />

      <ImapModal open={imap} onClose={() => setImap(false)} onConnect={(email, protocol) => { act.connectEmail('IMAP / SMTP', email, protocol); setImap(false) }} />
    </>
  )
}

function ImapModal({ open, onClose, onConnect }: { open: boolean; onClose: () => void; onConnect: (email: string, protocol: 'imap') => void }) {
  const [email, setEmail] = useState('')
  const [server, setServer] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="Connect via IMAP / SMTP" subtitle="Works with any provider — Fastmail, Zoho, cPanel, custom domains" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => email.trim() && onConnect(email, 'imap')}>Connect</Button></>}>
      <Field label="Email address"><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourdomain.com" autoFocus /></Field>
      <Field label="IMAP server"><Input value={server} onChange={(e) => setServer(e.target.value)} placeholder="imap.yourdomain.com" /></Field>
      <div className="text-[12px] text-muted-2">In production this hands off to a secure OAuth or credential flow — no passwords touch Simplr’s servers in plain text.</div>
    </Modal>
  )
}

/* ---------- Marketplace ---------- */
function MarketplacePanel() {
  const { integrations } = useState_()
  const act = useActions()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const cats = ['All', 'Installed', 'Popular', ...[...new Set(integrations.map((i) => i.category))]]

  const filtered = integrations.filter((i) => {
    if (q && !(i.name + i.desc + i.category).toLowerCase().includes(q.toLowerCase())) return false
    if (cat === 'Installed') return i.installed
    if (cat === 'Popular') return i.popular
    if (cat === 'All') return true
    return i.category === cat
  })
  const installedCount = integrations.filter((i) => i.installed).length

  const Card = (i: (typeof integrations)[number]) => (
    <div className="bg-surface border border-border rounded-card p-4 flex items-start gap-3">
      <BrandLogo domain={i.domain} name={i.name} color={i.color} initials={i.initials} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5"><div className="text-[13.5px] font-semibold text-ink-2 truncate">{i.name}</div>{i.popular && <span className="text-[9px] uppercase tracking-wide font-bold text-accent bg-accent-wash px-1 py-0.5 rounded">Popular</span>}</div>
        <div className="text-[12px] text-muted-2 leading-snug mt-0.5">{i.desc}</div>
        <button onClick={() => act.toggleIntegration(i.id, i.name, i.installed)} className={classNames('mt-2 h-7 px-2.5 rounded-lg text-[12px] font-semibold', i.installed ? 'bg-positive-wash text-positive' : 'bg-accent-wash text-accent hover:bg-[#E4ECFB]')}>
          {i.installed ? <span className="flex items-center gap-1"><Check size={12} /> Connected</span> : 'Connect'}
        </button>
      </div>
    </div>
  )

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[16px] font-bold text-ink">Marketplace</div>
          <div className="text-[13px] text-muted-b mt-0.5">{integrations.length} integrations · {installedCount} connected. Plus Zapier, Make &amp; webhooks for thousands more.</div>
        </div>
        <div className="w-[260px] h-9 border border-border rounded-control flex items-center gap-2 px-3 bg-surface shrink-0">
          <Search size={15} className="text-muted-3" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search integrations" className="bg-transparent outline-none flex-1 text-[13px] text-ink-2 placeholder:text-muted-3" />
        </div>
      </div>

      <div className="rounded-card bg-deep-panel p-4 flex items-start gap-3">
        <span className="w-9 h-9 rounded-[10px] bg-white/10 text-white flex items-center justify-center shrink-0"><Sparkle size={18} /></span>
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-white">Don’t see your tool? Connect anything.</div>
          <div className="text-[12.5px] mt-1 leading-relaxed" style={{ color: '#C7D3F2' }}>A full REST API, webhooks, and native Zapier + Make connectors mean the long tail of apps connects without a bespoke build.</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap sticky top-0 bg-canvas/0 z-10">
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={classNames('h-8 px-3 rounded-lg text-[12.5px] font-medium transition-colors', cat === c ? 'bg-accent text-white' : 'text-muted-b bg-surface border border-border hover:bg-control')}>
            {c}{c === 'Installed' && ` · ${installedCount}`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {filtered.map((i) => <div key={i.id}>{Card(i)}</div>)}
      </div>
      {filtered.length === 0 && <div className="text-[13px] text-muted-2 text-center py-8">No integrations match “{q}”. You can still connect it via Zapier or the API.</div>}
    </>
  )
}

/* ---------- API & webhooks ---------- */
function ApiPanel() {
  const { apiKeys, webhooks } = useState_()
  const act = useActions()
  const [addHook, setAddHook] = useState(false)
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[16px] font-bold text-ink">API &amp; webhooks</div>
          <div className="text-[13px] text-muted-b mt-0.5">Build your own integrations against the Simplr REST API, or push events anywhere with webhooks.</div>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => act.createApiKey('New key')}>New API key</Button>
      </div>

      <div>
        <div className="eyebrow text-muted-3 mb-2">API keys</div>
        <div className="bg-surface border border-border rounded-card divide-y divide-divider">
          {apiKeys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-ink-2">{k.label}</div>
                <div className="text-[12px] text-muted-2 font-mono">{k.key} · created {k.created}</div>
              </div>
              <button onClick={() => act.revokeApiKey(k.id, k.label)} className="text-[12px] text-negative font-medium hover:underline">Revoke</button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="eyebrow text-muted-3">Webhooks</div>
          <button onClick={() => setAddHook(true)} className="text-[13px] text-accent font-semibold flex items-center gap-1.5"><Plus size={14} /> Add webhook</button>
        </div>
        <div className="bg-surface border border-border rounded-card divide-y divide-divider">
          {webhooks.map((w) => (
            <div key={w.id} className="flex items-center gap-3 px-4 py-3">
              <LinkIcon size={16} className="text-muted-2 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-ink-2 font-mono truncate">{w.url}</div>
                <div className="text-[12px] text-muted-2">{w.events.join(', ')}</div>
              </div>
              <Chip tone={w.active ? 'positive' : 'neutral'} dot>{w.active ? 'Active' : 'Paused'}</Chip>
              <button onClick={() => act.removeWebhook(w.id)} className="text-[12px] text-negative font-medium hover:underline">Delete</button>
            </div>
          ))}
        </div>
      </div>
      <AddWebhookModal open={addHook} onClose={() => setAddHook(false)} onAdd={(url, events) => { act.addWebhook(url, events); setAddHook(false) }} />
    </>
  )
}

function AddWebhookModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (url: string, events: string[]) => void }) {
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState('deal.won')
  return (
    <Modal open={open} onClose={onClose} title="Add webhook" subtitle="Simplr will POST the event payload to this URL" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => url.trim() && onAdd(url, events.split(',').map((s) => s.trim()).filter(Boolean))}>Add webhook</Button></>}>
      <Field label="Payload URL"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" autoFocus /></Field>
      <Field label="Events (comma-separated)"><Input value={events} onChange={(e) => setEvents(e.target.value)} placeholder="deal.won, lead.created" /></Field>
    </Modal>
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
