import { useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Button, Kpi, Chip, Avatar, type ChipTone } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Plus, Check, Sparkle, Envelope, Video, Megaphone, Link as LinkIcon, Search, Robot, File as FileIcon, Wrench, Sun, Radar, Box } from '../components/icons'
import { Modal, Field, Input, Textarea, Select } from '../components/overlays'
import { BrandLogo } from '../components/BrandLogo'
import { useActions, useState_ } from '../store/store'
import type { CustomEntity, CustomField, Playbook, PlaybookScope, TradeKey, FeatureKey, UserRole } from '../store/types'
import { TRADE_PROFILES, tradeByKey } from '../lib/trades'
import { INDUSTRY_TEMPLATES } from '../lib/pipelines'
import { ROLES, roleByKey } from '../lib/roles'
import { classNames } from '../lib/format'

const tree = [
  { group: 'Company', items: ['Users & permissions', 'Trade & modules', 'Teams', 'Billing', 'Security'] },
  { group: 'AI', items: ['AI Context'] },
  { group: 'Data', items: ['Pipelines & stages', 'Custom fields', 'Labels', 'Import & export'] },
  { group: 'Connected', items: ['Email & calendar', 'Marketplace', 'API & webhooks'] },
]

type URole = 'Admin' | 'Member'
type UStatus = 'Active' | 'Invited'
const statusTone: Record<UStatus, ChipTone> = { Active: 'positive', Invited: 'warning' }

type TUser = { name: string; email: string; role: URole; team: string; status: UStatus; dash: UserRole }
const users: TUser[] = [
  { name: 'Jordan Miles', email: 'jordan@tellovi.io', role: 'Admin', team: 'Sales', status: 'Active', dash: 'owner' },
  { name: 'Priya Nair', email: 'priya@tellovi.io', role: 'Member', team: 'Finance', status: 'Active', dash: 'finance' },
  { name: 'Marcus Webb', email: 'marcus@tellovi.io', role: 'Member', team: 'Sales', status: 'Active', dash: 'sales' },
  { name: 'Sana Ali', email: 'sana@tellovi.io', role: 'Member', team: 'Marketing', status: 'Invited', dash: 'marketing' },
  { name: 'Devan Rao', email: 'devan@tellovi.io', role: 'Admin', team: 'Operations', status: 'Active', dash: 'operations' },
]

export function Settings() {
  const act = useActions()
  const [params] = useSearchParams()
  const [active, setActive] = useState(params.get('tab') === 'pipelines' ? 'Pipelines & stages' : 'Users & permissions')
  const [invite, setInvite] = useState(false)
  const [rows, setRows] = useState(users)
  const template = '1.7fr 1.7fr 0.9fr 1fr 1.4fr 0.9fr'
  return (
    <>
      <TopBar
        title="Settings"
        crumbs={['Team plan · 12 seats']}
        actions={
          <>
            <Button onClick={() => { if (confirm('Reset all demo data to its starting state?')) act.reset() }}>Reset demo data</Button>
            <Button onClick={() => act.toast('The audit trail records once actions run against a real backend', 'accent')}>Audit log</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setInvite(true)}>Invite user</Button>
          </>
        }
      />
      <InviteModal open={invite} onClose={() => setInvite(false)} onInvite={(name, email, role, team) => { setRows((r) => [...r, { name, email, role: role as URole, team, status: 'Invited', dash: 'sales' }]); act.toast(`Invitation sent to ${email}`); setInvite(false) }} />
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
          {active === 'Trade & modules' ? (
            <TradeModulesPanel />
          ) : active === 'Pipelines & stages' ? (
            <PipelinesPanel />
          ) : active === 'AI Context' ? (
            <PlaybooksPanel />
          ) : active === 'Custom fields' ? (
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
                  <b className="text-ink-2">{active}</b> — configured here. Users, AI Context, custom fields, connections, marketplace and API are fully interactive today; this panel finalises once the account backend is connected.
                </div>
              )}
              <Table
                template={template}
                columns={[
                  { key: 'name', header: 'Name' },
                  { key: 'email', header: 'Email' },
                  { key: 'role', header: 'Access' },
                  { key: 'team', header: 'Team' },
                  { key: 'dash', header: 'Dashboard role' },
                  { key: 'status', header: 'Status' },
                ]}
                footer={<><span>{rows.length} users</span><span>Dashboard role shapes each person’s Home</span></>}
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
                    <Cell>
                      <select
                        value={u.dash}
                        onChange={(e) => {
                          const dash = e.target.value as UserRole
                          setRows((rs) => rs.map((r) => (r.email === u.email ? { ...r, dash } : r)))
                          act.toast(`${u.name} → ${roleByKey(dash).label} dashboard`)
                          if (u.email === 'jordan@tellovi.io') act.setRole(dash, true)
                        }}
                        className="h-8 px-2 rounded-control border border-input-border bg-white text-[12.5px] text-ink-2 outline-none focus:border-accent w-full"
                      >
                        {ROLES.map((r) => (<option key={r.key} value={r.key}>{r.label}</option>))}
                      </select>
                    </Cell>
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
        <div className="text-[13px] text-muted-b mt-0.5">Connect any email, calendar or social account. TellOvi uses OAuth for Google &amp; Microsoft, generic IMAP/SMTP for everything else, and a unified social API — so any address works.</div>
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
      <div className="text-[12px] text-muted-2">In production this hands off to a secure OAuth or credential flow — no passwords touch TellOvi’s servers in plain text.</div>
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
          <div className="text-[13px] text-muted-b mt-0.5">Build your own integrations against the TellOvi REST API, or push events anywhere with webhooks.</div>
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
    <Modal open={open} onClose={onClose} title="Add webhook" subtitle="TellOvi will POST the event payload to this URL" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => url.trim() && onAdd(url, events.split(',').map((s) => s.trim()).filter(Boolean))}>Add webhook</Button></>}>
      <Field label="Payload URL"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" autoFocus /></Field>
      <Field label="Events (comma-separated)"><Input value={events} onChange={(e) => setEvents(e.target.value)} placeholder="deal.won, lead.created" /></Field>
    </Modal>
  )
}

/* ---------- AI Context (agent playbooks / "brain") ---------- */
const SCOPE_META: Record<PlaybookScope, { label: string; hint: string }> = {
  general: { label: 'General', hint: 'Every agent' },
  sourcing: { label: 'Lead sourcing', hint: 'Find stage' },
  outreach: { label: 'Outreach', hint: 'Engage stage' },
  qualifying: { label: 'Qualifying', hint: 'Find / Engage' },
  proposal: { label: 'Proposals', hint: 'Close stage' },
  delivery: { label: 'Delivery', hint: 'Deliver stage' },
}
const SCOPE_ORDER: PlaybookScope[] = ['general', 'sourcing', 'qualifying', 'outreach', 'proposal', 'delivery']

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={classNames('w-9 h-5 rounded-full relative transition-colors shrink-0', on ? 'bg-accent' : 'bg-border')} aria-pressed={on}>
      <span className={classNames('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all', on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  )
}

function PlaybooksPanel() {
  const { playbooks } = useState_()
  const act = useActions()
  const [edit, setEdit] = useState<Playbook | 'new' | null>(null)
  const activeCount = playbooks.filter((p) => p.active).length

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[16px] font-bold text-ink">AI Context</div>
          <div className="text-[13px] text-muted-b mt-0.5 max-w-[62ch]">Upload or write your company playbooks — how you qualify leads, your outreach tone, your proposal style. The agents read the relevant playbook before they act, so their work matches how <em>you</em> do it.</div>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit('new')}>Add playbook</Button>
      </div>

      <div className="rounded-card bg-deep-panel p-4 flex items-start gap-3">
        <span className="w-9 h-9 rounded-[10px] bg-white/10 text-white flex items-center justify-center shrink-0"><Robot size={18} /></span>
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-white">{activeCount} active {activeCount === 1 ? 'playbook' : 'playbooks'} guiding your agents</div>
          <div className="text-[12.5px] mt-1 leading-relaxed" style={{ color: '#C7D3F2' }}>Each playbook is scoped to a task. When an agent runs that task it applies the active playbooks for that scope — the same idea as giving a new hire your process docs on day one.</div>
        </div>
      </div>

      {playbooks.length === 0 && <div className="text-[13px] text-muted-2 bg-surface border border-border rounded-card p-4 text-center">No playbooks yet. Add your first to start steering the agents.</div>}

      {SCOPE_ORDER.filter((s) => playbooks.some((p) => p.scope === s)).map((scope) => (
        <div key={scope}>
          <div className="flex items-center gap-2 mb-2">
            <span className="eyebrow text-muted-3">{SCOPE_META[scope].label}</span>
            <span className="text-[11px] text-muted-3">· {SCOPE_META[scope].hint}</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {playbooks.filter((p) => p.scope === scope).map((pb) => (
              <div key={pb.id} className={classNames('bg-surface border rounded-card p-4', pb.active ? 'border-border' : 'border-dashed border-border opacity-70')}>
                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-lg bg-accent-wash text-accent flex items-center justify-center shrink-0">{pb.source === 'uploaded' ? <FileIcon size={15} /> : <Sparkle size={15} />}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-ink-2">{pb.title}</span>
                      {pb.source === 'uploaded' && pb.fileName && <span className="text-[11px] text-muted-3 font-mono truncate">{pb.fileName}</span>}
                    </div>
                    <div className="text-[12.5px] text-muted-b leading-snug mt-1 line-clamp-2">{pb.body}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Switch on={pb.active} onClick={() => act.togglePlaybook(pb.id, !pb.active)} />
                    <button onClick={() => setEdit(pb)} className="text-[12px] text-accent font-semibold hover:underline">Edit</button>
                    <button onClick={() => act.removePlaybook(pb.id, pb.title)} className="text-[12px] text-negative font-medium hover:underline">Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {edit && <PlaybookModal initial={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSave={(data) => {
        if (edit === 'new') act.addPlaybook({ ...data, active: true })
        else act.updatePlaybook(edit.id, data)
        setEdit(null)
      }} />}
    </>
  )
}

function PlaybookModal({ initial, onClose, onSave }: { initial: Playbook | null; onClose: () => void; onSave: (data: { title: string; scope: PlaybookScope; body: string; source: 'written' | 'uploaded'; fileName?: string }) => void }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [scope, setScope] = useState<PlaybookScope>(initial?.scope ?? 'general')
  const [body, setBody] = useState(initial?.body ?? '')
  const [fileName, setFileName] = useState<string | undefined>(initial?.fileName)
  const [source, setSource] = useState<'written' | 'uploaded'>(initial?.source ?? 'written')
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = (f: File) => {
    setFileName(f.name)
    setSource('uploaded')
    if (/\.(txt|md|csv)$/i.test(f.name)) { const r = new FileReader(); r.onload = () => setBody(String(r.result || '').slice(0, 8000)); r.readAsText(f) }
    else if (!body) setBody(`Uploaded ${f.name}. TellOvi AI will read this file when it runs ${SCOPE_META[scope].label.toLowerCase()} tasks.`)
  }

  return (
    <Modal open onClose={onClose} title={initial ? 'Edit playbook' : 'Add playbook'} subtitle="Guidance the agents follow for a specific task" width={620}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => title.trim() && body.trim() && onSave({ title: title.trim(), scope, body: body.trim(), source, fileName })}>{initial ? 'Save' : 'Add playbook'}</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Outreach tone & rules" autoFocus /></Field>
        <Field label="Applies to"><Select value={scope} onChange={(e) => setScope(e.target.value as PlaybookScope)}>{SCOPE_ORDER.map((s) => <option key={s} value={s}>{SCOPE_META[s].label} · {SCOPE_META[s].hint}</option>)}</Select></Field>
      </div>
      <Field label="Playbook">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} placeholder="Write the guidance the agent should follow — rules, tone, checklists, do's and don'ts…" />
      </Field>
      <input ref={fileRef} type="file" accept=".txt,.md,.csv,.pdf,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = '' }} />
      <div className="flex items-center gap-3">
        <button onClick={() => fileRef.current?.click()} className="text-[13px] text-accent font-semibold flex items-center gap-1.5"><FileIcon size={14} /> Upload a document instead</button>
        {fileName && <span className="text-[12px] text-muted-2 font-mono truncate">{fileName}</span>}
      </div>
      <div className="text-[11.5px] text-muted-3 leading-snug">Text files load inline; PDFs &amp; docs are stored and read by TellOvi AI when the backend is connected.</div>
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

const moduleMeta: { key: FeatureKey; icon: (p: { size?: number; className?: string }) => JSX.Element; label: string; desc: string }[] = [
  { key: 'jobs', icon: Wrench, label: 'Jobs & scheduling', desc: 'Book surveys, showroom visits & installs against your crews' },
  { key: 'studio', icon: Sun, label: 'Design studio', desc: 'Address → AI design → price (solar, battery & EV)' },
  { key: 'reach', icon: Radar, label: 'Reach — find new work', desc: 'Prospecting & AI outreach to win more jobs' },
  { key: 'compliance', icon: FileIcon, label: 'Compliance & certificates', desc: 'Per-job checklist for MCS, DNO, FENSA, Gas Safe…' },
  { key: 'inventory', icon: Box, label: 'Stock & inventory', desc: 'Track stock and reserve materials against quotes' },
]

function PipelinesPanel() {
  const { pipelines, activePipelineId, deals } = useState_()
  const act = useActions()
  const [selId, setSelId] = useState(activePipelineId)
  const [tplOpen, setTplOpen] = useState(false)
  const [newStage, setNewStage] = useState('')
  const pipe = pipelines.find((p) => p.id === selId) ?? pipelines[0]
  const dealCount = (pid: string) => deals.filter((d) => (d.pipelineId ?? pipelines[0]?.id) === pid).length

  return (
    <>
      <div>
        <div className="text-[18px] font-bold text-ink">Pipelines &amp; stages</div>
        <div className="text-[13px] text-muted-b mt-0.5">Shape the pipeline to how your business actually sells. Add pipelines for different sales motions, rename and reorder stages, and set each stage’s typical win rate — it drives deal confidence and the forecast.</div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '240px 1fr' }}>
        {/* pipeline list */}
        <div className="flex flex-col gap-2">
          {pipelines.map((p) => (
            <button key={p.id} onClick={() => setSelId(p.id)} className={classNames('text-left rounded-card border p-3 transition-colors', selId === p.id ? 'border-accent bg-accent-wash-4' : 'border-border hover:bg-control')}>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-ink-2 flex-1 truncate">{p.name}</span>
                {activePipelineId === p.id && <Chip tone="positive">Active</Chip>}
              </div>
              <div className="text-[11.5px] text-muted-2 mt-0.5">{p.stages.length} stages · {dealCount(p.id)} deals</div>
            </button>
          ))}
          <button onClick={() => setTplOpen(true)} className="rounded-card border border-dashed border-input-border text-[13px] text-muted-2 py-2.5 hover:border-accent hover:text-accent transition-colors flex items-center justify-center gap-1.5"><Plus size={15} /> New pipeline</button>
        </div>

        {/* stage editor */}
        <div className="bg-surface border border-border rounded-card p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <input value={pipe.name} onChange={(e) => act.renamePipeline(pipe.id, e.target.value)} className="text-[15px] font-bold text-ink bg-transparent outline-none border-b border-transparent focus:border-accent flex-1" />
            {activePipelineId !== pipe.id && <Button onClick={() => act.setActivePipeline(pipe.id)}>Make active</Button>}
            {pipelines.length > 1 && <Button color="#B01B4F" onClick={() => { act.removePipeline(pipe.id, pipe.name); setSelId(pipelines.find((p) => p.id !== pipe.id)!.id) }}>Delete</Button>}
          </div>

          <div className="flex flex-col gap-2">
            {pipe.stages.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2.5 rounded-control border border-border px-3 py-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                <input value={s.name} onChange={(e) => act.updateStage(pipe.id, s.id, { name: e.target.value })} className="flex-1 text-[13px] font-medium text-ink-2 bg-transparent outline-none min-w-0" />
                <label className="flex items-center gap-1.5 text-[12px] text-muted-2">
                  <input type="number" min={0} max={100} value={s.probability} onChange={(e) => act.updateStage(pipe.id, s.id, { probability: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} className="w-14 h-7 px-2 rounded-control border border-input-border bg-white text-[12.5px] text-ink-2 outline-none focus:border-accent text-right" />%
                </label>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => act.moveStageOrder(pipe.id, s.id, -1)} disabled={i === 0} title="Move up" className="w-7 h-7 rounded-md text-muted-2 hover:bg-control disabled:opacity-30">↑</button>
                  <button onClick={() => act.moveStageOrder(pipe.id, s.id, 1)} disabled={i === pipe.stages.length - 1} title="Move down" className="w-7 h-7 rounded-md text-muted-2 hover:bg-control disabled:opacity-30">↓</button>
                  <button onClick={() => act.removeStage(pipe.id, s.id)} title="Remove stage" className="w-7 h-7 rounded-md text-muted-2 hover:bg-control hover:text-negative">×</button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Input value={newStage} onChange={(e) => setNewStage(e.target.value)} placeholder="Add a stage…" onKeyDown={(e) => { if (e.key === 'Enter' && newStage.trim()) { act.addStage(pipe.id, newStage.trim()); setNewStage('') } }} />
            <Button variant="primary" onClick={() => { if (newStage.trim()) { act.addStage(pipe.id, newStage.trim()); setNewStage('') } }}>Add stage</Button>
          </div>

          <div className="border-t border-divider pt-3">
            <div className="text-[12px] font-semibold text-ink-3 mb-2">Start from an industry template</div>
            <div className="text-[12px] text-muted-2 mb-2.5">Replaces this pipeline’s stages and tunes which workspaces are on for that kind of business.</div>
            <div className="flex flex-wrap gap-1.5">
              {INDUSTRY_TEMPLATES.map((t) => (
                <button key={t.key} onClick={() => act.applyIndustryTemplate(pipe.id, t.key)} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3 border border-border rounded-lg px-2.5 py-1.5 hover:border-accent hover:bg-accent-wash transition-colors" title={t.desc}>
                  <span>{t.emoji}</span> {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <NewPipelineModal open={tplOpen} onClose={() => setTplOpen(false)} onPick={(key, name) => { const p = act.addPipelineFromTemplate(key, name); if (p) setSelId(p.id); setTplOpen(false) }} />
    </>
  )
}

function NewPipelineModal({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (key: string, name?: string) => void }) {
  const [name, setName] = useState('')
  const [key, setKey] = useState('general')
  return (
    <Modal open={open} onClose={onClose} title="New pipeline" subtitle="Pick a starting shape — you can edit every stage after" width={560}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => onPick(key, name.trim() || undefined)}>Create pipeline</Button></>}>
      <Field label="Pipeline name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New business" autoFocus /></Field>
      <div className="text-[12px] font-semibold text-ink-3">Starting template</div>
      <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto">
        {INDUSTRY_TEMPLATES.map((t) => (
          <button key={t.key} onClick={() => setKey(t.key)} className={classNames('text-left rounded-card border p-3 transition-colors', key === t.key ? 'border-accent bg-accent-wash-4' : 'border-border hover:bg-control')}>
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2"><span>{t.emoji}</span> {t.name}</div>
            <div className="text-[11.5px] text-muted-2 mt-0.5">{t.stages.map((s) => s.name).join(' → ')}</div>
          </button>
        ))}
      </div>
    </Modal>
  )
}

function TradeModulesPanel() {
  const { activeTrade, features } = useState_()
  const act = useActions()
  const profile = tradeByKey(activeTrade)
  return (
    <>
      <div className="rounded-card p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(150deg,#1c3a72,#0c1b38)' }}>
        <div className="flex items-center gap-4">
          <span className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-[26px] shrink-0">{profile.emoji}</span>
          <div className="flex-1">
            <div className="text-[12px]" style={{ color: '#93A0B4' }}>Your trade profile</div>
            <div className="text-[18px] font-bold">{profile.name}</div>
            <div className="text-[12.5px]" style={{ color: '#c3ccdb' }}>{profile.tagline} · pricing in {profile.estimatorUnit}</div>
          </div>
          <label className="flex flex-col gap-1 items-end">
            <span className="text-[11px]" style={{ color: '#93A0B4' }}>Change trade</span>
            <select value={activeTrade} onChange={(e) => act.selectTrade(e.target.value as TradeKey, { ...tradeByKey(e.target.value as TradeKey).features })}
              className="h-9 px-3 rounded-control bg-white/10 border border-white/20 text-white text-[13px] outline-none">
              {TRADE_PROFILES.map((t) => (<option key={t.key} value={t.key} className="text-ink">{t.name}</option>))}
            </select>
          </label>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-card p-5">
        <div className="text-[14px] font-semibold text-ink mb-1">Modules</div>
        <div className="text-[12.5px] text-muted-b mb-3">Switched on to match {profile.name}. Turn anything on or off — nothing is locked, and changing trade resets these to sensible defaults.</div>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {moduleMeta.map((f) => {
            const on = features[f.key]
            return (
              <button key={f.key} onClick={() => act.toggleFeature(f.key, on, f.label)}
                className={classNames('flex items-start gap-3 rounded-card border p-3.5 text-left transition-colors', on ? 'border-border-blue bg-accent-wash-4' : 'border-border hover:bg-control')}>
                <span className={classNames('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', on ? 'bg-accent text-white' : 'bg-control text-muted-2')}><f.icon size={17} /></span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold text-ink-2">{f.label}</div>
                  <div className="text-[12px] text-muted-2 leading-snug">{f.desc}</div>
                </div>
                <span className={classNames('w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0', on ? 'bg-accent justify-end' : 'bg-input-border justify-start')}><span className="w-5 h-5 rounded-full bg-white shadow" /></span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="bg-surface border border-border rounded-card p-5">
          <div className="text-[13px] font-semibold text-ink mb-2.5">Job types</div>
          <div className="flex flex-col gap-1.5">
            {profile.jobTypes.map((j) => (
              <div key={j.key} className="flex items-center justify-between text-[12.5px]"><span className="text-ink-3">{j.label}</span><span className="text-muted-2">{j.defaultMins % 60 === 0 ? `${j.defaultMins / 60}h` : `${(j.defaultMins / 60).toFixed(1)}h`}</span></div>
            ))}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-card p-5">
          <div className="text-[13px] font-semibold text-ink mb-2.5">Compliance checklist</div>
          <div className="flex flex-wrap gap-1.5">
            {profile.compliance.map((c) => (<span key={c} className="text-[11.5px] font-medium text-ink-3 bg-control rounded-md px-2 py-1">{c}</span>))}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-card p-5">
          <div className="text-[13px] font-semibold text-ink mb-2.5">Survey template</div>
          <div className="flex flex-wrap gap-1.5">
            {profile.surveyChecklist.map((c) => (<span key={c} className="text-[11.5px] text-ink-3 bg-control rounded-md px-2 py-1">{c}</span>))}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-card p-5">
          <div className="text-[13px] font-semibold text-ink mb-2.5">Product categories</div>
          <div className="flex flex-wrap gap-1.5">
            {profile.productCategories.map((c) => (<span key={c} className="text-[11.5px] text-ink-3 bg-control rounded-md px-2 py-1">{c}</span>))}
          </div>
        </div>
      </div>
    </>
  )
}
