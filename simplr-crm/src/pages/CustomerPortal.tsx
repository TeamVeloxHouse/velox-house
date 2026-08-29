import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Kpi, Chip, Avatar } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Modal, Field, Input, Select, Textarea } from '../components/overlays'
import { Plus, Sparkle, Sun, File as FileIcon, Play, Bolt, Check, Send, MapPin, Clock, Download, Robot, Building, Wrench } from '../components/icons'
import { useState_, useActions } from '../store/store'
import { customerAnswer, portalStarters, type PortalBlock } from '../lib/portalAi'
import type { CustomerPortal as Portal, PortalResource, PortalEvent } from '../store/types'
import { money, classNames } from '../lib/format'

const CUSTOMER_ACCENT = '#0E7C66' // portal is green — signals "customer-facing", distinct from CRM blue

/* ============================ Management list ============================ */
export function CustomerPortals() {
  const nav = useNavigate()
  const { portals, portalEvents, deals, people } = useState_()
  const act = useActions()
  const [newOpen, setNewOpen] = useState(false)
  // Every won customer who doesn't have a portal yet — so this really is "all customers".
  const wonNoPortal = deals.filter((d) => d.won && !portals.some((p) => p.dealId === d.id))
  const setupPortal = (d: (typeof deals)[number]) => {
    const c = people.find((p) => d.personIds.includes(p.id))
    const portal = act.createPortal({ dealId: d.id, customer: c?.name || d.org, email: c?.email || '', address: d.org, systemKwp: d.solar?.systemKwp ?? 6, systemCost: Math.round(d.solar?.systemCost ?? d.value), annualSavings: Math.round((d.solar?.annualSavings ?? d.value * 0.12)) })
    nav(`/customers/${portal.id}`)
  }

  const stats = (id: string) => {
    const ev = portalEvents.filter((e) => e.portalId === id)
    const dwell = ev.reduce((s, e) => s + (e.dwellMs ?? 0), 0)
    return { events: ev.length, mins: Math.round(dwell / 60000), sections: new Set(ev.map((e) => e.section)).size }
  }
  const active = portals.filter((p) => p.status === 'active').length
  const totalMins = portals.reduce((s, p) => s + stats(p.id).mins, 0)

  return (
    <>
      <TopBar title="Customers" crumbs={['Portals & aftercare']} actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setNewOpen(true)}>New portal</Button>} />
      <PageBody>
        <div className="grid grid-cols-4 gap-4">
          <Kpi variant="deep" label="Active portals" value={String(active)} delta={`${portals.length} total`} />
          <Kpi label="Awaiting first login" value={String(portals.filter((p) => p.status === 'invited').length)} delta="Invited" deltaTone="muted" />
          <Kpi variant="blue" label="Total viewing time" value={`${totalMins}m`} delta="Across all customers" deltaTone="muted" />
          <Kpi label="Engagement events" value={String(portalEvents.length)} delta="Views, clicks, chats" deltaTone="muted" />
        </div>

        <Table
          template="1.6fr 1.4fr 0.9fr 1fr 1.2fr 0.7fr"
          columns={[{ key: 'c', header: 'Customer' }, { key: 'a', header: 'System' }, { key: 's', header: 'Status' }, { key: 'l', header: 'Last active' }, { key: 'e', header: 'Engagement' }, { key: 'x', header: '' }]}
          footer={<span>{portals.length} portals</span>}
        >
          {portals.map((p) => {
            const st = stats(p.id)
            return (
              <Row key={p.id} template="1.6fr 1.4fr 0.9fr 1fr 1.2fr 0.7fr" onClick={() => nav(`/customers/${p.id}`)}>
                <Cell><div className="flex items-center gap-2.5"><Avatar name={p.customer} size={30} /><div className="min-w-0"><div className="font-semibold text-ink-2 truncate">{p.customer}</div><div className="text-[12px] text-muted-2 truncate">{p.email}</div></div></div></Cell>
                <Cell muted>{p.systemKwp} kWp · {money(p.systemCost, { compact: true })}</Cell>
                <Cell><Chip tone={p.status === 'active' ? 'positive' : 'warning'} dot>{p.status === 'active' ? 'Active' : 'Invited'}</Chip></Cell>
                <Cell muted>{p.lastActiveAt ? rel(p.lastActiveAt) : '—'}</Cell>
                <Cell muted>{st.events} events · {st.mins}m viewed</Cell>
                <Cell align="right"><span className="text-accent font-semibold text-[13px]">Open →</span></Cell>
              </Row>
            )
          })}
        </Table>

        {wonNoPortal.length > 0 && (
          <div>
            <div className="eyebrow text-muted-3 mb-2">Won customers without a portal yet · {wonNoPortal.length}</div>
            <div className="flex flex-col gap-2">
              {wonNoPortal.map((d) => (
                <div key={d.id} className="bg-surface border border-border rounded-card px-4 py-3 flex items-center gap-3">
                  <Avatar name={d.org} size={30} square />
                  <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate">{d.org}</div><div className="text-[12px] text-muted-2">{d.name} · {money(d.value, { compact: true })}</div></div>
                  <Button variant="primary" icon={<Plus size={15} />} onClick={() => setupPortal(d)}>Set up portal</Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </PageBody>
      <NewPortalModal open={newOpen} onClose={() => setNewOpen(false)} onCreated={(id) => { setNewOpen(false); nav(`/customers/${id}`) }} />
    </>
  )
}

function NewPortalModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { deals, people } = useState_()
  const act = useActions()
  const [dealId, setDealId] = useState('')
  const [customer, setCustomer] = useState('')
  const [email, setEmail] = useState('')
  const [kwp, setKwp] = useState('6')
  const [cost, setCost] = useState('9000')
  const pickDeal = (id: string) => {
    setDealId(id)
    const d = deals.find((x) => x.id === id); if (!d) return
    const c = people.find((p) => d.personIds.includes(p.id))
    setCustomer(c?.name || d.org); setEmail(c?.email || '')
    if (d.solar) { setKwp(String(d.solar.systemKwp)); setCost(String(Math.round(d.solar.systemCost))) }
  }
  return (
    <Modal open={open} onClose={onClose} title="New customer portal" subtitle="Give a customer their own login after a proposal"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { if (customer.trim()) { const p = act.createPortal({ dealId: dealId || undefined, customer: customer.trim(), email, address: deals.find((d) => d.id === dealId)?.org ?? '', systemKwp: Number(kwp) || 0, systemCost: Number(cost) || 0, annualSavings: Math.round((Number(cost) || 0) * 0.12) }); onCreated(p.id) } }}>Create &amp; invite</Button></>}>
      <Field label="From a deal (optional)"><Select value={dealId} onChange={(e) => pickDeal(e.target.value)}><option value="">Start blank</option>{deals.filter((d) => !d.lost).map((d) => (<option key={d.id} value={d.id}>{d.name} · {d.org}</option>))}</Select></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Customer"><Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Full name" autoFocus /></Field>
        <Field label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="System (kWp)"><Input type="number" value={kwp} onChange={(e) => setKwp(e.target.value)} /></Field>
        <Field label="System cost (£)"><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

/* ============================ The portal itself ============================ */
type Tab = 'Account' | 'Overview' | 'Energy' | 'Documents' | 'Support' | 'Resources' | 'Analytics'
const TEAM_TABS: Tab[] = ['Account', 'Analytics']
const TABS: { id: Tab; icon: any }[] = [
  { id: 'Account', icon: Building }, { id: 'Overview', icon: Sun }, { id: 'Energy', icon: Bolt }, { id: 'Documents', icon: FileIcon }, { id: 'Support', icon: Wrench }, { id: 'Resources', icon: Play }, { id: 'Analytics', icon: Sparkle },
]

export function CustomerPortal() {
  const { id } = useParams()
  const nav = useNavigate()
  const { portals } = useState_()
  const portal = portals.find((p) => p.id === id)
  const [tab, setTab] = useState<Tab>('Account')
  if (!portal) return (<><TopBar title="Customer portals" /><PageBody><div className="text-muted-b">Portal not found. <button onClick={() => nav('/customers')} className="text-accent font-semibold">Back</button>.</div></PageBody></>)

  return (
    <>
      <TopBar title={portal.customer} crumbs={['Customers']} actions={<><Chip tone={portal.status === 'active' ? 'positive' : 'warning'} dot>{portal.status === 'active' ? 'Active' : 'Invited'}</Chip><Button onClick={() => nav('/customers')}>All customers</Button></>} />
      {/* preview banner — only on the customer-facing tabs */}
      {!TEAM_TABS.includes(tab) && (
        <div className="shrink-0 px-7 py-2 text-[12px] font-medium text-white flex items-center gap-2" style={{ background: CUSTOMER_ACCENT }}>
          <Sun size={14} /> Customer portal preview — this is what {portal.customer.split(' ')[0]} sees when they log in.
        </div>
      )}
      <div className="flex-1 flex min-h-0">
        {/* tab rail */}
        <aside className="w-[190px] shrink-0 bg-surface border-r border-border p-3 flex flex-col gap-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={classNames('flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-left transition-colors', tab === t.id ? 'font-semibold' : 'text-ink-3 hover:bg-control')} style={tab === t.id ? { background: '#E9F5F1', color: CUSTOMER_ACCENT } : undefined}>
              <t.icon size={16} /> {t.id}{TEAM_TABS.includes(t.id) && <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-muted-3">Team</span>}
            </button>
          ))}
        </aside>
        {/* content */}
        <main className="flex-1 overflow-y-auto p-6 min-w-0">
          {tab === 'Account' && <AccountTab portal={portal} />}
          {tab === 'Overview' && <OverviewTab portal={portal} />}
          {tab === 'Energy' && <EnergyTab portal={portal} />}
          {tab === 'Documents' && <DocumentsTab portal={portal} />}
          {tab === 'Support' && <SupportTab portal={portal} />}
          {tab === 'Resources' && <ResourcesTab portal={portal} />}
          {tab === 'Analytics' && <AnalyticsTab portal={portal} />}
        </main>
        {/* scoped Ask Ovi */}
        <PortalChat portal={portal} />
      </div>
    </>
  )
}

/* ---- energy model (deterministic day) ---- */
function portalEnergy(p: Portal) {
  const peak = p.systemKwp
  const hours = Array.from({ length: 24 }, (_, h) => {
    const gen = h >= 6 && h <= 20 ? Math.max(0, peak * Math.exp(-Math.pow((h - 13) / 3.2, 2))) : 0
    const use = 0.3 + (h >= 7 && h <= 9 ? 1.1 : 0) + (h >= 17 && h <= 21 ? 1.6 : 0) + (h % 5 === 0 ? 0.3 : 0.15)
    return { h, gen: Math.round(gen * 10) / 10, use: Math.round(use * 10) / 10 }
  })
  const todayGen = Math.round(hours.reduce((s, x) => s + x.gen, 0) * 10) / 10
  const todayUse = Math.round(hours.reduce((s, x) => s + x.use, 0) * 10) / 10
  const cur = hours[Math.min(23, new Date().getHours())]
  const solar = cur.gen, home = cur.use
  return { hours, todayGen, todayUse, todaySaving: Math.round(todayGen * 0.28 * 100) / 100, batteryPct: 40 + Math.round((todayGen % 5) * 9), solar, home, toBattery: Math.max(0, solar - home), fromGrid: Math.max(0, home - solar), exporting: Math.max(0, solar - home - 1.5) }
}

const jobTone: Record<string, 'accent' | 'positive' | 'warning' | 'negative' | 'neutral'> = { unscheduled: 'warning', scheduled: 'accent', 'in-progress': 'accent', complete: 'positive', cancelled: 'negative' }

/* ---- team-facing 360: everything associated with this customer ---- */
function AccountTab({ portal }: { portal: Portal }) {
  const nav = useNavigate()
  const { deals, people, jobs, activities } = useState_()
  const deal = deals.find((d) => d.id === portal.dealId)
  const contact = deal ? people.find((p) => deal.personIds.includes(p.id)) : people.find((p) => p.email === portal.email)
  const custJobs = jobs.filter((j) => j.portalId === portal.id || (portal.dealId && j.dealId === portal.dealId))
  const support = custJobs.filter((j) => j.kind === 'remedial' || j.portalId === portal.id)
  const timeline = activities.filter((a) => (portal.dealId && a.dealId === portal.dealId) || (contact && a.personId === contact.id)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 8)

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card bg-[#F1FAF7] border border-[#B9E0D4] px-4 py-2 text-[12px] text-[#0a5a4a] flex items-center gap-2"><Building size={13} /> Team view — everything you have on {portal.customer}. The customer doesn't see this tab.</div>
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* contact + deal */}
        <div className="bg-surface border border-border rounded-card p-5">
          <div className="text-[14px] font-semibold text-ink mb-3">Contact</div>
          {contact ? (
            <button onClick={() => nav(`/people/${contact.id}`)} className="flex items-center gap-3 text-left w-full mb-3">
              <Avatar name={contact.name} size={40} />
              <div className="min-w-0"><div className="text-[14px] font-semibold text-ink-2">{contact.name}</div><div className="text-[12px] text-muted-2">{contact.role || '—'}</div></div>
            </button>
          ) : <div className="text-[13px] text-muted-2 mb-3">{portal.customer}</div>}
          <Detail label="Email" value={contact?.email || portal.email} />
          <Detail label="Phone" value={contact?.phone || '—'} />
          <Detail label="Site" value={portal.address} />
        </div>
        <div className="bg-surface border border-border rounded-card p-5">
          <div className="text-[14px] font-semibold text-ink mb-3">Deal &amp; system</div>
          {deal ? (
            <button onClick={() => nav(`/deals/${deal.id}`)} className="flex items-center justify-between w-full mb-3 text-left"><span className="text-[13.5px] font-semibold text-accent">{deal.name}</span><Chip tone={deal.won ? 'positive' : 'accent'}>{deal.won ? 'Won' : deal.stage}</Chip></button>
          ) : <div className="text-[13px] text-muted-2 mb-3">No linked deal</div>}
          <Detail label="System" value={`${portal.systemKwp} kWp`} />
          <Detail label="Value" value={money(portal.systemCost)} />
          <Detail label="Annual saving" value={money(portal.annualSavings)} />
          {portal.installDate && <Detail label="Installed" value={portal.installDate} />}
        </div>
      </div>

      {/* jobs / service */}
      <div className="bg-surface border border-border rounded-card p-5">
        <div className="flex items-center gap-2 mb-3"><Wrench size={15} className="text-accent" /><span className="text-[14px] font-semibold text-ink">Jobs &amp; service</span><span className="ml-auto text-[12px] text-muted-2">{custJobs.length} total · {support.length} support</span></div>
        {custJobs.length === 0 ? <div className="text-[13px] text-muted-2">No jobs for this customer yet.</div> : (
          <div className="flex flex-col divide-y divide-divider">
            {custJobs.map((j) => (
              <button key={j.id} onClick={() => nav('/jobs')} className="flex items-center gap-3 py-2 text-left">
                <span className="font-mono text-[11px] text-muted-3 w-20 shrink-0">{j.ref}</span>
                <span className="text-[13px] font-medium text-ink-2 flex-1 truncate">{j.title}{j.portalId && <span className="ml-2 text-[10.5px] text-[#0E7C66] font-semibold">via portal</span>}</span>
                <span className="text-[12px] text-muted-2">{j.date ?? 'Unscheduled'}</span>
                <Chip tone={jobTone[j.status]}>{j.status}</Chip>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* activity */}
      <div className="bg-surface border border-border rounded-card p-5">
        <div className="text-[14px] font-semibold text-ink mb-3">Recent activity</div>
        {timeline.length === 0 ? <div className="text-[13px] text-muted-2">Nothing logged yet.</div> : (
          <div className="flex flex-col gap-2.5">
            {timeline.map((t) => (
              <div key={t.id} className="flex gap-2.5"><span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-1.5" /><div className="min-w-0"><div className="text-[12.5px] font-medium text-ink-2">{t.subject}</div><div className="text-[11px] text-muted-3">{t.who} · {rel(t.createdAt)}</div></div></div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---- customer-facing support: report a problem, see your requests ---- */
function SupportTab({ portal }: { portal: Portal }) {
  const { jobs } = useState_()
  const [report, setReport] = useState(false)
  const mine = jobs.filter((j) => j.portalId === portal.id).sort((a, b) => b.createdAt - a.createdAt)
  const statusLabel: Record<string, string> = { unscheduled: 'Logged — we’ll be in touch', scheduled: 'Engineer booked', 'in-progress': 'In progress', complete: 'Resolved', cancelled: 'Closed' }
  return (
    <div className="max-w-[720px] flex flex-col gap-4">
      <div className="rounded-card p-5 flex items-center gap-4" style={{ background: '#E9F5F1', border: '1px solid #B9E0D4' }}>
        <span className="w-11 h-11 rounded-xl text-white flex items-center justify-center shrink-0" style={{ background: CUSTOMER_ACCENT }}><Wrench size={20} /></span>
        <div className="flex-1"><div className="text-[15px] font-bold text-ink">Something not right?</div><div className="text-[13px] text-muted-b">Tell us what’s happening — add a photo if it helps — and we’ll sort it. Ovi will try to fix it instantly first.</div></div>
        <Button variant="primary" onClick={() => setReport(true)}>Report a problem</Button>
      </div>
      <div className="text-[14px] font-semibold text-ink">Your requests</div>
      {mine.length === 0 ? <div className="text-[13px] text-muted-2 bg-surface border border-border rounded-card p-4">No requests yet — everything looks healthy.</div> : mine.map((j) => (
        <div key={j.id} className="bg-surface border border-border rounded-card p-4 flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-accent-wash text-accent flex items-center justify-center shrink-0"><Wrench size={16} /></span>
          <div className="min-w-0 flex-1"><div className="text-[13.5px] font-semibold text-ink-2">{j.title.replace(/^Support: /, '')}</div>{j.notes && <div className="text-[12px] text-muted-2 truncate">{j.notes}</div>}<div className="text-[11px] text-muted-3 mt-0.5">{j.ref} · {rel(j.createdAt)}</div></div>
          <Chip tone={jobTone[j.status]} dot>{statusLabel[j.status] ?? j.status}</Chip>
        </div>
      ))}
      <ReportProblemModal open={report} onClose={() => setReport(false)} portal={portal} />
    </div>
  )
}

function ReportProblemModal({ open, onClose, portal }: { open: boolean; onClose: () => void; portal: Portal }) {
  const act = useActions()
  const [item, setItem] = useState('Battery')
  const [desc, setDesc] = useState('')
  const [photo, setPhoto] = useState('')
  const submit = () => {
    if (!desc.trim()) return
    act.reportPortalIssue(portal, item, desc.trim(), photo || undefined)
    act.logPortalEvent(portal.id, 'Support', `Reported: ${item}`, 'click')
    setDesc(''); setPhoto(''); onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Report a problem" subtitle="We’ll turn this into a service visit — and Ovi can often help right away"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={<Send size={15} />} onClick={submit}>Send to my installer</Button></>}>
      <Field label="What's the issue with?"><Select value={item} onChange={(e) => setItem(e.target.value)}>{['Battery', 'Inverter', 'Solar panels', 'Monitoring app', 'EV charger', 'Something else'].map((x) => (<option key={x}>{x}</option>))}</Select></Field>
      <Field label="Describe what's happening"><Textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. The battery shows a red light and the app says it's offline since this morning." autoFocus /></Field>
      <button onClick={() => setPhoto(photo ? '' : 'IMG_4021.jpg')} className={classNames('w-full rounded-control border border-dashed py-3 flex items-center justify-center gap-2 text-[12.5px] transition-colors', photo ? 'border-positive-border bg-[#F4FAF8] text-positive' : 'border-input-border text-muted-2 hover:border-accent')}>
        {photo ? <><Check size={14} /> {photo} attached</> : <><Plus size={14} /> Add a photo (optional)</>}
      </button>
    </Modal>
  )
}

function OverviewTab({ portal }: { portal: Portal }) {
  const payback = portal.annualSavings ? Math.round((portal.systemCost / portal.annualSavings) * 10) / 10 : 0
  return (
    <div className="max-w-[720px] flex flex-col gap-4">
      <div className="rounded-card p-6 text-white" style={{ background: 'linear-gradient(150deg,#0E7C66,#0a5a4a)' }}>
        <div className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: '#9BE8D4' }}><Sun size={14} /> YOUR SOLAR SYSTEM</div>
        <div className="text-[26px] font-bold mt-1.5">{portal.systemKwp} kWp · saving £{portal.annualSavings.toLocaleString()}/yr</div>
        <div className="text-[13px] mt-1" style={{ color: '#C7EFE4' }}>{portal.address}{portal.installDate ? ` · installed ${portal.installDate}` : ''}</div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Kpi label="System size" value={`${portal.systemKwp} kWp`} delta="Panels + battery" deltaTone="muted" />
        <Kpi variant="blue" label="Yearly saving" value={money(portal.annualSavings)} delta="Projected" />
        <Kpi label="Payback" value={`${payback} yrs`} delta="Then it's free energy" deltaTone="muted" />
      </div>
      <div className="bg-surface border border-border rounded-card p-5">
        <div className="text-[14px] font-semibold text-ink mb-2">Everything you need, in one place</div>
        <div className="text-[13px] text-muted-b leading-relaxed">Check your live generation and savings under <b>Energy</b>, find your paperwork under <b>Documents</b>, and watch guides or troubleshoot a specific part under <b>Resources</b>. Stuck on anything? Ask Ovi on the right — it knows your system and your manuals.</div>
      </div>
    </div>
  )
}

function EnergyTab({ portal }: { portal: Portal }) {
  const e = useMemo(() => portalEnergy(portal), [portal])
  const maxH = Math.max(1, ...e.hours.map((h) => Math.max(h.gen, h.use)))
  const flow = [
    { label: 'Solar now', value: `${e.solar} kW`, color: '#0E7C66' },
    { label: 'Home use', value: `${e.home} kW`, color: '#1D4ED8' },
    { label: e.exporting > 0 ? 'Exporting' : 'From grid', value: `${(e.exporting > 0 ? e.exporting : e.fromGrid).toFixed(1)} kW`, color: e.exporting > 0 ? '#0E7C66' : '#C2410C' },
    { label: 'Battery', value: `${e.batteryPct}%`, color: '#7C3AED' },
  ]
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-positive animate-pulse" /><span className="text-[12px] text-muted-2">Live · updates every few seconds</span></div>
      <div className="grid grid-cols-4 gap-3">
        {flow.map((f) => (
          <div key={f.label} className="bg-surface border border-border rounded-card p-4"><div className="text-[11.5px] text-muted-2">{f.label}</div><div className="text-[22px] font-bold mt-0.5" style={{ color: f.color }}>{f.value}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Kpi variant="deep" label="Generated today" value={`${e.todayGen} kWh`} delta="Solar" />
        <Kpi label="Used today" value={`${e.todayUse} kWh`} delta="Home" deltaTone="muted" />
        <Kpi variant="blue" label="Saved today" value={money(e.todaySaving)} delta="vs. all-grid" />
      </div>
      <div className="bg-surface border border-border rounded-card p-5">
        <div className="text-[14px] font-semibold text-ink mb-4">Today — generation vs. use</div>
        <div className="flex items-end gap-[3px] h-[160px]">
          {e.hours.map((h) => (
            <div key={h.h} className="flex-1 flex flex-col justify-end gap-0.5 relative group">
              <div className="w-full rounded-t" style={{ height: `${(h.gen / maxH) * 130}px`, background: '#0E7C66' }} />
              <div className="w-full" style={{ height: `${(h.use / maxH) * 130}px`, background: '#BFD3F5' }} />
              {h.h % 6 === 0 && <div className="text-[9px] text-muted-3 text-center absolute -bottom-4 left-0 right-0">{h.h}:00</div>}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-6 text-[11.5px] text-muted-2"><span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#0E7C66' }} />Solar generated</span><span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#BFD3F5' }} />Home used</span></div>
      </div>
    </div>
  )
}

function DocumentsTab({ portal }: { portal: Portal }) {
  const act = useActions()
  const docs = [
    { title: 'Your proposal', kind: 'PDF', desc: 'System design, savings & pricing' },
    { title: 'Installation contract', kind: 'PDF', desc: 'Signed agreement' },
    { title: 'Handover certificate', kind: 'PDF', desc: 'MCS + DNO sign-off' },
    { title: 'Product warranties', kind: 'PDF', desc: 'Panels, inverter & battery' },
    { title: 'Your invoice', kind: 'PDF', desc: money(portal.systemCost) },
  ]
  return (
    <div className="max-w-[720px] flex flex-col gap-3">
      <div className="text-[14px] font-semibold text-ink">Your documents</div>
      {docs.map((d) => (
        <div key={d.title} className="bg-surface border border-border rounded-card p-4 flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-accent-wash text-accent flex items-center justify-center shrink-0"><FileIcon size={17} /></span>
          <div className="min-w-0 flex-1"><div className="text-[13.5px] font-semibold text-ink-2">{d.title}</div><div className="text-[12px] text-muted-2">{d.kind} · {d.desc}</div></div>
          <Button icon={<Download size={15} />} onClick={() => act.logPortalEvent(portal.id, 'Documents', d.title, 'download')}>Download</Button>
        </div>
      ))}
    </div>
  )
}

const RES_META: Record<string, { icon: any; label: string; color: string }> = {
  video: { icon: Play, label: 'Video', color: '#B01B4F' }, manual: { icon: FileIcon, label: 'Manual', color: '#1D4ED8' }, 'case-study': { icon: Sparkle, label: 'Case study', color: '#0E7C66' }, guide: { icon: FileIcon, label: 'Guide', color: '#7C3AED' },
}
function ResourcesTab({ portal }: { portal: Portal }) {
  const { portalResources } = useState_()
  const act = useActions()
  const [upload, setUpload] = useState(false)
  const mine = portalResources.filter((r) => r.global || r.portalId === portal.id)
  const groups: { key: string; items: PortalResource[] }[] = [
    { key: 'Watch & learn', items: mine.filter((r) => r.type === 'video' || r.type === 'case-study') },
    { key: 'Guides & manuals', items: mine.filter((r) => r.type === 'manual' || r.type === 'guide') },
  ]
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2"><div className="text-[14px] font-semibold text-ink flex-1">Resources</div><Button icon={<Plus size={15} />} onClick={() => setUpload(true)}>Upload manual</Button></div>
      {groups.map((g) => (
        <div key={g.key}>
          <div className="eyebrow text-muted-3 mb-2">{g.key}</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))' }}>
            {g.items.map((r) => {
              const m = RES_META[r.type]
              return (
                <div key={r.id} className="bg-surface border border-border rounded-card p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2"><span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: m.color + '18', color: m.color }}><m.icon size={15} /></span><div className="min-w-0"><div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: m.color }}>{m.label}{r.manufacturer ? ` · ${r.manufacturer}` : ''}</div></div>{r.duration && <span className="ml-auto text-[11px] text-muted-3">{r.duration}</span>}</div>
                  <div className="text-[13.5px] font-semibold text-ink-2 leading-snug">{r.title}</div>
                  <div className="text-[12px] text-muted-2 leading-snug flex-1">{r.desc}</div>
                  <button onClick={() => { act.logPortalEvent(portal.id, 'Resources', r.title, r.type === 'video' ? 'video' : 'view'); window.dispatchEvent(new CustomEvent('portal-ask', { detail: r.manufacturer ? `Help me with my ${r.manufacturer} ${r.type === 'manual' ? 'unit' : 'system'}` : `Tell me about: ${r.title}` })) }} className="text-[12px] font-semibold inline-flex items-center gap-1.5" style={{ color: CUSTOMER_ACCENT }}><Sparkle size={13} /> {r.type === 'video' ? 'Watch' : 'Ask Ovi about this'}</button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <UploadResourceModal open={upload} onClose={() => setUpload(false)} portalId={portal.id} />
    </div>
  )
}

function UploadResourceModal({ open, onClose, portalId }: { open: boolean; onClose: () => void; portalId: string }) {
  const act = useActions()
  const [title, setTitle] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [content, setContent] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="Upload a manual" subtitle="Ovi will read it and answer the customer's questions from it"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { if (title.trim()) { act.addResource({ type: 'manual', title: title.trim(), manufacturer: manufacturer || undefined, desc: `${manufacturer || 'Product'} manual`, content, global: !portalId, portalId: portalId || undefined }); setTitle(''); setManufacturer(''); setContent(''); onClose() } }}>Add to library</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Powerwall owner's manual" autoFocus /></Field>
        <Field label="Manufacturer"><Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="Tesla" /></Field>
      </div>
      <Field label="Manual text (what Ovi searches)"><Textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste the troubleshooting steps / key sections…" /></Field>
    </Modal>
  )
}

function AnalyticsTab({ portal }: { portal: Portal }) {
  const { portalEvents } = useState_()
  const events = portalEvents.filter((e) => e.portalId === portal.id).sort((a, b) => b.at - a.at)
  const bySection = useMemo(() => {
    const m: Record<string, { count: number; dwell: number }> = {}
    events.forEach((e) => { const s = (m[e.section] ??= { count: 0, dwell: 0 }); s.count++; s.dwell += e.dwellMs ?? 0 })
    return Object.entries(m).sort((a, b) => b[1].dwell - a[1].dwell)
  }, [events])
  const totalDwell = events.reduce((s, e) => s + (e.dwellMs ?? 0), 0)
  const maxDwell = Math.max(1, ...bySection.map(([, v]) => v.dwell))
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card bg-[#FBF6EC] border border-[#EAD9B0] px-4 py-2 text-[12px] text-[#8A5A00] flex items-center gap-2"><Sparkle size={13} /> Team-only — the customer never sees this. Full behavioural analytics for {portal.customer}.</div>
      <div className="grid grid-cols-3 gap-3">
        <Kpi variant="deep" label="Total time in portal" value={`${Math.round(totalDwell / 60000)}m`} delta={`${events.length} events`} />
        <Kpi label="Sections viewed" value={String(bySection.length)} delta="of 5" deltaTone="muted" />
        <Kpi variant="blue" label="Last seen" value={portal.lastActiveAt ? rel(portal.lastActiveAt) : '—'} delta={portal.status} />
      </div>
      <div className="bg-surface border border-border rounded-card p-5">
        <div className="text-[14px] font-semibold text-ink mb-4">Where they spend their time</div>
        <div className="flex flex-col gap-3">
          {bySection.map(([section, v]) => (
            <div key={section}>
              <div className="flex justify-between text-[12.5px] mb-1"><span className="text-ink-3 font-medium">{section}</span><span className="text-muted-2">{Math.round(v.dwell / 60000)}m · {v.count} events</span></div>
              <div className="h-2 rounded-full bg-control overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(v.dwell / maxDwell) * 100}%`, background: CUSTOMER_ACCENT }} /></div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-surface border border-border rounded-card p-5">
        <div className="text-[14px] font-semibold text-ink mb-3">Click-by-click activity</div>
        <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto">
          {events.map((e) => <EventRow key={e.id} e={e} />)}
        </div>
      </div>
    </div>
  )
}
function EventRow({ e }: { e: PortalEvent }) {
  const tone: Record<string, string> = { view: '#1D4ED8', click: '#7C3AED', download: '#0E7C66', chat: '#B01B4F', video: '#C2410C', login: '#5B6577' }
  return (
    <div className="flex items-center gap-3 text-[12.5px]">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tone[e.kind] }} />
      <span className="text-muted-3 w-16 shrink-0">{rel(e.at)}</span>
      <span className="text-muted-2 w-20 shrink-0">{e.section}</span>
      <span className="text-ink-2 flex-1 truncate">{e.label}</span>
      {e.dwellMs ? <span className="text-muted-3 shrink-0">{Math.round(e.dwellMs / 1000)}s</span> : <span className="text-muted-3 shrink-0 capitalize">{e.kind}</span>}
    </div>
  )
}

/* ---- scoped customer chat ---- */
type Turn = { role: 'you' | 'ovi'; text: string; blocks?: PortalBlock[]; source?: string }
function PortalChat({ portal }: { portal: Portal }) {
  const { portalResources } = useState_()
  const act = useActions()
  const resources = portalResources.filter((r) => r.global || r.portalId === portal.id)
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [working, setWorking] = useState<string[] | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const busy = useRef(false)

  const ask = (text: string) => {
    if (!text.trim() || busy.current) return
    busy.current = true
    setTurns((t) => [...t, { role: 'you', text }])
    setDraft('')
    act.logPortalEvent(portal.id, 'Ask Ovi', `“${text.slice(0, 40)}”`, 'chat')
    const plan = customerAnswer(text, { portal, resources })
    let i = 0
    const tick = () => {
      setWorking(plan.working.slice(0, i + 1))
      setTimeout(() => { i++; if (i < plan.working.length) tick(); else { setWorking(null); setTurns((t) => [...t, { role: 'ovi', text: plan.text, blocks: plan.blocks, source: plan.source }]); busy.current = false; setTimeout(() => scroller.current?.scrollTo({ top: 9e9, behavior: 'smooth' }), 30) } }, 480 + Math.random() * 320)
    }
    tick()
    setTimeout(() => scroller.current?.scrollTo({ top: 9e9, behavior: 'smooth' }), 30)
  }
  // Resources tab can hand a question to the chat.
  useMemo(() => {
    const h = (ev: Event) => ask((ev as CustomEvent).detail as string)
    window.addEventListener('portal-ask', h as EventListener)
    return () => window.removeEventListener('portal-ask', h as EventListener)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal.id, resources.length])

  return (
    <aside className="w-[350px] shrink-0 border-l border-border bg-canvas flex flex-col">
      <div className="h-14 shrink-0 flex items-center gap-2.5 px-4 border-b border-border" style={{ background: '#E9F5F1' }}>
        <span className="w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0" style={{ background: CUSTOMER_ACCENT }}><Robot size={16} /></span>
        <div className="min-w-0"><div className="text-[13.5px] font-bold text-ink">Ask Ovi</div><div className="text-[11px] text-muted-2">Your system assistant · doesn't see the CRM</div></div>
      </div>
      <div ref={scroller} className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3">
        {turns.length === 0 && (
          <div className="flex flex-col gap-2.5">
            <div className="text-[13px] text-muted-b">Hi {portal.customer.split(' ')[0]} — I can help with your system, your savings, and any problems with your kit. Try:</div>
            {portalStarters.map((s) => (
              <button key={s} onClick={() => ask(s)} className="text-left bg-surface border border-border rounded-xl px-3 py-2 text-[12.5px] text-ink-3 hover:border-[#8FD3C2] transition-colors flex items-center gap-2"><Sparkle size={13} style={{ color: CUSTOMER_ACCENT }} />{s}</button>
            ))}
          </div>
        )}
        {turns.map((t, i) => t.role === 'you' ? (
          <div key={i} className="self-end max-w-[85%] rounded-2xl px-3 py-2 text-[12.5px] text-white" style={{ background: CUSTOMER_ACCENT }}>{t.text}</div>
        ) : (
          <div key={i} className="flex flex-col gap-2 max-w-[92%]">
            <div className="rounded-2xl px-3 py-2 text-[12.5px] bg-surface border border-border text-ink-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: t.text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') }} />
            {t.blocks?.map((b, bi) => <ChatBlock key={bi} b={b} />)}
            {t.source && <div className="text-[10.5px] text-muted-3 flex items-center gap-1"><FileIcon size={10} /> from {t.source}</div>}
          </div>
        ))}
        {working && <div className="flex items-center gap-2 text-[12px] text-muted-2"><Sparkle size={13} className="animate-pulse" style={{ color: CUSTOMER_ACCENT }} /> {working[working.length - 1]}…</div>}
      </div>
      <div className="p-2.5 border-t border-border bg-surface flex items-center gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') ask(draft) }} placeholder="Ask about your system…" className="flex-1 h-9 px-3 rounded-full border border-input-border bg-white text-[13px] outline-none focus:border-[#0E7C66]" />
        <button onClick={() => ask(draft)} className="w-9 h-9 rounded-full text-white flex items-center justify-center shrink-0" style={{ background: CUSTOMER_ACCENT }}><Send size={15} /></button>
      </div>
    </aside>
  )
}

function ChatBlock({ b }: { b: PortalBlock }) {
  if (b.type === 'text') return <div className="text-[12px] text-ink-3 px-1" dangerouslySetInnerHTML={{ __html: b.text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') }} />
  if (b.type === 'stats') return <div className="grid grid-cols-3 gap-1.5">{b.items.map((s, i) => (<div key={i} className="bg-surface border border-border rounded-lg px-2 py-1.5"><div className="text-[9.5px] text-muted-2">{s.label}</div><div className="text-[12.5px] font-bold text-ink">{s.value}</div></div>))}</div>
  if (b.type === 'manual') return <div className="rounded-xl border p-2.5" style={{ borderColor: '#B9E0D4', background: '#F1FAF7' }}><div className="text-[10.5px] font-semibold uppercase tracking-wide flex items-center gap-1" style={{ color: CUSTOMER_ACCENT }}><FileIcon size={11} /> {b.title}{b.manufacturer ? ` · ${b.manufacturer}` : ''}</div><div className="text-[12px] text-ink-3 mt-1 leading-snug italic">“{b.excerpt}”</div></div>
  if (b.type === 'steps') return <div className="rounded-xl bg-surface border border-border p-2.5"><div className="text-[11px] font-semibold text-ink-2 mb-1.5">{b.title}</div><ol className="flex flex-col gap-1">{b.steps.map((s, i) => (<li key={i} className="flex gap-2 text-[12px] text-ink-3"><span className="w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5" style={{ background: CUSTOMER_ACCENT }}>{i + 1}</span>{s}</li>))}</ol></div>
  return null
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between py-1 gap-3"><span className="text-[12px] text-muted-2 shrink-0">{label}</span><span className="text-[12.5px] font-medium text-ink-2 truncate">{value}</span></div>
}

/* ============================ Suite pages ============================ */
export function SupportRequests() {
  const nav = useNavigate()
  const { jobs, portals } = useState_()
  const requests = jobs.filter((j) => j.portalId).sort((a, b) => b.createdAt - a.createdAt)
  const open = requests.filter((j) => j.status !== 'complete' && j.status !== 'cancelled')
  const portalOf = (id?: string) => portals.find((p) => p.id === id)
  return (
    <>
      <TopBar title="Support requests" crumbs={['Customers']} />
      <PageBody>
        <div className="grid grid-cols-3 gap-4">
          <Kpi variant="deep" label="Open requests" value={String(open.length)} delta="Raised from portals" />
          <Kpi label="Unscheduled" value={String(requests.filter((j) => j.status === 'unscheduled').length)} delta="Need a slot" deltaTone={requests.some((j) => j.status === 'unscheduled') ? 'negative' : 'muted'} />
          <Kpi variant="blue" label="Resolved" value={String(requests.filter((j) => j.status === 'complete').length)} delta="All time" deltaTone="muted" />
        </div>
        {requests.length === 0 ? (
          <div className="bg-surface border border-border rounded-card p-8 text-center text-[13px] text-muted-b">No support requests — customers can raise these from their portal’s Support tab.</div>
        ) : (
          <Table template="1.4fr 1.6fr 1fr 1fr 0.7fr" columns={[{ key: 'c', header: 'Customer' }, { key: 'i', header: 'Issue' }, { key: 's', header: 'Status' }, { key: 'r', header: 'Raised' }, { key: 'x', header: '' }]} footer={<span>{requests.length} requests</span>}>
            {requests.map((j) => (
              <Row key={j.id} template="1.4fr 1.6fr 1fr 1fr 0.7fr" onClick={() => nav(j.portalId ? `/customers/${j.portalId}` : '/jobs')}>
                <Cell className="font-semibold text-ink-2">{j.customer}</Cell>
                <Cell muted>{j.title.replace(/^Support: /, '')}{j.notes ? ` — ${j.notes.slice(0, 40)}` : ''}</Cell>
                <Cell><Chip tone={jobTone[j.status]} dot>{j.status}</Chip></Cell>
                <Cell muted>{rel(j.createdAt)}</Cell>
                <Cell align="right"><span className="text-accent font-semibold text-[13px]">{portalOf(j.portalId) ? 'Open →' : 'Jobs →'}</span></Cell>
              </Row>
            ))}
          </Table>
        )}
      </PageBody>
    </>
  )
}

export function ResourceLibrary() {
  const { portalResources, portals } = useState_()
  const act = useActions()
  const [upload, setUpload] = useState(false)
  const global = portalResources.filter((r) => r.global)
  const specific = portalResources.filter((r) => !r.global)
  const portalName = (id?: string) => portals.find((p) => p.id === id)?.customer ?? '—'
  const Section = ({ title, items, showOwner }: { title: string; items: PortalResource[]; showOwner?: boolean }) => (
    <div>
      <div className="eyebrow text-muted-3 mb-2">{title}</div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))' }}>
        {items.map((r) => { const m = RES_META[r.type]; return (
          <div key={r.id} className="bg-surface border border-border rounded-card p-4 flex flex-col gap-1.5 group relative">
            <div className="flex items-center gap-2"><span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: m.color + '18', color: m.color }}><m.icon size={15} /></span><span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: m.color }}>{m.label}{r.manufacturer ? ` · ${r.manufacturer}` : ''}</span>{r.duration && <span className="ml-auto text-[11px] text-muted-3">{r.duration}</span>}</div>
            <div className="text-[13.5px] font-semibold text-ink-2 leading-snug">{r.title}</div>
            <div className="text-[12px] text-muted-2 leading-snug flex-1">{r.desc}</div>
            {showOwner && <div className="text-[11px] text-muted-3">Only in: {portalName(r.portalId)}</div>}
            <button onClick={() => act.removeResource(r.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg text-muted-2 hover:text-negative hover:bg-negative-wash text-[15px] leading-none">×</button>
          </div>
        ) })}
      </div>
    </div>
  )
  return (
    <>
      <TopBar title="Resources & manuals" crumbs={['Customers']} actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setUpload(true)}>Upload manual</Button>} />
      <PageBody>
        <div className="text-[13px] text-muted-b">Everything in your customers’ portals — videos, guides, case studies and manufacturer manuals. Ovi reads the manuals to answer customer questions. Global items appear in every portal.</div>
        <Section title={`In every portal · ${global.length}`} items={global} />
        {specific.length > 0 && <Section title={`Customer-specific · ${specific.length}`} items={specific} showOwner />}
      </PageBody>
      <UploadResourceModal open={upload} onClose={() => setUpload(false)} portalId={''} />
    </>
  )
}

function rel(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
