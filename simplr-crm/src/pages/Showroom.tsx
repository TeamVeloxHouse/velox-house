import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Kpi, Chip, Avatar } from '../components/ui'
import { Modal, Field, Input, Select } from '../components/overlays'
import { Plus, Sun, Bolt, Check, ChevronRight, Star, Wrench, Building, Sparkle, Robot, Play, MapPin } from '../components/icons'
import { useState_, useActions } from '../store/store'
import type { ShowroomSession } from '../store/types'
import { showroomModel, panelsFor, starterDesign, kwhFromSpend } from '../lib/showroom'
import { money, classNames } from '../lib/format'

const ACCENT = '#0E7A66'
const MINT = '#62E4CC'
const SCRIM = '#15223B'
const FONT = "'Outfit', ui-sans-serif, system-ui, -apple-system, sans-serif"

/* ============================ Home — sessions list ============================ */
export function ShowroomHome() {
  const nav = useNavigate()
  const { showroom } = useState_()
  const [open, setOpen] = useState(false)
  const won = showroom.filter((s) => s.status === 'won').length
  const conv = showroom.length ? Math.round((won / showroom.length) * 100) : 0
  const statusTone: Record<string, 'positive' | 'accent' | 'warning' | 'neutral'> = { won: 'positive', presented: 'accent', draft: 'warning', lost: 'neutral' }
  return (
    <>
      <TopBar title="Showroom" crumbs={['Customers']} actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setOpen(true)}>New session</Button>} />
      <PageBody>
        <div className="grid grid-cols-4 gap-4">
          <Kpi variant="deep" label="Sessions" value={String(showroom.length)} delta="All time" />
          <Kpi label="Won in room" value={String(won)} delta="Closed on the spot" deltaTone={won ? 'positive' : 'muted'} />
          <Kpi variant="blue" label="Conversion" value={`${conv}%`} delta="Sessions → sale" />
          <Kpi label="Drafts" value={String(showroom.filter((s) => s.status === 'draft').length)} delta="In progress" deltaTone="muted" />
        </div>
        <div className="bg-surface border border-border rounded-card p-5">
          <div className="flex items-center gap-2 mb-1"><Play size={16} className="text-accent" /><span className="text-[15px] font-semibold text-ink">The Showroom Experience</span></div>
          <div className="text-[13px] text-muted-b mb-4">A guided, in-person presentation that designs a customer's system with them, shows their new bill live, and closes the sale — provisioning their portal the moment they say yes.</div>
          {showroom.length === 0 ? (
            <div className="text-[13px] text-muted-2">No sessions yet — start one when a customer walks in.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {showroom.map((s) => {
                const m = showroomModel(s)
                return (
                  <button key={s.id} onClick={() => nav(`/showroom/${s.id}`)} className="bg-canvas border border-border rounded-card px-4 py-3 flex items-center gap-3 text-left hover:border-[#8FD3C2] transition-colors">
                    <Avatar name={s.name} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold text-ink-2 truncate">{s.name}</div>
                      <div className="text-[12px] text-muted-2 truncate">{s.address}</div>
                    </div>
                    <div className="hidden sm:block text-right"><div className="text-[13px] font-semibold text-ink-2">{s.design.systemKwp} kWp{s.design.hasBattery ? ' + battery' : ''}</div><div className="text-[11.5px] text-muted-2">{money(m.price, { compact: true })} · save {money(m.annualSaving, { compact: true })}/yr</div></div>
                    <Chip tone={statusTone[s.status]} dot>{s.status === 'won' ? 'Won 🎉' : s.status}</Chip>
                    <span className="text-accent font-semibold text-[13px]">Present →</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </PageBody>
      <NewSessionModal open={open} onClose={() => setOpen(false)} onCreated={(id) => { setOpen(false); nav(`/showroom/${id}`) }} />
    </>
  )
}

function NewSessionModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const act = useActions()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [postcode, setPostcode] = useState('')
  const [spend, setSpend] = useState('160')
  const [kwh, setKwh] = useState('')
  const [tariff, setTariff] = useState('28')
  const [occ, setOcc] = useState<ShowroomSession['occupancy']>('in_half_day')
  const create = () => {
    if (!name.trim() || !address.trim()) return
    const t = Number(tariff) || 28
    const annualKwh = Number(kwh) || kwhFromSpend(Number(spend) || 0, t)
    const s = act.createShowroom({
      name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, address: address.trim(), postcode: postcode.trim() || undefined,
      monthlySpend: Number(spend) || 0, annualKwh, tariffPence: t, occupancy: occ, design: starterDesign(annualKwh), presenter: 'Jordan Miles',
    })
    onCreated(s.id)
  }
  return (
    <Modal open={open} onClose={onClose} title="New showroom session" subtitle="Take their details and current energy picture — we'll design the rest together"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={<Play size={15} />} onClick={create}>Start the experience</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Customer name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus /></Field>
        <Field label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Address"><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House & street, town" /></Field>
        <Field label="Postcode"><Input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="GL52 3AB" /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Bill (£/month)"><Input type="number" value={spend} onChange={(e) => setSpend(e.target.value)} /></Field>
        <Field label="Annual kWh (opt.)"><Input type="number" value={kwh} onChange={(e) => setKwh(e.target.value)} placeholder="auto" /></Field>
        <Field label="Unit rate (p)"><Input type="number" value={tariff} onChange={(e) => setTariff(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone (opt.)"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="At home during the day?"><Select value={occ} onChange={(e) => setOcc(e.target.value as ShowroomSession['occupancy'])}><option value="home_all_day">Home most of the day</option><option value="in_half_day">In part of the day</option><option value="out_all_day">Out all day</option></Select></Field>
      </div>
    </Modal>
  )
}

/* ============================ The presentation ============================ */
type SectionMode = 'slide' | 'scroll'

export function ShowroomExperience() {
  const { id } = useParams()
  const nav = useNavigate()
  const { showroom } = useState_()
  const session = showroom.find((s) => s.id === id)
  const [idx, setIdx] = useState(0)
  const [won, setWon] = useState<{ portalId: string } | null>(null)

  const sections = useMemo(() => ([
    { key: 'welcome', label: 'Welcome', mode: 'slide' as SectionMode },
    { key: 'home', label: 'Your home', mode: 'slide' as SectionMode },
    { key: 'today', label: 'Energy today', mode: 'slide' as SectionMode },
    { key: 'design', label: 'Design your system', mode: 'scroll' as SectionMode },
    { key: 'bill', label: 'Your new bill', mode: 'slide' as SectionMode },
    { key: 'why', label: 'Why Solar House', mode: 'scroll' as SectionMode },
    { key: 'process', label: 'How it works', mode: 'scroll' as SectionMode },
    { key: 'portal', label: 'Your portal', mode: 'slide' as SectionMode },
    { key: 'close', label: 'Let’s do it', mode: 'slide' as SectionMode },
  ]), [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') setIdx((i) => Math.min(sections.length - 1, i + 1)); if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1)) }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [sections.length])

  if (!session) return <div className="p-8 text-muted-b">Session not found. <button onClick={() => nav('/showroom')} className="text-accent font-semibold">Back to showroom</button>.</div>
  const sec = sections[idx]
  const atEnd = idx === sections.length - 1

  return (
    <div className="sh-portal fixed inset-0 z-[70] h-[100dvh] flex flex-col" style={{ fontFamily: FONT }}>
      {/* top bar with progress */}
      <header className="shrink-0 glass-soft border-b border-white/40 px-4 sm:px-6 h-[58px] flex items-center gap-3">
        <button onClick={() => nav('/showroom')} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#3D4757] hover:text-ink shrink-0"><ChevronRight size={14} className="rotate-180" /> Exit</button>
        <div className="hidden md:flex items-center gap-1 overflow-x-auto no-sb flex-1">
          {sections.map((s, i) => (
            <button key={s.key} onClick={() => setIdx(i)} className={classNames('shrink-0 px-2.5 h-8 rounded-full text-[12px] font-semibold transition-colors', i === idx ? 'text-white' : i < idx ? 'text-[#0a5a4a]' : 'text-[#5b6f68] hover:bg-white/50')} style={i === idx ? { background: ACCENT } : undefined}>{i + 1}. {s.label}</button>
          ))}
        </div>
        <div className="md:hidden flex-1 text-[13px] font-bold text-[#12271f] text-center truncate">{idx + 1}. {sec.label}</div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="w-8 h-8 rounded-full glass grid place-items-center disabled:opacity-40"><ChevronRight size={15} className="rotate-180" /></button>
          <button onClick={() => setIdx((i) => Math.min(sections.length - 1, i + 1))} disabled={atEnd} className="w-8 h-8 rounded-full text-white grid place-items-center disabled:opacity-40" style={{ background: ACCENT }}><ChevronRight size={15} /></button>
        </div>
      </header>
      {/* progress line */}
      <div className="h-1 bg-black/5 shrink-0"><div className="h-full transition-all" style={{ width: `${((idx + 1) / sections.length) * 100}%`, background: `linear-gradient(90deg, ${MINT}, ${ACCENT})` }} /></div>

      {/* section body */}
      <div className={classNames('flex-1 min-h-0', sec.mode === 'slide' ? 'grid place-items-center overflow-hidden p-4 sm:p-8' : 'overflow-y-auto')}>
        <div key={sec.key} className={classNames('rise w-full', sec.mode === 'slide' ? 'max-w-[1000px]' : 'max-w-[1000px] mx-auto px-4 sm:px-6 py-6')}>
          {sec.key === 'welcome' && <SlideWelcome session={session} />}
          {sec.key === 'home' && <SlideHome session={session} />}
          {sec.key === 'today' && <SlideToday session={session} />}
          {sec.key === 'design' && <SectionDesign session={session} />}
          {sec.key === 'bill' && <SlideBill session={session} />}
          {sec.key === 'why' && <SectionWhy />}
          {sec.key === 'process' && <SectionProcess />}
          {sec.key === 'portal' && <SlidePortal session={session} />}
          {sec.key === 'close' && <SlideClose session={session} won={won} onWin={(p) => setWon(p)} />}
        </div>
      </div>
    </div>
  )
}

/* ---- shared bits ---- */
function Eyebrow({ children }: { children: any }) { return <div className="text-[12px] font-extrabold uppercase tracking-wide" style={{ color: ACCENT }}>{children}</div> }
function StatGlass({ label, value, sub, tone = ACCENT }: { label: string; value: string; sub?: string; tone?: string }) {
  return <div className="glass rounded-2xl p-4"><div className="text-[10.5px] font-bold uppercase tracking-wide text-[#5b6f68]">{label}</div><div className="text-[24px] font-extrabold leading-tight" style={{ color: tone }}>{value}</div>{sub && <div className="text-[11.5px] text-[#5b6f68] mt-0.5">{sub}</div>}</div>
}

function SlideWelcome({ session }: { session: ShowroomSession }) {
  return (
    <div className="text-center flex flex-col items-center gap-4">
      <span className="inline-flex items-center gap-2 glass rounded-full px-3 py-1.5"><img src="/brand/solar-house-logo.png" width={26} height={26} /><span className="font-extrabold lowercase text-[15px]" style={{ color: SCRIM }}>the solar house</span></span>
      <h1 className="text-[34px] sm:text-[52px] font-extrabold leading-[1.03]" style={{ color: '#12271f' }}>Welcome, {session.name.split(' ')[0]}.</h1>
      <p className="text-[15px] sm:text-[18px] text-[#3f5049] max-w-[640px]">Let’s design the right solar &amp; battery system for <b>{session.address}</b> — and show you exactly what it does to your bills. No pressure, just the numbers.</p>
      <div className="flex flex-wrap gap-2.5 justify-center mt-2 text-[12.5px] font-semibold text-[#0a5a4a]">
        {['MCS certified', 'NICEIC approved', 'RECC member', '4.8★ from 43 reviews'].map((t) => <span key={t} className="glass rounded-full px-3 py-1.5">{t}</span>)}
      </div>
    </div>
  )
}

function SlideHome({ session }: { session: ShowroomSession }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 items-center">
      <div className="glass-dark rounded-3xl p-6 grid place-items-center" style={{ minHeight: 260 }}>
        <img src="/brand/portal-hero-cutout.webp" alt="Your home" className="w-[86%] max-h-[300px] object-contain" style={{ filter: 'drop-shadow(0 16px 26px rgba(0,0,0,0.5))' }} />
      </div>
      <div className="flex flex-col gap-3">
        <Eyebrow>Your home</Eyebrow>
        <h2 className="text-[28px] sm:text-[36px] font-extrabold leading-tight" style={{ color: '#12271f' }}>{session.address}</h2>
        <p className="text-[14px] text-[#3f5049]">This is an <b>example design</b> based on your roof and postcode. On your south-facing roof there’s room for around <b>{panelsFor(session.design.systemKwp)} panels</b> — a <b>{session.design.systemKwp} kWp</b> system. We’ll confirm the exact layout at survey.</p>
        <div className="grid grid-cols-3 gap-3 mt-1">
          <StatGlass label="Panels" value={`${session.design.panels}`} sub="fit the roof" />
          <StatGlass label="System" value={`${session.design.systemKwp} kWp`} sub="example" tone="#0E9A82" />
          <StatGlass label="Generates" value={`${Math.round(session.design.systemKwp * 950).toLocaleString()}`} sub="kWh / yr" tone="#159C86" />
        </div>
      </div>
    </div>
  )
}

function SlideToday({ session }: { session: ShowroomSession }) {
  const m = useMemo(() => showroomModel(session), [session])
  return (
    <div className="text-center flex flex-col items-center gap-4">
      <Eyebrow>Your energy today</Eyebrow>
      <h2 className="text-[26px] sm:text-[34px] font-extrabold leading-tight max-w-[720px]" style={{ color: '#12271f' }}>Right now you’re spending about <span style={{ color: '#C2410C' }}>{money(m.currentBill)}</span> a year on electricity.</h2>
      <p className="text-[14px] text-[#3f5049] max-w-[600px]">Based on your bill — {session.annualKwh.toLocaleString()} kWh a year at {session.tariffPence}p a unit — and energy prices only tend to go one way.</p>
      <div className="grid grid-cols-3 gap-3 w-full max-w-[600px] mt-2">
        <StatGlass label="Per year" value={money(m.currentBill)} sub="electricity" tone="#C2410C" />
        <StatGlass label="Per month" value={money(session.monthlySpend)} sub="today" />
        <StatGlass label="Usage" value={`${(session.annualKwh / 1000).toFixed(1)}k`} sub="kWh / yr" tone="#159C86" />
      </div>
    </div>
  )
}

/* ---- the interactive proposal builder (the core) ---- */
function SectionDesign({ session }: { session: ShowroomSession }) {
  const act = useActions()
  const m = useMemo(() => showroomModel(session), [session])
  const d = session.design
  const setKwp = (kwp: number) => act.updateShowroomDesign(session.id, { systemKwp: Math.round(kwp * 10) / 10, panels: panelsFor(kwp) })
  const KWPS = [3.2, 4.0, 4.8, 5.6, 6.4]
  const BATTS = [5, 10, 15]
  return (
    <div className="flex flex-col gap-4">
      <div className="text-center"><Eyebrow>Design your system</Eyebrow><h2 className="text-[24px] sm:text-[32px] font-extrabold" style={{ color: '#12271f' }}>Build it together — everything updates live</h2></div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr] items-start">
        {/* controls */}
        <div className="glass rounded-3xl p-5 flex flex-col gap-5">
          <div>
            <div className="flex items-center justify-between mb-2"><span className="text-[13px] font-bold text-[#12271f]">System size</span><span className="text-[13px] font-extrabold" style={{ color: ACCENT }}>{d.systemKwp} kWp · {d.panels} panels</span></div>
            <div className="flex gap-2 flex-wrap">
              {KWPS.map((k) => <button key={k} onClick={() => setKwp(k)} className={classNames('px-3 py-2 rounded-xl text-[13px] font-bold transition-colors', Math.abs(d.systemKwp - k) < 0.05 ? 'text-white' : 'glass-soft text-[#2b5045]')} style={Math.abs(d.systemKwp - k) < 0.05 ? { background: ACCENT } : undefined}>{k} kWp</button>)}
            </div>
          </div>
          <div className="border-t border-white/40 pt-4">
            <button onClick={() => act.updateShowroomDesign(session.id, { hasBattery: !d.hasBattery })} className="w-full flex items-center gap-3 text-left">
              <span className={classNames('w-11 h-7 rounded-full relative transition-colors shrink-0')} style={{ background: d.hasBattery ? ACCENT : '#cdd8d3' }}><span className="absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all" style={{ left: d.hasBattery ? 18 : 2 }} /></span>
              <span className="flex-1"><span className="text-[14px] font-bold text-[#12271f]">Add a battery</span><span className="block text-[12px] text-[#5b6f68]">Store daytime solar for the evening — big jump in savings</span></span>
              <Bolt size={18} style={{ color: d.hasBattery ? ACCENT : '#9fb0a9' }} />
            </button>
            {d.hasBattery && <div className="flex gap-2 mt-3 pl-14">{BATTS.map((b) => <button key={b} onClick={() => act.updateShowroomDesign(session.id, { batteryKwh: b })} className={classNames('px-3 py-1.5 rounded-lg text-[12.5px] font-bold', d.batteryKwh === b ? 'text-white' : 'glass-soft text-[#2b5045]')} style={d.batteryKwh === b ? { background: '#159C86' } : undefined}>{b} kWh</button>)}</div>}
          </div>
          <div className="border-t border-white/40 pt-4">
            <button onClick={() => act.updateShowroomDesign(session.id, { hasEv: !d.hasEv, addEvCharger: !d.hasEv })} className="w-full flex items-center gap-3 text-left">
              <span className="w-11 h-7 rounded-full relative transition-colors shrink-0" style={{ background: d.hasEv ? ACCENT : '#cdd8d3' }}><span className="absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all" style={{ left: d.hasEv ? 18 : 2 }} /></span>
              <span className="flex-1"><span className="text-[14px] font-bold text-[#12271f]">Drive an EV (or planning to)</span><span className="block text-[12px] text-[#5b6f68]">Add a smart charger and run the car on sunshine</span></span>
              <Sun size={18} style={{ color: d.hasEv ? ACCENT : '#9fb0a9' }} />
            </button>
          </div>
        </div>
        {/* live readout */}
        <div className="glass-dark rounded-3xl p-5 text-white flex flex-col gap-4">
          <div className="flex items-center gap-2"><Sparkle size={15} style={{ color: MINT }} /><span className="text-[13px] font-bold tracking-wide">LIVE RESULT</span></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.06)' }}><div className="text-[10.5px] uppercase tracking-wide text-white/55 font-bold">Bill now</div><div className="text-[22px] font-extrabold" style={{ color: '#E0A93B' }}>{money(m.currentBill)}</div></div>
            <div className="rounded-2xl p-3" style={{ background: 'rgba(98,228,204,0.14)' }}><div className="text-[10.5px] uppercase tracking-wide text-white/55 font-bold">Bill after</div><div className="text-[22px] font-extrabold" style={{ color: MINT }}>{money(m.newBill)}</div></div>
          </div>
          <div className="rounded-2xl p-4 text-center" style={{ background: 'linear-gradient(150deg,#0E7A66,#0a5a4a)' }}>
            <div className="text-[11px] uppercase tracking-wide font-bold" style={{ color: MINT }}>You save</div>
            <div className="text-[34px] font-extrabold leading-tight">{money(m.annualSaving + m.evSaving)}<span className="text-[16px] font-bold">/yr</span></div>
            {m.evSaving > 0 && <div className="text-[11.5px] text-white/70">incl. ~{money(m.evSaving)} EV fuel</div>}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><div className="text-[17px] font-extrabold">{m.selfSufficiency}%</div><div className="text-[10.5px] text-white/55">self-powered</div></div>
            <div><div className="text-[17px] font-extrabold">{m.paybackYears}<span className="text-[11px]">yrs</span></div><div className="text-[10.5px] text-white/55">payback</div></div>
            <div><div className="text-[17px] font-extrabold">{money(m.price, { compact: true })}</div><div className="text-[10.5px] text-white/55">system price</div></div>
          </div>
        </div>
      </div>
      <div className="text-center text-[12px] text-[#5b6f68]">Prices are a guide and confirmed at survey. Savings modelled from your usage at {session.tariffPence}p/unit.</div>
    </div>
  )
}

function SlideBill({ session }: { session: ShowroomSession }) {
  const m = useMemo(() => showroomModel(session), [session])
  const cut = Math.round((1 - m.newBill / Math.max(1, m.currentBill)) * 100)
  return (
    <div className="text-center flex flex-col items-center gap-4">
      <Eyebrow>Your new bill</Eyebrow>
      <h2 className="text-[26px] sm:text-[36px] font-extrabold leading-tight max-w-[760px]" style={{ color: '#12271f' }}>From {money(m.currentBill)} down to <span style={{ color: ACCENT }}>{money(m.newBill)}</span> a year.</h2>
      <div className="flex items-center gap-3 justify-center flex-wrap">
        <div className="glass rounded-2xl px-5 py-3"><div className="text-[11px] font-bold uppercase text-[#5b6f68]">Cut your bill by</div><div className="text-[30px] font-extrabold" style={{ color: ACCENT }}>{cut}%</div></div>
        <div className="text-[40px]" style={{ color: MINT }}>→</div>
        <div className="glass rounded-2xl px-5 py-3"><div className="text-[11px] font-bold uppercase text-[#5b6f68]">Over 25 years</div><div className="text-[30px] font-extrabold" style={{ color: '#0E9A82' }}>{money(m.lifetimeSaving, { compact: true })}</div></div>
      </div>
      <div className="grid grid-cols-3 gap-3 w-full max-w-[640px] mt-2">
        <StatGlass label="Self-powered" value={`${m.selfSufficiency}%`} sub="your own solar" />
        <StatGlass label="Payback" value={`${m.paybackYears} yrs`} sub="then free energy" tone="#159C86" />
        <StatGlass label="CO₂ saved" value={`${(m.co2Saved / 1000).toFixed(1)}t`} sub="per year" tone="#0E9A82" />
      </div>
    </div>
  )
}

function SectionWhy() {
  const reviews = [
    { name: 'Sarah W.', text: 'Faultless from quote to switch-on. The team explained everything and the app is brilliant.', town: 'Cheltenham' },
    { name: 'David & Ann', text: 'Our bills have dropped massively. Wish we’d done it years ago.', town: 'Melksham' },
    { name: 'Tom R.', text: 'Proper professionals — tidy, on time, and the battery pays for itself in the evenings.', town: 'Cardiff' },
  ]
  return (
    <div className="flex flex-col gap-5">
      <div className="text-center"><Eyebrow>Why Solar House</Eyebrow><h2 className="text-[26px] sm:text-[34px] font-extrabold" style={{ color: '#12271f' }}>Rated 4.8★ by 43 homeowners</h2></div>
      <div className="grid gap-3 sm:grid-cols-3">
        {reviews.map((r) => (
          <div key={r.name} className="glass rounded-2xl p-4">
            <div className="flex gap-0.5 mb-2">{[0, 1, 2, 3, 4].map((i) => <Star key={i} size={14} style={{ color: '#C79A3A' }} />)}</div>
            <p className="text-[13px] text-[#2b3b35] leading-snug">“{r.text}”</p>
            <div className="text-[12px] text-[#5b6f68] mt-2 font-semibold">{r.name} · {r.town}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[{ i: Check, t: 'MCS certified', s: 'Every install' }, { i: Check, t: 'NICEIC approved', s: 'Electrical safety' }, { i: Check, t: 'RECC member', s: 'Consumer code' }, { i: Building, t: '3 showrooms', s: 'Cardiff · Cheltenham · Melksham' }].map((a) => (
          <div key={a.t} className="glass-soft rounded-2xl p-4 flex items-center gap-2.5"><span className="w-8 h-8 rounded-lg grid place-items-center text-white shrink-0" style={{ background: ACCENT }}><a.i size={15} /></span><div><div className="text-[13px] font-bold text-[#12271f]">{a.t}</div><div className="text-[11px] text-[#5b6f68]">{a.s}</div></div></div>
        ))}
      </div>
    </div>
  )
}

function SectionProcess() {
  const steps = [
    { i: MapPin, t: 'Free technical survey', s: 'We visit, check the roof, loft and consumer unit, and finalise the design.' },
    { i: Sun, t: 'Design signed off', s: 'You approve the exact layout, panels and battery.' },
    { i: Bolt, t: 'We handle the grid (DNO)', s: 'We apply to your network operator — you don’t lift a finger.' },
    { i: Wrench, t: 'Installation in a day', s: 'Our own MCS crew fit and commission the system, usually in one day.' },
    { i: Robot, t: 'Your portal + aftercare', s: 'You get your live portal, monitoring, warranties and priority support.' },
  ]
  return (
    <div className="flex flex-col gap-5">
      <div className="text-center"><Eyebrow>How it works</Eyebrow><h2 className="text-[26px] sm:text-[34px] font-extrabold" style={{ color: '#12271f' }}>From yes to switched-on</h2></div>
      <div className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <div key={s.t} className="glass rounded-2xl p-4 flex items-center gap-4">
            <span className="w-10 h-10 rounded-xl grid place-items-center text-white shrink-0 font-extrabold" style={{ background: i === 0 ? ACCENT : SCRIM }}>{i + 1}</span>
            <span className="w-9 h-9 rounded-lg grid place-items-center shrink-0" style={{ background: MINT + '33', color: ACCENT }}><s.i size={17} /></span>
            <div><div className="text-[14px] font-bold text-[#12271f]">{s.t}</div><div className="text-[12.5px] text-[#4a5a54]">{s.s}</div></div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SlidePortal({ session }: { session: ShowroomSession }) {
  const m = useMemo(() => showroomModel(session), [session])
  return (
    <div className="grid gap-6 md:grid-cols-2 items-center">
      <div className="flex flex-col gap-3">
        <Eyebrow>Your portal</Eyebrow>
        <h2 className="text-[28px] sm:text-[36px] font-extrabold leading-tight" style={{ color: '#12271f' }}>And it doesn’t stop at install.</h2>
        <p className="text-[14px] text-[#3f5049]">Every Solar House customer gets their own portal — live generation and savings, all your documents, a countdown to install day, and help whenever you need it. Here’s yours, ready to go the moment you say yes.</p>
        <div className="flex flex-wrap gap-2 text-[12px] font-semibold text-[#0a5a4a]">{['Live monitoring', 'Your documents', 'Install countdown', 'Ask Ovi help'].map((t) => <span key={t} className="glass rounded-full px-3 py-1.5">{t}</span>)}</div>
      </div>
      {/* device mock of the portal overview */}
      <div className="glass-dark rounded-3xl p-4 text-white">
        <div className="flex items-center gap-2 mb-3"><img src="/brand/solar-house-logo.png" width={22} height={22} /><span className="text-[12px] font-extrabold lowercase">the solar house</span><span className="ml-auto text-[10.5px] px-2 py-0.5 rounded-full" style={{ background: MINT + '22', color: MINT }}>Live</span></div>
        <div className="text-[12px]" style={{ color: MINT }}>Welcome, {session.name.split(' ')[0]} 👋</div>
        <div className="text-[20px] font-extrabold">{session.design.systemKwp} kWp{session.design.hasBattery ? ' + battery' : ''}</div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase text-white/50 font-bold">Saving/yr</div><div className="text-[15px] font-extrabold" style={{ color: MINT }}>{money(m.annualSaving, { compact: true })}</div></div>
          <div className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase text-white/50 font-bold">Self-power</div><div className="text-[15px] font-extrabold">{m.selfSufficiency}%</div></div>
          <div className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase text-white/50 font-bold">Payback</div><div className="text-[15px] font-extrabold">{m.paybackYears}y</div></div>
        </div>
        <img src="/brand/portal-hero-cutout.webp" className="w-[70%] mx-auto mt-2 object-contain" style={{ maxHeight: 130, filter: 'drop-shadow(0 10px 16px rgba(0,0,0,0.5))' }} />
      </div>
    </div>
  )
}

function SlideClose({ session, won, onWin }: { session: ShowroomSession; won: { portalId: string } | null; onWin: (p: { portalId: string }) => void }) {
  const act = useActions()
  const nav = useNavigate()
  const m = useMemo(() => showroomModel(session), [session])
  const monthly = Math.round(m.price / 120) // ~10yr 0% finance guide
  const win = () => { const r = act.winShowroom(session, m.price, m.annualSaving); onWin({ portalId: r.portalId }) }
  if (won || session.status === 'won') {
    const pid = won?.portalId ?? session.portalId!
    return (
      <div className="text-center flex flex-col items-center gap-4">
        <span className="w-16 h-16 rounded-full grid place-items-center text-white" style={{ background: ACCENT }}><Check size={30} /></span>
        <h2 className="text-[30px] sm:text-[40px] font-extrabold" style={{ color: '#12271f' }}>Welcome to Solar House! 🎉</h2>
        <p className="text-[14px] text-[#3f5049] max-w-[560px]">{session.name.split(' ')[0]}’s draft proposal is confirmed, the deal is logged, and their portal is live. We’ll be in touch to book the survey.</p>
        <div className="flex gap-2.5 flex-wrap justify-center">
          <button onClick={() => nav(`/customers/${pid}`)} className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-white font-bold text-[13.5px]" style={{ background: ACCENT }}><Robot size={15} /> Open their portal</button>
          <button onClick={() => nav('/showroom')} className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 glass font-bold text-[13.5px] text-[#0a5a4a]">Back to showroom</button>
        </div>
      </div>
    )
  }
  return (
    <div className="text-center flex flex-col items-center gap-4">
      <Eyebrow>Let’s do it</Eyebrow>
      <h2 className="text-[28px] sm:text-[38px] font-extrabold leading-tight max-w-[720px]" style={{ color: '#12271f' }}>Your {session.design.systemKwp} kWp{session.design.hasBattery ? ' + battery' : ''} system</h2>
      <div className="glass rounded-3xl p-6 w-full max-w-[520px]">
        <div className="flex items-end justify-center gap-2"><span className="text-[44px] font-extrabold" style={{ color: '#12271f' }}>{money(m.price)}</span></div>
        <div className="text-[13px] text-[#5b6f68]">or about <b style={{ color: ACCENT }}>{money(monthly)}/month</b> on 0% finance</div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <StatGlass label="You save" value={`${money(m.annualSaving + m.evSaving, { compact: true })}/yr`} />
          <StatGlass label="New bill" value={money(m.newBill)} tone="#0E9A82" />
          <StatGlass label="Payback" value={`${m.paybackYears}y`} tone="#159C86" />
        </div>
        <button onClick={win} className="mt-5 w-full h-12 rounded-2xl text-white font-extrabold text-[15px] inline-flex items-center justify-center gap-2" style={{ background: ACCENT }}><Check size={18} /> Confirm &amp; set up my portal</button>
        <div className="text-[11.5px] text-[#5b6f68] mt-2">A draft proposal — nothing’s locked until survey. No deposit taken here.</div>
      </div>
    </div>
  )
}
