import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Kpi, Chip, Avatar } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Modal, Field, Input, Select, Textarea } from '../components/overlays'
import { Plus, Sparkle, Sun, File as FileIcon, Play, Bolt, Check, Send, MapPin, Clock, Download, Robot, Building, Wrench, Dollar, Bell, Flow, Link, ArrowUpRight, Star, Users, Megaphone, Grid, ChevronRight } from '../components/icons'
import { useState_, useActions } from '../store/store'
import { customerAnswer, portalStarters, type PortalBlock } from '../lib/portalAi'
import type { CustomerPortal as Portal, PortalResource, PortalEvent, PortalMilestone, PortalOffer } from '../store/types'
import { money, classNames } from '../lib/format'

// ── The Solar House brand (customer-facing portal) ──
// mint is the brand colour but is NEVER a text colour on white — accent green carries text on light.
const SH = { accent: '#0E7A66', mint: '#62E4CC', scrim: '#15223B', wash: '#DDF6EF', washSoft: '#EAF4F1', paper: '#FAF9F5' }
const CUSTOMER_ACCENT = SH.accent // most portal accents flow from this token
const SH_FONT = "'Outfit', ui-sans-serif, system-ui, -apple-system, sans-serif"
const SH_HERO = `linear-gradient(140deg, ${SH.scrim} 0%, #123f37 55%, ${SH.accent} 100%)`

// The Solar House wordmark: the mint house logo + lowercase wordmark, à la their brand.
function SolarHouseMark({ size = 30, word = true, on = 'light' }: { size?: number; word?: boolean; on?: 'light' | 'dark' }) {
  return (
    <span className="inline-flex items-center gap-2" style={{ fontFamily: SH_FONT }}>
      <img src="/brand/solar-house-logo.png" alt="The Solar House" width={size} height={size} style={{ display: 'block' }} />
      {word && <span className="font-extrabold tracking-tight lowercase leading-none" style={{ color: on === 'dark' ? '#fff' : SH.scrim, fontSize: size * 0.5 }}>the solar house</span>}
    </span>
  )
}

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
    const portal = act.createPortal({ dealId: d.id, customer: c?.name || d.org, email: c?.email || '', address: d.org, systemKwp: d.solar?.systemKwp ?? 6, systemCost: Math.round(d.solar?.systemCost ?? d.value), annualSavings: Math.round((d.solar?.annualSavings ?? d.value * 0.12)), hasBattery: true, journey: starterJourney() })
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
                <Cell align="right">{p.status === 'invited' ? <button onClick={(e) => { e.stopPropagation(); act.sendPortalInvite(p) }} className="text-accent font-semibold text-[13px]">Send invite</button> : <span className="text-accent font-semibold text-[13px]">Open →</span>}</Cell>
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
  const [platform, setPlatform] = useState('')
  const [hasBattery, setHasBattery] = useState(true)
  const [hasEv, setHasEv] = useState(false)
  const pickDeal = (id: string) => {
    setDealId(id)
    const d = deals.find((x) => x.id === id); if (!d) return
    const c = people.find((p) => d.personIds.includes(p.id))
    setCustomer(c?.name || d.org); setEmail(c?.email || '')
    if (d.solar) { setKwp(String(d.solar.systemKwp)); setCost(String(Math.round(d.solar.systemCost))) }
  }
  const PLATFORMS = ['Tesla', 'SolarEdge', 'Enphase', 'GivEnergy', 'SolisCloud', 'FoxESS', 'GrowattShine', 'SunSynk']
  const MON_URL: Record<string, string> = { Tesla: 'https://www.tesla.com/energy', SolarEdge: 'https://monitoring.solaredge.com', Enphase: 'https://enlighten.enphaseenergy.com', GivEnergy: 'https://www.givenergy.cloud', SolisCloud: 'https://www.soliscloud.com', FoxESS: 'https://www.foxesscloud.com', GrowattShine: 'https://server.growatt.com', SunSynk: 'https://www.sunsynk.net' }
  const create = () => {
    if (!customer.trim()) return
    const p = act.createPortal({ dealId: dealId || undefined, customer: customer.trim(), email, address: deals.find((d) => d.id === dealId)?.org ?? '', systemKwp: Number(kwp) || 0, systemCost: Number(cost) || 0, annualSavings: Math.round((Number(cost) || 0) * 0.12), hasBattery, hasEv, monitoringPlatform: platform || undefined, monitoringUrl: platform ? MON_URL[platform] : undefined, journey: starterJourney() })
    onCreated(p.id)
  }
  return (
    <Modal open={open} onClose={onClose} title="New customer portal" subtitle="Give a customer their own login after a proposal"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={create}>Create &amp; invite</Button></>}>
      <Field label="From a deal (optional)"><Select value={dealId} onChange={(e) => pickDeal(e.target.value)}><option value="">Start blank</option>{deals.filter((d) => !d.lost).map((d) => (<option key={d.id} value={d.id}>{d.name} · {d.org}</option>))}</Select></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Customer"><Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Full name" autoFocus /></Field>
        <Field label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="System (kWp)"><Input type="number" value={kwp} onChange={(e) => setKwp(e.target.value)} /></Field>
        <Field label="System cost (£)"><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
      </div>
      <Field label="Monitoring platform"><Select value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="">None / add later</option>{PLATFORMS.map((p) => (<option key={p} value={p}>{p}</option>))}</Select></Field>
      <div className="flex items-center gap-4 pt-1">
        <label className="flex items-center gap-2 text-[13px] text-ink-2 cursor-pointer"><input type="checkbox" checked={hasBattery} onChange={(e) => setHasBattery(e.target.checked)} /> Has a battery</label>
        <label className="flex items-center gap-2 text-[13px] text-ink-2 cursor-pointer"><input type="checkbox" checked={hasEv} onChange={(e) => setHasEv(e.target.checked)} /> Has an EV charger</label>
      </div>
    </Modal>
  )
}

/* ============================ The portal itself ============================ */
type Tab = 'Account' | 'Overview' | 'Progress' | 'Energy' | 'Savings' | 'Documents' | 'Support' | 'Community' | 'Refer a friend' | 'Resources' | 'Analytics'
const TEAM_TABS: Tab[] = ['Account', 'Analytics']
const TABS: { id: Tab; icon: any }[] = [
  { id: 'Account', icon: Building }, { id: 'Overview', icon: Sun }, { id: 'Progress', icon: Flow }, { id: 'Energy', icon: Bolt }, { id: 'Savings', icon: Dollar }, { id: 'Documents', icon: FileIcon }, { id: 'Support', icon: Wrench }, { id: 'Community', icon: Users }, { id: 'Refer a friend', icon: Sparkle }, { id: 'Resources', icon: Play }, { id: 'Analytics', icon: Sparkle },
]

const CUST_TABS: Tab[] = ['Overview', 'Progress', 'Energy', 'Savings', 'Documents', 'Community', 'Support', 'Resources', 'Refer a friend']
const DOCK_TABS: Tab[] = ['Overview', 'Energy', 'Progress', 'Savings']
const ICON: Record<Tab, any> = Object.fromEntries(TABS.map((t) => [t.id, t.icon])) as Record<Tab, any>

export function CustomerPortal() {
  const { id } = useParams()
  const nav = useNavigate()
  const { portals, portalTemplate } = useState_()
  // The live portal config (Portal builder) decides which sections show, their order, names and colour.
  const cfg = portalTemplate.live
  const navTabs = cfg.sections.filter((s) => s.visible).map((s) => s.id as Tab)
  const labelOf = (t: Tab) => cfg.sections.find((s) => s.id === t)?.label ?? t
  const portal = portals.find((p) => p.id === id)
  const [tab, setTab] = useState<Tab>('Overview')
  const [clientView, setClientView] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  if (!portal) return (<><TopBar title="Customer portals" /><PageBody><div className="text-muted-b">Portal not found. <button onClick={() => nav('/customers')} className="text-accent font-semibold">Back</button>.</div></PageBody></>)
  const go = (t: Tab) => { setTab(t); setMoreOpen(false) }
  const first = portal.customer.split(' ')[0]

  return (
    <div className={classNames('sh-portal flex flex-col min-w-0', clientView ? 'fixed inset-0 z-[70] h-[100dvh]' : 'flex-1 min-h-0')}>
      {/* ---- glass top bar ---- */}
      <header className="shrink-0 sticky top-0 z-30">
        <div className="glass-soft border-b border-white/40 px-4 sm:px-6 h-[62px] flex items-center gap-3">
          <button onClick={() => setTab('Overview')} className="shrink-0"><SolarHouseMark size={30} /></button>
          <nav className="hidden md:flex items-center gap-1 overflow-x-auto no-sb ml-2 flex-1">
            {navTabs.map((t) => { const Ic = ICON[t]; const on = tab === t; return (
              <button key={t} onClick={() => go(t)} className={classNames('shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-[13px] font-semibold transition-colors', on ? 'text-white shadow-primary' : 'text-[#2b5045] hover:bg-white/50')} style={on ? { background: cfg.brandColor } : undefined}><Ic size={15} />{labelOf(t)}</button>
            ) })}
          </nav>
          <div className="flex-1 md:hidden" />
          <div className="flex items-center gap-2 shrink-0">
            {cfg.askOvi && <button onClick={() => setChatOpen(true)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-semibold text-white" style={{ background: SH.scrim }}><Robot size={15} /><span className="hidden sm:inline">Ask Ovi</span></button>}
            {!clientView && (<>
              <button onClick={() => setClientView(true)} className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-semibold glass text-[#0a5a4a]"><Play size={13} /> Client view</button>
              <button onClick={() => nav('/customers')} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12.5px] font-semibold text-[#3D4757] hover:text-ink" title="Back to the CRM"><ChevronRight size={14} className="rotate-180" /><span className="hidden lg:inline">Return to Solar House</span></button>
            </>)}
          </div>
        </div>
        {!clientView && (
          <div className="px-4 sm:px-6 py-1.5 text-[11px] font-medium text-white flex items-center gap-2" style={{ background: SH.scrim }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: SH.mint }} /> Team preview of {first}'s portal ·
            <button onClick={() => setTab('Account')} className={classNames('underline-offset-2 hover:underline', tab === 'Account' && 'underline')} style={{ color: SH.mint }}>Account</button> &amp;
            <button onClick={() => setTab('Analytics')} className={classNames('underline-offset-2 hover:underline', tab === 'Analytics' && 'underline')} style={{ color: SH.mint }}>Analytics</button> are team-only.
          </div>
        )}
      </header>

      {/* ---- content ---- */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1180px] px-4 sm:px-6 pt-5 pb-28 md:pb-10">
          <div key={tab} className="rise">
            {tab === 'Account' && <AccountTab portal={portal} />}
            {tab === 'Overview' && <OverviewTab portal={portal} onGo={setTab} />}
            {tab === 'Progress' && <ProgressTab portal={portal} />}
            {tab === 'Energy' && <EnergyTab portal={portal} />}
            {tab === 'Savings' && <SavingsTab portal={portal} />}
            {tab === 'Documents' && <DocumentsTab portal={portal} />}
            {tab === 'Support' && <SupportTab portal={portal} />}
            {tab === 'Community' && <CommunityTab portal={portal} />}
            {tab === 'Refer a friend' && <ReferTab portal={portal} />}
            {tab === 'Resources' && <ResourcesTab portal={portal} />}
            {tab === 'Analytics' && <AnalyticsTab portal={portal} />}
          </div>
        </div>
      </div>

      {/* ---- mobile bottom dock ---- */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-3 pointer-events-none">
        <div className="glass rounded-2xl px-2 py-1.5 flex items-center justify-around pointer-events-auto">
          {DOCK_TABS.filter((t) => navTabs.includes(t)).map((t) => { const Ic = ICON[t]; const on = tab === t; return (
            <button key={t} onClick={() => go(t)} className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl" style={on ? { color: CUSTOMER_ACCENT } : { color: '#5b6f68' }}><Ic size={20} /><span className="text-[9.5px] font-semibold">{t}</span></button>
          ) })}
          <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl" style={{ color: '#5b6f68' }}><Grid size={20} /><span className="text-[9.5px] font-semibold">More</span></button>
        </div>
      </div>

      {moreOpen && <MoreSheet tab={tab} onGo={go} onClose={() => setMoreOpen(false)} clientView={clientView} onChat={() => { setMoreOpen(false); setChatOpen(true) }} />}

      {clientView && (
        <button onClick={() => setClientView(false)} className="fixed z-[80] bottom-24 right-4 md:bottom-auto md:top-3 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[12.5px] font-semibold glass-dark text-white"><ChevronRight size={13} className="rotate-180" /> Exit client view</button>
      )}

      {chatOpen && <PortalChat portal={portal} onClose={() => setChatOpen(false)} />}
    </div>
  )
}

/* ---- mobile 'more' navigation sheet ---- */
function MoreSheet({ tab, onGo, onClose, clientView, onChat }: { tab: Tab; onGo: (t: Tab) => void; onClose: () => void; clientView: boolean; onChat: () => void }) {
  const rest = CUST_TABS.filter((t) => !DOCK_TABS.includes(t))
  const team = clientView ? [] : (TEAM_TABS as Tab[])
  return (
    <div className="md:hidden fixed inset-0 z-[75] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-[#0a1f19]/40 backdrop-blur-[2px]" />
      <div className="relative glass rounded-t-3xl p-4 pb-8 rise" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-black/15 mx-auto mb-3" />
        <div className="grid grid-cols-3 gap-2.5">
          {rest.map((t) => { const Ic = ICON[t]; const on = tab === t; return (
            <button key={t} onClick={() => onGo(t)} className={classNames('flex flex-col items-center gap-1.5 py-3 rounded-2xl text-[12px] font-semibold', on ? 'text-white' : 'text-[#2b5045] glass-soft')} style={on ? { background: CUSTOMER_ACCENT } : undefined}><Ic size={20} />{t}</button>
          ) })}
          <button onClick={onChat} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-[12px] font-semibold text-white" style={{ background: SH.scrim }}><Robot size={20} />Ask Ovi</button>
        </div>
        {team.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/40">
            <div className="text-[10px] font-bold uppercase tracking-wide text-[#5b6f68] mb-2">Team only</div>
            <div className="grid grid-cols-3 gap-2.5">
              {team.map((t) => { const Ic = ICON[t]; return (
                <button key={t} onClick={() => onGo(t)} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-[12px] font-semibold text-[#2b5045] glass-soft"><Ic size={20} />{t}</button>
              ) })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================ Welcome / login ============================ */
export function PortalWelcome() {
  const { id } = useParams()
  const nav = useNavigate()
  const { portals, portalTemplate } = useState_()
  // The live portal config (Portal builder) decides which sections show, their order, names and colour.
  const cfg = portalTemplate.live
  const navTabs = cfg.sections.filter((s) => s.visible).map((s) => s.id as Tab)
  const labelOf = (t: Tab) => cfg.sections.find((s) => s.id === t)?.label ?? t
  const act = useActions()
  const portal = portals.find((p) => p.id === id)
  const [email, setEmail] = useState(portal?.email ?? '')
  const [sent, setSent] = useState(false)
  if (!portal) return <div className="h-full flex items-center justify-center text-muted-b">Portal not found.</div>
  const login = () => { act.activatePortal(portal.id); nav(`/customers/${portal.id}`) }
  return (
    <div className="h-full overflow-y-auto flex flex-col items-center justify-center p-6 relative" style={{ background: `radial-gradient(1100px 620px at 50% -12%, #123f37 0%, ${SH.scrim} 60%, #0d1728 100%)`, fontFamily: SH_FONT }}>
      <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full opacity-20 pointer-events-none" style={{ background: `radial-gradient(circle, ${SH.mint} 0%, transparent 65%)` }} />
      <div className="w-full max-w-[440px] flex flex-col items-center text-center gap-5 relative">
        <div className="bg-white/10 rounded-2xl px-4 py-2.5"><SolarHouseMark size={34} on="dark" /></div>
        <div>
          <div className="text-[27px] font-extrabold text-white tracking-tight">Welcome back, {portal.customer.split(' ')[0]}</div>
          <div className="text-[14px] mt-1.5" style={{ color: '#C7EFE4' }}>Your {portal.systemKwp} kWp system, live savings, documents and help — all in one place.</div>
        </div>
        <div className="w-full bg-white rounded-2xl shadow-modal p-6 flex flex-col gap-3.5">
          {!sent ? (
            <>
              <div className="text-[13px] text-muted-b text-left">Log in with a secure link — no password needed.</div>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="h-11 px-3.5 rounded-control border border-input-border bg-white text-[14px] outline-none focus:border-[#0E7A66]" />
              <button onClick={() => setSent(true)} className="h-11 rounded-control text-white font-semibold text-[14px]" style={{ background: CUSTOMER_ACCENT }}>Email me a login link</button>
            </>
          ) : (
            <>
              <span className="w-12 h-12 rounded-full bg-[#DDF6EF] text-[#0E7A66] flex items-center justify-center mx-auto"><Send size={22} /></span>
              <div className="text-[15px] font-semibold text-ink">Check your inbox</div>
              <div className="text-[13px] text-muted-b">We sent a secure link to <b className="text-ink-3">{email || portal.email}</b>. For this preview, continue straight in:</div>
              <button onClick={login} className="h-11 rounded-control text-white font-semibold text-[14px]" style={{ background: CUSTOMER_ACCENT }}>Continue to my portal →</button>
            </>
          )}
        </div>
        <button onClick={() => nav(`/customers/${portal.id}`)} className="text-[12.5px] text-white/70 hover:text-white">Skip (team preview)</button>
      </div>
    </div>
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
          <Detail label="System" value={`${portal.systemKwp} kWp${portal.hasBattery ? ' + battery' : ''}${portal.hasEv ? ' + EV' : ''}`} />
          <Detail label="Value" value={money(portal.systemCost)} />
          <Detail label="Annual saving" value={money(portal.annualSavings)} />
          <Detail label="Monitoring" value={portal.monitoringPlatform || '—'} />
          {portal.installDate && <Detail label="Installed" value={fmtDate(portal.installDate) ?? portal.installDate} />}
        </div>
      </div>

      {/* team control: advance the install journey → notifies the customer */}
      <JourneyControl portal={portal} />

      {/* jobs / service */}
      <div className="bg-surface border border-border rounded-card p-5">
        <div className="flex items-center gap-2 mb-3"><Wrench size={15} className="text-accent" /><span className="text-[14px] font-semibold text-ink">Jobs &amp; service</span><span className="ml-auto text-[12px] text-muted-2">{custJobs.length} total · {support.length} support</span></div>
        {custJobs.length === 0 ? <div className="text-[13px] text-muted-2">No jobs for this customer yet.</div> : (
          <div className="flex flex-col divide-y divide-divider">
            {custJobs.map((j) => (
              <button key={j.id} onClick={() => nav('/jobs')} className="flex items-center gap-3 py-2 text-left">
                <span className="font-mono text-[11px] text-muted-3 w-20 shrink-0">{j.ref}</span>
                <span className="text-[13px] font-medium text-ink-2 flex-1 truncate">{j.title}{j.portalId && <span className="ml-2 text-[10.5px] text-[#0E7A66] font-semibold">via portal</span>}</span>
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

/* ---- team control: move a customer along their install journey ---- */
function JourneyControl({ portal }: { portal: Portal }) {
  const act = useActions()
  const j = journeyProgress(portal)
  const [offerOpen, setOfferOpen] = useState(false)
  if (j.steps.length === 0) return null
  return (
    <div className="bg-surface border border-border rounded-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Flow size={15} className="text-accent" /><span className="text-[14px] font-semibold text-ink">Install journey</span>
        <span className="text-[12px] text-muted-2">{j.doneCount}/{j.steps.length} · {j.pct}%</span>
        <div className="ml-auto flex items-center gap-2">
          <Button icon={<Megaphone size={14} />} onClick={() => setOfferOpen(true)}>Push offer</Button>
          {j.current && <Button variant="primary" icon={<Check size={14} />} onClick={() => act.advancePortalJourney(portal, j.current!.key)}>Mark “{j.current.label}” done</Button>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {j.steps.map((m, i) => (
          <span key={m.key} className={classNames('text-[11px] px-2 py-1 rounded-full border', m.done ? 'text-white border-transparent' : i === j.currentIdx ? 'border-[#C79A3A] text-[#8A5A00] bg-[#FBF6EC]' : 'border-border text-muted-2')} style={m.done ? { background: CUSTOMER_ACCENT } : undefined}>
            {m.done ? '✓ ' : i === j.currentIdx ? '● ' : ''}{m.label}
          </span>
        ))}
      </div>
      {j.complete && <div className="text-[12px] text-positive mt-2 flex items-center gap-1.5"><Check size={13} /> Journey complete — system live.</div>}
      <PushOfferModal open={offerOpen} onClose={() => setOfferOpen(false)} portal={portal} />
    </div>
  )
}

function PushOfferModal({ open, onClose, portal }: { open: boolean; onClose: () => void; portal: Portal }) {
  const act = useActions()
  const [kind, setKind] = useState<PortalOffer['kind']>('upgrade')
  const [title, setTitle] = useState('')
  const [blurb, setBlurb] = useState('')
  const [cta, setCta] = useState('I’m interested')
  const [hint, setHint] = useState('')
  const submit = () => {
    if (!title.trim()) return
    act.addPortalOffer({ portalId: portal.id, kind, title: title.trim(), blurb: blurb.trim(), cta: cta.trim() || 'I’m interested', savingHint: hint.trim() || undefined })
    setTitle(''); setBlurb(''); setHint(''); onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={`Push an offer to ${portal.customer.split(' ')[0]}`} subtitle="Appears in their portal Overview — “I’m interested” creates a warm lead for you"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={<Megaphone size={15} />} onClick={submit}>Add to portal</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type"><Select value={kind} onChange={(e) => setKind(e.target.value as PortalOffer['kind'])}>{['battery', 'ev', 'upgrade', 'service', 'general'].map((k) => (<option key={k} value={k}>{k}</option>))}</Select></Field>
        <Field label="Saving hint (optional)"><Input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Save ~£320/yr" /></Field>
      </div>
      <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a second battery for winter" autoFocus /></Field>
      <Field label="Message"><Textarea rows={3} value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="A short, friendly explanation of the offer…" /></Field>
      <Field label="Button label"><Input value={cta} onChange={(e) => setCta(e.target.value)} /></Field>
    </Modal>
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
      <div className="rounded-card p-5 flex items-center gap-4" style={{ background: '#DDF6EF', border: '1px solid #B9E0D4' }}>
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

/* ============================ Glass experience primitives ============================ */
function GlassStat({ icon: Ic, label, value, sub, tone = CUSTOMER_ACCENT }: { icon?: any; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="glass glass-hover rounded-2xl p-4">
      {Ic && <span className="inline-flex w-8 h-8 rounded-xl items-center justify-center mb-2" style={{ background: tone + '26', color: tone }}><Ic size={16} /></span>}
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-[#5b6f68]">{label}</div>
      <div className="text-[22px] font-extrabold leading-tight" style={{ color: '#12271f' }}>{value}</div>
      {sub && <div className="text-[11.5px] text-[#5b6f68] mt-0.5">{sub}</div>}
    </div>
  )
}

// A node chip positioned in the flow diagram's coordinate space (viewBox 340×240).
function FlowNode({ x, y, icon: Ic, label, value, color }: { x: number; y: number; icon: any; label: string; value: string; color: string }) {
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${(x / 340) * 100}%`, top: `${(y / 240) * 100}%` }}>
      <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(4px)' }}>
        <span className="inline-flex w-6 h-6 rounded-lg items-center justify-center shrink-0" style={{ background: color + '2e', color }}><Ic size={13} /></span>
        <div className="leading-none"><div className="text-[8.5px] uppercase tracking-wide text-white/55 font-bold">{label}</div><div className="text-[13px] font-extrabold" style={{ color }}>{value}</div></div>
      </div>
    </div>
  )
}

// Live energy-flow diagram — the signature "experience" element (à la a premium inverter app).
function EnergyFlowHero({ portal }: { portal: Portal }) {
  const e = useMemo(() => portalEnergy(portal), [portal])
  const importing = e.exporting <= 0
  const gridVal = importing ? e.fromGrid : e.exporting
  const gridColor = importing ? '#E0A93B' : SH.mint
  const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const P = ({ d, color, on, slow }: { d: string; color: string; on: boolean; slow?: boolean }) => (
    <g>
      <path d={d} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={3} strokeLinecap="round" />
      {on && <path d={d} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" className={classNames('flow-line', slow && 'flow-slow')} opacity={0.95} />}
    </g>
  )
  return (
    <div className="glass-dark rounded-3xl p-4 sm:p-5 text-white overflow-hidden">
      <div className="flex items-center gap-2 mb-1">
        <Sun size={16} style={{ color: SH.mint }} />
        <span className="text-[13px] font-extrabold tracking-wide">SOLAR STATUS</span>
        <span className="ml-1 inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: SH.mint }}><span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" /> Normal</span>
        <span className="ml-auto text-[12px] text-white/55">Live · {now}</span>
      </div>
      <div className="relative w-full mx-auto" style={{ aspectRatio: '340 / 240', maxWidth: 600 }}>
        <svg viewBox="0 0 340 240" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
          {/* connectors radiating from the house to each source/sink */}
          <P d="M158,108 C120,82 86,58 64,46" color={SH.mint} on={e.solar > 0} />
          <P d="M182,108 C220,82 254,58 276,46" color="#5FC7C0" on={e.home > 0} />
          {portal.hasBattery && <P d="M182,150 C220,176 254,196 276,200" color="#38C7A8" on slow />}
          <P d="M158,150 C120,176 86,196 64,200" color={gridColor} on slow />
        </svg>
        {/* the customer's own home, background removed */}
        <img src="/brand/portal-hero-cutout.webp" alt="Your home" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ width: '58%', maxHeight: '86%', objectFit: 'contain', filter: 'drop-shadow(0 14px 22px rgba(0,0,0,0.45))' }} />
        <FlowNode x={60} y={40} icon={Sun} label="Solar" value={`${e.solar} kW`} color={SH.mint} />
        <FlowNode x={280} y={40} icon={Building} label="Home" value={`${e.home} kW`} color="#5FC7C0" />
        {portal.hasBattery && <FlowNode x={282} y={204} icon={Bolt} label={`Battery ${e.batteryPct}%`} value={e.toBattery > 0 ? `+${e.toBattery.toFixed(1)} kW` : 'idle'} color="#38C7A8" />}
        <FlowNode x={58} y={204} icon={Bolt} label={importing ? 'From grid' : 'Exporting'} value={`${gridVal.toFixed(1)} kW`} color={gridColor} />
      </div>
    </div>
  )
}

function OverviewTab({ portal, onGo }: { portal: Portal; onGo: (t: Tab) => void }) {
  const cfg = useState_().portalTemplate.live
  const { portalOffers } = useState_()
  const payback = portal.annualSavings ? Math.round((portal.systemCost / portal.annualSavings) * 10) / 10 : 0
  const w = warranties(portal)
  const j = useMemo(() => journeyProgress(portal), [portal])
  const offers = useMemo(() => offersFor(portal, portalOffers), [portal, portalOffers])
  const lastDone = [...j.steps].reverse().find((m) => m.done && m.at)
  const updates = [
    ...(lastDone ? [{ icon: Check, title: `${lastDone.label} ✓`, body: lastDone.blurb, tone: '#0E7A66' }] : []),
    { icon: Bolt, title: 'Great generation yesterday', body: `Your system made ${Math.round(portal.systemKwp * 5.1)} kWh — one of your best days this month.`, tone: '#0E7A66' },
    { icon: Sun, title: 'Tip: shift your washing to midday', body: 'You’re generating most between 11am–3pm — run appliances then to use free solar.', tone: '#C79A3A' },
  ]
  const first = portal.customer.split(' ')[0]
  return (
    <div className="flex flex-col gap-4">
      <div className="pt-1">
        <div className="text-[12px] font-extrabold uppercase tracking-wide" style={{ color: CUSTOMER_ACCENT }}>The Solar House</div>
        <h1 className="text-[26px] sm:text-[34px] font-extrabold leading-[1.05] mt-0.5" style={{ color: "#12271f" }}>{cfg.welcomeTitle.replace("{first}", first)} <span className="inline-block">👋</span></h1>
        {cfg.welcomeBody && <p className="text-[14px] text-[#2f423b] mt-1.5 max-w-[640px]">{cfg.welcomeBody}</p>}
        <p className="text-[13.5px] text-[#4a5a54] mt-1">{portal.systemKwp} kWp{portal.hasBattery ? ' + battery' : ''}{portal.hasEv ? ' + EV' : ''} · {portal.address}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr] items-start">
        <EnergyFlowHero portal={portal} />
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <GlassStat icon={Bolt} label="System" value={`${portal.systemKwp} kWp`} sub={portal.hasBattery ? 'with battery' : 'solar'} />
          <GlassStat icon={Dollar} label="Saving / yr" value={money(portal.annualSavings, { compact: true })} sub="projected" tone="#0E9A82" />
          <GlassStat icon={Clock} label="Payback" value={`${payback} yrs`} sub="then free energy" tone="#159C86" />
          <GlassStat icon={Sun} label="Self-powered" value={`${portalSavings(portal).selfSufficiency}%`} sub="your own solar" tone="#1FAE94" />
        </div>
      </div>
      {/* install journey strip */}
      {j.steps.length > 0 && !j.complete && (
        <button onClick={() => onGo('Progress')} className="glass glass-hover text-left rounded-2xl p-4">
          <div className="flex items-center gap-2"><Flow size={15} style={{ color: CUSTOMER_ACCENT }} /><span className="text-[13.5px] font-bold text-[#12271f]">{j.countdownDays !== undefined ? (j.countdownDays === 0 ? 'Installation is today!' : `${j.countdownDays} days to installation`) : (j.current?.label ?? 'Your install is underway')}</span><span className="ml-auto text-[12px] font-bold" style={{ color: CUSTOMER_ACCENT }}>Track it →</span></div>
          <div className="mt-2 h-1.5 rounded-full bg-black/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${j.pct}%`, background: CUSTOMER_ACCENT }} /></div>
          <div className="text-[11.5px] text-[#5b6f68] mt-1.5">{j.doneCount} of {j.steps.length} steps done{j.current ? ` · next: ${j.current.label.toLowerCase()}` : ''}</div>
        </button>
      )}
      {/* what's new + cover */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 items-start">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><Bell size={15} style={{ color: CUSTOMER_ACCENT }} /><span className="text-[14px] font-bold text-[#12271f]">What's new</span></div>
          <div className="flex flex-col gap-3">
            {updates.map((u) => (
              <div key={u.title} className="flex gap-3">
                <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: u.tone + '20', color: u.tone }}><u.icon size={15} /></span>
                <div><div className="text-[13px] font-bold text-[#12271f]">{u.title}</div><div className="text-[12.5px] text-[#4a5a54] leading-snug">{u.body}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><Check size={15} style={{ color: '#0E7A66' }} /><span className="text-[14px] font-bold text-[#12271f]">Your cover</span><button onClick={() => onGo('Documents')} className="ml-auto text-[12px] font-bold" style={{ color: CUSTOMER_ACCENT }}>Warranties →</button></div>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))' }}>
            {w.map((c) => (
              <div key={c.part} className="rounded-xl glass-soft p-3"><div className="text-[11.5px] text-[#5b6f68]">{c.part}</div><div className="text-[16px] font-extrabold text-[#12271f] mt-0.5">{c.years} yrs</div><div className="text-[10.5px] font-semibold" style={{ color: '#0E7A66' }}>to {c.until}</div></div>
            ))}
          </div>
        </div>
      </div>
      {/* offers */}
      {offers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2"><Sparkle size={14} style={{ color: CUSTOMER_ACCENT }} /><span className="text-[14px] font-bold text-[#12271f]">Offers for you</span></div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))' }}>
            {offers.slice(0, 4).map((o) => <OfferCard key={o.id} portal={portal} offer={o} />)}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---- warranty + savings models ---- */
function warranties(p: Portal) {
  const base = p.installDate ? new Date(p.installDate) : new Date()
  const until = (yrs: number) => { const d = new Date(base); d.setFullYear(d.getFullYear() + yrs); return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) }
  return [
    { part: 'Panels', years: 25, until: until(25) },
    { part: 'Inverter', years: 12, until: until(12) },
    ...(p.hasBattery ? [{ part: 'Battery', years: 10, until: until(10) }] : []),
    ...(p.hasEv ? [{ part: 'EV charger', years: 3, until: until(3) }] : []),
  ]
}
function portalSavings(p: Portal) {
  const monthly = p.annualSavings / 12
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const seasonal = MONTHS.map((m, i) => ({ m, v: Math.round(monthly * (0.45 + 1.05 * Math.max(0, Math.cos(((i - 6) / 12) * 2 * Math.PI)))) }))
  const monthsSince = p.installDate ? Math.max(1, Math.round((Date.now() - Date.parse(p.installDate)) / 2.63e9)) : 6
  const genKwh = Math.round(p.systemKwp * 950)
  const co2 = Math.round(genKwh * 0.233)
  return { monthly, seasonal, lifetime: Math.round(monthly * monthsSince), monthsSince, genKwh, co2, trees: Math.round(co2 / 21), miles: Math.round(co2 / 0.17), selfSufficiency: 68 }
}

function SavingsTab({ portal }: { portal: Portal }) {
  const s = useMemo(() => portalSavings(portal), [portal])
  const max = Math.max(1, ...s.seasonal.map((x) => x.v))
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        <Kpi variant="deep" label="Saved so far" value={money(s.lifetime)} delta={`${s.monthsSince} months`} />
        <Kpi variant="blue" label="This year" value={money(portal.annualSavings)} delta="Projected" />
        <Kpi label="Self-sufficiency" value={`${s.selfSufficiency}%`} delta="Powered by your own solar" deltaTone="muted" />
      </div>
      <div className="bg-surface border border-border rounded-card p-5">
        <div className="text-[14px] font-semibold text-ink mb-4">Monthly savings</div>
        <div className="flex items-end gap-2 h-[170px]">
          {s.seasonal.map((x) => (
            <div key={x.m} className="flex-1 flex flex-col items-center gap-1.5 justify-end">
              <div className="text-[10px] font-semibold text-ink-3">{money(x.v, { compact: true })}</div>
              <div className="w-full rounded-t" style={{ height: `${(x.v / max) * 120}px`, background: CUSTOMER_ACCENT }} />
              <div className="text-[10px] text-muted-2">{x.m}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-card p-5 text-white" style={{ background: SH_HERO }}>
        <div className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: '#62E4CC' }}><Sun size={14} /> YOUR IMPACT THIS YEAR</div>
        <div className="grid grid-cols-3 gap-4 mt-3">
          <div><div className="text-[24px] font-bold">{s.co2.toLocaleString()} kg</div><div className="text-[12px]" style={{ color: '#C7EFE4' }}>CO₂ avoided</div></div>
          <div><div className="text-[24px] font-bold">{s.trees}</div><div className="text-[12px]" style={{ color: '#C7EFE4' }}>trees planted (equiv.)</div></div>
          <div><div className="text-[24px] font-bold">{s.miles.toLocaleString()}</div><div className="text-[12px]" style={{ color: '#C7EFE4' }}>car miles offset</div></div>
        </div>
      </div>
      <div className="text-[12px] text-muted-3">Figures are estimates from your system size and typical generation — your monitoring app has the exact numbers.</div>
    </div>
  )
}

function ReferTab({ portal }: { portal: Portal }) {
  const { leads } = useState_()
  const act = useActions()
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [note, setNote] = useState('')
  const mine = leads.filter((l) => l.referredByPortal === portal.id).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  const submit = () => { if (name.trim()) { act.referFriend(portal, name.trim(), company.trim(), note.trim()); setName(''); setCompany(''); setNote('') } }
  return (
    <div className="max-w-[640px] flex flex-col gap-4">
      <div className="rounded-card p-6 text-white" style={{ background: SH_HERO }}>
        <div className="text-[22px] font-bold">Love your solar? Share it.</div>
        <div className="text-[13.5px] mt-1.5" style={{ color: '#C7EFE4' }}>Refer a friend or neighbour — when they go solar with us, <b className="text-white">you both get £{useState_().portalTemplate.live.referralReward}</b>. There's no limit.</div>
      </div>
      <div className="bg-surface border border-border rounded-card p-5 flex flex-col gap-3">
        <div className="text-[14px] font-semibold text-ink">Who should we talk to?</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Their name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Friend's name" /></Field>
          <Field label="Area / town (optional)"><Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Didsbury" /></Field>
        </div>
        <Field label="Anything we should know? (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. They've got a big south-facing roof" /></Field>
        <div className="flex justify-end"><Button variant="primary" icon={<Send size={15} />} onClick={submit}>Send referral</Button></div>
      </div>
      {mine.length > 0 && (
        <div>
          <div className="eyebrow text-muted-3 mb-2">Your referrals · {mine.length}</div>
          <div className="flex flex-col gap-2">
            {mine.map((l) => (
              <div key={l.id} className="bg-surface border border-border rounded-card px-4 py-3 flex items-center gap-3">
                <Avatar name={l.name} size={30} />
                <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold text-ink-2 truncate">{l.name}</div><div className="text-[12px] text-muted-2">{l.company} · {rel(l.createdAt ?? Date.now())}</div></div>
                <Chip tone={l.converted ? 'positive' : 'accent'} dot>{l.converted ? '£150 earned' : 'In progress'}</Chip>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---- install journey model ---- */
function journeyProgress(p: Portal) {
  const steps = p.journey ?? []
  const doneCount = steps.filter((m) => m.done).length
  const currentIdx = steps.findIndex((m) => !m.done)
  const current = currentIdx === -1 ? undefined : steps[currentIdx]
  const complete = steps.length > 0 && currentIdx === -1
  const scheduled = steps.find((m) => m.key === 'scheduled')
  const installed = steps.find((m) => m.key === 'installed')
  const installDateStr = p.installDate || scheduled?.date
  let countdownDays: number | undefined
  if (installDateStr && !installed?.done) {
    const d = Math.ceil((Date.parse(installDateStr) - Date.now()) / 86_400_000)
    if (d >= 0) countdownDays = d
  }
  const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0
  return { steps, doneCount, current, currentIdx, complete, pct, countdownDays, installDateStr }
}
function fmtDate(iso?: string) { return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined }
// A fresh journey for a newly-created portal — accepted done, the rest ahead.
function starterJourney(): PortalMilestone[] {
  return [
    { key: 'accepted', label: 'Proposal accepted', blurb: 'You signed off your system design and pricing.', done: true, at: Date.now() },
    { key: 'survey', label: 'Technical survey', blurb: 'We’ll book a surveyor to check your roof, loft and consumer unit.', done: false },
    { key: 'design', label: 'System design signed off', blurb: 'Final panel layout confirmed after the survey.', done: false },
    { key: 'dno-submitted', label: 'Grid (DNO) application submitted', blurb: 'We apply to your network operator to connect your system.', done: false },
    { key: 'dno-approved', label: 'Grid application approved', blurb: 'Awaiting your network operator — usually 10 working days.', done: false },
    { key: 'scheduled', label: 'Installation booked', blurb: 'We’ll confirm your install date with our crew.', done: false },
    { key: 'installed', label: 'Installation complete', blurb: 'Panels, inverter and battery fitted — usually a single day.', done: false },
    { key: 'commissioned', label: 'System switched on', blurb: 'We commission the system and set up your app.', done: false },
    { key: 'handover', label: 'Handover & warranty pack', blurb: 'MCS certificate, DNO sign-off and all warranties issued.', done: false },
  ]
}

/* ---- offers surfaced to the customer: stored + auto-suggested from missing kit ---- */
function offersFor(portal: Portal, offers: PortalOffer[]): PortalOffer[] {
  const stored = offers.filter((o) => o.status !== 'dismissed' && (o.global || o.portalId === portal.id))
  const has = (k: string) => stored.some((o) => o.kind === k)
  const synth: PortalOffer[] = []
  if (!portal.hasBattery && !has('battery')) synth.push({ id: `syn-batt-${portal.id}`, portalId: portal.id, kind: 'battery', title: 'Add a battery and store your solar', blurb: 'You don’t have a battery yet — right now you export cheap daytime solar and buy it back at night. A battery keeps it for the evening.', cta: 'Get a battery quote', savingHint: 'Save ~£300/yr more', createdAt: Date.now(), status: 'active' })
  if (!portal.hasEv && !has('ev')) synth.push({ id: `syn-ev-${portal.id}`, portalId: portal.id, kind: 'ev', title: 'Charge an EV from your own solar', blurb: 'A smart charger tops your car up from spare solar and cheap overnight rates — free daytime miles.', cta: 'See EV chargers', savingHint: 'Free daytime miles', createdAt: Date.now(), status: 'active' })
  return [...synth, ...stored.filter((o) => o.kind !== 'referral')]
}
const OFFER_META: Record<string, { icon: any; color: string }> = {
  battery: { icon: Bolt, color: '#159C86' }, ev: { icon: Bolt, color: '#13927B' }, upgrade: { icon: Sun, color: '#0E7A66' }, service: { icon: Wrench, color: '#C79A3A' }, referral: { icon: Sparkle, color: '#0E7A66' }, general: { icon: Megaphone, color: '#B01B4F' },
}
function OfferCard({ portal, offer }: { portal: Portal; offer: PortalOffer }) {
  const act = useActions()
  const m = OFFER_META[offer.kind] ?? OFFER_META.general
  const synthetic = offer.id.startsWith('syn-')
  const done = offer.status === 'interested'
  return (
    <div className="bg-surface border border-border rounded-card p-4 flex flex-col gap-2 relative">
      {!synthetic && !done && <button onClick={() => act.dismissPortalOffer(offer.id)} className="absolute top-2.5 right-2.5 w-6 h-6 rounded-lg text-muted-3 hover:text-negative hover:bg-negative-wash text-[15px] leading-none">×</button>}
      <div className="flex items-center gap-2"><span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: m.color + '18', color: m.color }}><m.icon size={15} /></span>{offer.savingHint && <span className="text-[10.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: m.color + '18', color: m.color }}>{offer.savingHint}</span>}</div>
      <div className="text-[13.5px] font-semibold text-ink-2 leading-snug">{offer.title}</div>
      <div className="text-[12.5px] text-muted-2 leading-snug flex-1">{offer.blurb}</div>
      {done ? (
        <div className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: CUSTOMER_ACCENT }}><Check size={13} /> Thanks — we’ll be in touch</div>
      ) : (
        <button onClick={() => act.portalOfferInterest(portal, offer)} className="self-start text-[12.5px] font-semibold inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-white" style={{ background: CUSTOMER_ACCENT }}>{offer.cta} <ArrowUpRight size={13} /></button>
      )}
    </div>
  )
}

/* ---- customer-facing install journey with countdown ---- */
function ProgressTab({ portal }: { portal: Portal }) {
  const j = useMemo(() => journeyProgress(portal), [portal])
  if (j.steps.length === 0) return <div className="text-[13px] text-muted-2 bg-surface border border-border rounded-card p-5 max-w-[640px]">Your install journey will appear here once your proposal is accepted.</div>
  return (
    <div className="max-w-[720px] flex flex-col gap-4">
      {/* hero: countdown / status */}
      <div className="rounded-card p-6 text-white" style={{ background: SH_HERO }}>
        <div className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: '#62E4CC' }}><Flow size={14} /> YOUR INSTALL JOURNEY</div>
        {j.complete ? (
          <><div className="text-[26px] font-bold mt-1.5">Your system is live 🎉</div><div className="text-[13px] mt-1" style={{ color: '#C7EFE4' }}>Every step is done — you’re now generating your own clean energy.</div></>
        ) : j.countdownDays !== undefined ? (
          <><div className="text-[30px] font-bold mt-1.5">{j.countdownDays === 0 ? 'Installation is today!' : `${j.countdownDays} day${j.countdownDays === 1 ? '' : 's'} to installation`}</div><div className="text-[13px] mt-1" style={{ color: '#C7EFE4' }}>{fmtDate(j.installDateStr) ? `Booked for ${fmtDate(j.installDateStr)}. ` : ''}{j.current ? `Right now: ${j.current.label.toLowerCase()}.` : ''}</div></>
        ) : (
          <><div className="text-[24px] font-bold mt-1.5">{j.current?.label ?? 'In progress'}</div><div className="text-[13px] mt-1" style={{ color: '#C7EFE4' }}>{j.current?.blurb ?? 'We’ll keep you posted at every step.'}</div></>
        )}
        <div className="mt-4 h-2 rounded-full bg-white/20 overflow-hidden"><div className="h-full rounded-full bg-white" style={{ width: `${j.pct}%` }} /></div>
        <div className="text-[11.5px] mt-1.5" style={{ color: '#C7EFE4' }}>{j.doneCount} of {j.steps.length} steps complete</div>
      </div>
      {/* timeline */}
      <div className="bg-surface border border-border rounded-card p-5">
        <div className="flex flex-col">
          {j.steps.map((m, i) => {
            const isCurrent = !m.done && i === j.currentIdx
            const isDno = m.key === 'dno-submitted' || m.key === 'dno-approved'
            const last = i === j.steps.length - 1
            return (
              <div key={m.key} className="flex gap-3.5">
                <div className="flex flex-col items-center">
                  <span className={classNames('w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white', isCurrent && 'animate-pulse')} style={{ background: m.done ? CUSTOMER_ACCENT : isCurrent ? '#C79A3A' : '#D6DEE3' }}>
                    {m.done ? <Check size={14} /> : isCurrent ? <Clock size={13} /> : <span className="text-[11px] font-bold text-muted-2">{i + 1}</span>}
                  </span>
                  {!last && <span className="w-0.5 flex-1 my-1" style={{ background: m.done ? CUSTOMER_ACCENT : '#E3E9ED', minHeight: 22 }} />}
                </div>
                <div className={classNames('pb-4 min-w-0', last && 'pb-0')}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={classNames('text-[13.5px] font-semibold', m.done ? 'text-ink-2' : isCurrent ? 'text-ink' : 'text-muted-2')}>{m.label}</span>
                    {isCurrent && <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded text-white" style={{ background: '#C79A3A' }}>Happening now</span>}
                    {isDno && !m.done && <span className="text-[10px] font-semibold text-muted-3">grid connection</span>}
                    {(m.at || m.date) && <span className="ml-auto text-[11px] text-muted-3 shrink-0">{m.done ? (m.at ? rel(m.at) : '') : m.date ? fmtDate(m.date) : ''}</span>}
                  </div>
                  <div className="text-[12px] text-muted-2 leading-snug mt-0.5">{m.blurb}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="text-[12px] text-muted-3">We’ll email you and update this page every time something moves. Questions about a step? Ask Ovi on the right.</div>
    </div>
  )
}

/* ---- community, reviews & product updates ---- */
function CommunityTab({ portal }: { portal: Portal }) {
  const { portalOffers } = useState_()
  const act = useActions()
  const globalOffers = portalOffers.filter((o) => o.global && o.status !== 'dismissed')
  const reviews = [
    { name: 'Trustpilot', url: 'https://www.trustpilot.com', blurb: 'Rate your experience' },
    { name: 'Google', url: 'https://www.google.com', blurb: 'Leave a Google review' },
  ]
  const updates = [
    { icon: Sun, title: 'New: winter battery scheduling', body: 'A free firmware update helps your system pre-charge on cheap overnight rates. Roll-out this month.', tone: '#0E7A66' },
    { icon: Megaphone, title: 'Solar House hits 500 homes', body: 'You’re part of a growing community generating clean power across the North West.', tone: '#B01B4F' },
    { icon: Bolt, title: 'Tariff tip: Octopus Flux', body: 'Battery owners are saving more by switching to an export-friendly tariff. Ask Ovi if it suits you.', tone: '#13927B' },
  ]
  return (
    <div className="max-w-[760px] flex flex-col gap-5">
      {/* reviews */}
      <div className="rounded-card p-5" style={{ background: '#DDF6EF', border: '1px solid #B9E0D4' }}>
        <div className="flex items-center gap-2 mb-1"><Star size={16} style={{ color: '#C79A3A' }} /><span className="text-[15px] font-bold text-ink">Enjoying your solar?</span></div>
        <div className="text-[13px] text-muted-b mb-3">A quick review genuinely helps other homeowners take the leap — and helps us keep prices down.</div>
        <div className="flex gap-2.5 flex-wrap">
          {reviews.map((r) => (
            <button key={r.name} onClick={() => { act.logPortalEvent(portal.id, 'Community', `Review CTA — ${r.name}`, 'click'); window.open(r.url, '_blank', 'noopener') }} className="bg-white border border-border rounded-control px-4 py-2.5 flex items-center gap-2 hover:border-[#8FD3C2] transition-colors">
              <Star size={15} style={{ color: '#C79A3A' }} /><span className="text-[13px] font-semibold text-ink-2">{r.blurb}</span><ArrowUpRight size={14} className="text-muted-3" />
            </button>
          ))}
        </div>
      </div>
      {/* community updates */}
      <div>
        <div className="eyebrow text-muted-3 mb-2">From the Solar House community</div>
        <div className="flex flex-col gap-2.5">
          {updates.map((u) => (
            <div key={u.title} className="bg-surface border border-border rounded-card p-4 flex gap-3">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: u.tone + '18', color: u.tone }}><u.icon size={16} /></span>
              <div><div className="text-[13.5px] font-semibold text-ink-2">{u.title}</div><div className="text-[12.5px] text-muted-2 leading-snug">{u.body}</div></div>
            </div>
          ))}
        </div>
      </div>
      {/* offers/promotions pushed to everyone */}
      {globalOffers.length > 0 && (
        <div>
          <div className="eyebrow text-muted-3 mb-2">Member offers</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))' }}>
            {globalOffers.map((o) => <OfferCard key={o.id} portal={portal} offer={o} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function EnergyTab({ portal }: { portal: Portal }) {
  const e = useMemo(() => portalEnergy(portal), [portal])
  const maxH = Math.max(1, ...e.hours.map((h) => Math.max(h.gen, h.use)))
  const act = useActions()
  const openMonitoring = () => { act.logPortalEvent(portal.id, 'Energy', `Opened ${portal.monitoringPlatform ?? 'monitoring'}`, 'click'); if (portal.monitoringUrl) window.open(portal.monitoringUrl, '_blank', 'noopener') }
  return (
    <div className="flex flex-col gap-4">
      <EnergyFlowHero portal={portal} />
      {portal.monitoringPlatform && (
        <button onClick={openMonitoring} disabled={!portal.monitoringUrl} className="glass glass-hover self-start inline-flex items-center gap-2 text-[13px] font-bold rounded-full px-4 py-2.5 text-[#0a5a4a] disabled:opacity-60">
          <Link size={14} /> Open my {portal.monitoringPlatform} app <ArrowUpRight size={14} />
        </button>
      )}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <GlassStat icon={Sun} label="Generated today" value={`${e.todayGen} kWh`} sub="from solar" />
        <GlassStat icon={Building} label="Used today" value={`${e.todayUse} kWh`} sub="your home" tone="#5FC7C0" />
        <GlassStat icon={Dollar} label="Saved today" value={money(e.todaySaving)} sub="vs. all-grid" tone="#0E9A82" />
      </div>
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4"><Bolt size={15} style={{ color: CUSTOMER_ACCENT }} /><span className="text-[14px] font-bold text-[#12271f]">Today — generation vs. use</span></div>
        <div className="flex items-end gap-[3px] h-[160px]">
          {e.hours.map((h) => (
            <div key={h.h} className="flex-1 flex flex-col justify-end gap-0.5 relative">
              <div className="w-full rounded-t" style={{ height: `${(h.gen / maxH) * 130}px`, background: 'linear-gradient(180deg,#1FAE94,#0E7A66)' }} />
              <div className="w-full rounded-b" style={{ height: `${(h.use / maxH) * 130}px`, background: '#BFE9DF' }} />
              {h.h % 6 === 0 && <div className="text-[9px] text-[#5b6f68] text-center absolute -bottom-4 left-0 right-0">{h.h}:00</div>}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-6 text-[11.5px] text-[#4a5a54]"><span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#0E7A66' }} />Solar generated</span><span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#BFE9DF' }} />Home used</span></div>
      </div>
      <div className="text-[11.5px] text-[#5b6f68]">These live figures are an estimate from your system. Your {portal.monitoringPlatform ?? 'monitoring'} app has the exact, meter-accurate numbers.</div>
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
  video: { icon: Play, label: 'Video', color: '#B01B4F' }, manual: { icon: FileIcon, label: 'Manual', color: '#13927B' }, 'case-study': { icon: Sparkle, label: 'Case study', color: '#0E7A66' }, guide: { icon: FileIcon, label: 'Guide', color: '#159C86' },
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
        <Kpi label="Sections viewed" value={String(bySection.length)} delta="Distinct areas" deltaTone="muted" />
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
  const tone: Record<string, string> = { view: '#13927B', click: '#159C86', download: '#0E7A66', chat: '#B01B4F', video: '#C2410C', login: '#5B6577' }
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
function PortalChat({ portal, onClose }: { portal: Portal; onClose: () => void }) {
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
    <div className="fixed inset-0 z-[85] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-[#0a1f19]/40 backdrop-blur-[2px]" />
      <aside onClick={(e) => e.stopPropagation()} className="relative w-full sm:w-[380px] sm:m-3 sm:rounded-3xl glass flex flex-col overflow-hidden rise" style={{ fontFamily: SH_FONT, maxHeight: '100%' }}>
      <div className="h-14 shrink-0 flex items-center gap-2.5 px-4 border-b border-white/40" style={{ background: 'rgba(221,246,239,0.7)' }}>
        <span className="w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0" style={{ background: CUSTOMER_ACCENT }}><Robot size={16} /></span>
        <div className="min-w-0 flex-1"><div className="text-[13.5px] font-bold text-ink">Ask Ovi</div><div className="text-[11px] text-muted-2">The Solar House assistant · only sees your system</div></div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg text-muted-2 hover:bg-black/5 text-[18px] leading-none flex items-center justify-center">×</button>
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
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') ask(draft) }} placeholder="Ask about your system…" className="flex-1 h-9 px-3 rounded-full border border-input-border bg-white text-[13px] outline-none focus:border-[#0E7A66]" />
        <button onClick={() => ask(draft)} className="w-9 h-9 rounded-full text-white flex items-center justify-center shrink-0" style={{ background: CUSTOMER_ACCENT }}><Send size={15} /></button>
      </div>
      </aside>
    </div>
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
