import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Kpi, Chip, Avatar, Segmented } from '../components/ui'
import { MonthGrid, type GridEvent } from '../components/MonthGrid'
import { Modal, Field, Input, Select } from '../components/overlays'
import { Plus, Sun, Bolt, Check, ChevronRight, Star, Wrench, Building, Sparkle, Robot, Play, MapPin, Camera, Upload, Lock, Dollar, Calendar } from '../components/icons'
import { useState_, useActions } from '../store/store'
import type { ShowroomSession } from '../store/types'
import { showroomModel, panelsFor, starterDesign, kwhFromSpend, monthlyGeneration, dailyGenerationCurve, cashFlowSeries, priceBreakdown } from '../lib/showroom'
import { generateMockupForAddress } from '../lib/mockup'
import { BookSlotModal } from './ShowroomCalendar'
import { money, classNames } from '../lib/format'

const ACCENT = '#0E7A66'
const NAVY = '#15223B'

/* ============================ Home — sessions list ============================ */
const SHOWROOM_TABS = ['Cardiff', 'Cheltenham', 'Melksham'] as const
const SLOTS = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30']
const isoD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const mondayOf = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
const SESSION_TONE: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Booked', color: '#0A64AD', bg: '#E7F0FA' }, 'no-show': { label: 'No-show', color: '#B45309', bg: '#FDF3E3' }, cancelled: { label: 'Cancelled', color: '#7A8494', bg: '#F1F3F7' },
  won: { label: 'Won', color: '#0E7C66', bg: '#E9F5F1' }, presented: { label: 'Presented', color: '#4F46E5', bg: '#EEF0FD' }, lost: { label: 'Lost', color: '#B01B4F', bg: '#FDECEF' }, draft: { label: 'Held', color: '#3D4757', bg: '#F1F3F7' },
}
const toneOf = (s: ShowroomSession) => SESSION_TONE[s.bookingStatus === 'completed' || !s.bookingStatus ? s.status : s.bookingStatus]

/* ============================ Home — per-showroom diary + presentations ============================ */
export function ShowroomHome() {
  const nav = useNavigate()
  const { showroom } = useState_()
  const [open, setOpen] = useState(false)
  const [loc, setLoc] = useState<(typeof SHOWROOM_TABS)[number]>(() => { try { return (localStorage.getItem('shc.showroom.tab') as never) || 'Cardiff' } catch { return 'Cardiff' } })
  useEffect(() => { try { localStorage.setItem('shc.showroom.tab', loc) } catch { /* ignore */ } }, [loc])
  const [week, setWeek] = useState(() => mondayOf(new Date()))
  const [view, setView] = useState<'Week' | 'Day' | 'Month' | 'List'>(() => { try { const v = localStorage.getItem('shc.showroom.view'); return (v === 'Bookings' ? 'List' : v as never) || 'Week' } catch { return 'Week' } })
  useEffect(() => { try { localStorage.setItem('shc.showroom.view', view) } catch { /* ignore */ } }, [view])
  const [day, setDay] = useState(() => new Date())
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [book, setBook] = useState<{ date: string; time: string } | null>(null)
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'won' | 'presented' | 'lost' | 'no-show'>('all')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(25)

  const here = showroom.filter((s) => s.location === loc)
  const days = Array.from({ length: 6 }, (_, i) => { const d = new Date(week); d.setDate(d.getDate() + i); return d })
  const todayIso = isoD(new Date())
  const slot = (date: string, time: string) => here.find((s) => s.scheduledDate === date && s.scheduledTime === time && s.bookingStatus !== 'cancelled')
  const stepCal = (dir: -1 | 1) => {
    if (view === 'Week') setWeek((w) => { const d = new Date(w); d.setDate(d.getDate() + dir * 7); return d })
    else if (view === 'Day') setDay((w) => { const d = new Date(w); d.setDate(d.getDate() + dir); return d })
    else setMonth((m) => new Date(m.getFullYear(), m.getMonth() + dir, 1))
  }
  const monthEvents = useMemo(() => {
    const m: Record<string, GridEvent[]> = {}
    here.filter((s) => s.scheduledDate && s.bookingStatus !== 'cancelled').sort((a, b) => (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? '')).forEach((s) => {
      const t = toneOf(s)
      ;(m[s.scheduledDate!] ??= []).push({ id: s.id, label: `${s.scheduledTime ?? ''} ${s.name}`, title: `${s.name} · ${t.label}`, color: t.color, wash: t.bg, onClick: () => nav(`/showroom/${s.id}`) })
    })
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showroom, loc])
  const weekBookings = here.filter((s) => s.scheduledDate && s.scheduledDate >= isoD(days[0]) && s.scheduledDate <= isoD(days[5]) && s.bookingStatus !== 'cancelled').length

  const list = here
    .filter((s) => filter === 'all' ? true : filter === 'upcoming' ? s.bookingStatus === 'scheduled' : filter === 'no-show' ? s.bookingStatus === 'no-show' : s.bookingStatus !== 'no-show' && s.bookingStatus !== 'scheduled' && s.status === filter)
    .filter((s) => !q || `${s.name} ${s.address} ${s.postcode}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => `${b.scheduledDate}${b.scheduledTime}`.localeCompare(`${a.scheduledDate}${a.scheduledTime}`))
  const count = (f: typeof filter) => here.filter((s) => f === 'all' ? true : f === 'upcoming' ? s.bookingStatus === 'scheduled' : f === 'no-show' ? s.bookingStatus === 'no-show' : s.bookingStatus !== 'no-show' && s.bookingStatus !== 'scheduled' && s.status === f).length

  return (
    <>
      <TopBar
        title="Showroom"
        crumbs={['Customers']}
        tabs={{ items: SHOWROOM_TABS.map((l) => ({ id: l, label: l, count: showroom.filter((s) => s.location === l && s.bookingStatus === 'scheduled').length })), value: loc, onChange: (v) => setLoc(v as never) }}
        actions={
          <>
            <Button icon={<Calendar size={16} />} onClick={() => nav('/showroom/analytics')}>Analytics</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setOpen(true)}>Walk-in session</Button>
          </>
        }
      />
      {/* Views: the diary gets the whole screen (Week / Day / Month), and the bookings list is its own view */}
      <div className="sh-toolbar shrink-0 px-7 pb-3 flex items-center gap-3 flex-wrap">
        <Segmented options={['List', 'Week', 'Day', 'Month']} value={view} onChange={(v) => setView(v as typeof view)} />
        {view !== 'List' && (
          <>
            <div className="flex items-center gap-1">
              <button onClick={() => stepCal(-1)} className="w-9 h-9 rounded-[10px] border border-[#E1E6EC] bg-white grid place-items-center hover:bg-control"><ChevronRight size={14} className="rotate-180" /></button>
              <button onClick={() => { setWeek(mondayOf(new Date())); setDay(new Date()); setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) }} className="h-9 px-3.5 rounded-[10px] border border-[#E1E6EC] bg-white text-[13px] font-semibold text-ink-3 hover:bg-control">Today</button>
              <button onClick={() => stepCal(1)} className="w-9 h-9 rounded-[10px] border border-[#E1E6EC] bg-white grid place-items-center hover:bg-control"><ChevronRight size={14} /></button>
            </div>
            <div className="text-[17px] font-bold text-ink tracking-[-0.01em]">
              {view === 'Week' ? `${days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${days[5].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : view === 'Day' ? day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
                : month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </div>
          </>
        )}
        <div className="ml-auto flex items-center gap-2 text-[12.5px]">
          <span className="h-8 px-3 rounded-full bg-[#15223B] text-white font-semibold flex items-center gap-1.5"><MapPin size={12} className="text-[#62E4CC]" />{loc}</span>
          {view === 'Week' && <span className="text-muted-b font-semibold">{weekBookings} of {days.length * SLOTS.length} slots booked</span>}
        </div>
      </div>

      {view === 'Week' && (
        <main className="flex-1 min-h-0 px-7 pb-5 flex flex-col">
          <div className="flex-1 min-h-0 grid rounded-card bg-white border border-[#E1E6EC] shadow-card overflow-hidden" style={{ gridTemplateColumns: '64px repeat(6, minmax(0,1fr))', gridTemplateRows: `auto repeat(${SLOTS.length}, minmax(0,1fr))` }}>
            <div className="border-b border-r border-divider bg-[#FAFBFC]" />
            {days.map((d) => { const iso = isoD(d); return (
              <button key={iso} onClick={() => { setDay(d); setView('Day') }} className={classNames('border-b border-r border-divider last:border-r-0 px-2.5 py-2 text-left', iso === todayIso ? 'bg-[#15223B]' : 'bg-[#FAFBFC] hover:bg-control')}>
                <div className={classNames('text-[12.5px] font-bold', iso === todayIso ? 'text-white' : 'text-ink-2')}>{d.toLocaleDateString('en-GB', { weekday: 'short' })} {d.getDate()}</div>
                <div className={classNames('text-[10.5px] font-semibold', iso === todayIso ? 'text-[#62E4CC]' : 'text-muted-2')}>{here.filter((s) => s.scheduledDate === iso && s.bookingStatus !== 'cancelled').length} booked</div>
              </button>
            ) })}
            {SLOTS.map((t) => (
              <Fragment key={t}>
                <div className="border-b border-r border-divider px-2 py-2 text-[11px] font-semibold text-muted-2">{t}</div>
                {days.map((d) => {
                  const iso = isoD(d), s = slot(iso, t), past = `${iso}T${t}` < new Date().toISOString().slice(0, 16)
                  const tone = s ? toneOf(s) : null
                  return (
                    <div key={iso + t} className="min-h-0 border-b border-r border-divider last:border-r-0 p-1">
                      {s ? (
                        <button onClick={() => nav(`/showroom/${s.id}`)} className="w-full h-full rounded-md px-2 py-1.5 text-left hover:brightness-95 border-l-[3px] overflow-hidden" style={{ background: tone!.bg, borderLeftColor: tone!.color }}>
                          <div className="text-[12.5px] font-semibold text-ink-2 truncate">{s.name}</div>
                          <div className="text-[10.5px] font-semibold truncate" style={{ color: tone!.color }}>{tone!.label} · {s.presenter?.split(' ')[0]}</div>
                          <div className="text-[10.5px] text-muted-2 truncate">{s.postcode ?? s.address}</div>
                        </button>
                      ) : !past ? (
                        <button onClick={() => setBook({ date: iso, time: t })} className="w-full h-full rounded-md border border-dashed border-transparent hover:border-accent-400 hover:bg-accent-wash-4 text-transparent hover:text-ink-3 text-[11px] font-semibold flex items-center justify-center gap-1"><Plus size={12} />Book</button>
                      ) : null}
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>
        </main>
      )}

      {view === 'Day' && (
        <main className="flex-1 min-h-0 px-7 pb-5 flex flex-col">
          <div className="flex-1 min-h-0 grid gap-2" style={{ gridTemplateRows: `repeat(${SLOTS.length}, minmax(0,1fr))` }}>
            {SLOTS.map((t) => {
              const iso = isoD(day), s = slot(iso, t), past = `${iso}T${t}` < new Date().toISOString().slice(0, 16)
              const tone = s ? toneOf(s) : null
              const m = s ? showroomModel(s) : null
              return (
                <div key={t} className="min-h-0 flex items-stretch gap-3">
                  <div className="w-[64px] shrink-0 pt-2 text-[13px] font-bold text-ink-3">{t}</div>
                  {s ? (
                    <button onClick={() => nav(`/showroom/${s.id}`)} className="flex-1 min-w-0 rounded-card bg-white border border-[#E1E6EC] border-l-[4px] shadow-card px-4 flex items-center gap-4 text-left hover:shadow-md transition-shadow" style={{ borderLeftColor: tone!.color }}>
                      <Avatar name={s.name} size={36} />
                      <div className="min-w-0 flex-1"><div className="text-[14px] font-bold text-ink truncate">{s.name}</div><div className="text-[12px] text-muted-2 truncate">{s.address}{s.phone ? ` · ${s.phone}` : ''}</div></div>
                      <div className="hidden lg:block text-right"><div className="text-[12.5px] font-semibold text-ink-2">{s.design.systemKwp} kWp{s.design.hasBattery ? ` + ${s.design.batteryKwh} kWh` : ''}</div><div className="text-[11px] text-muted-2">{money(m!.price, { compact: true })} · £{s.monthlySpend}/mo bill</div></div>
                      <div className="text-[12px] text-muted-b w-[110px] truncate">{s.presenter}</div>
                      <span className="text-[11px] font-semibold rounded-full px-2.5 py-1" style={{ color: tone!.color, background: tone!.bg }}>{tone!.label}</span>
                    </button>
                  ) : past ? (
                    <div className="flex-1 rounded-card border border-dashed border-[#E1E6EC] flex items-center px-4 text-[12px] text-muted-3">No visit</div>
                  ) : (
                    <button onClick={() => setBook({ date: iso, time: t })} className="flex-1 rounded-card border border-dashed border-[#CFD7E1] bg-white/50 hover:bg-white hover:border-accent-400 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-muted-b hover:text-ink"><Plus size={14} />Book this slot</button>
                  )}
                </div>
              )
            })}
          </div>
        </main>
      )}

      {view === 'Month' && (
        <main className="flex-1 min-h-0 px-7 pb-5 flex flex-col">
          <MonthGrid
            year={month.getFullYear()} month0={month.getMonth()}
            events={monthEvents}
            onDay={(d) => { setDay(new Date(`${d}T12:00`)); setView('Day') }}
            onMore={(d) => { setDay(new Date(`${d}T12:00`)); setView('Day') }}
            dayBadge={(d) => { const n = here.filter((s) => s.scheduledDate === d && s.bookingStatus !== 'cancelled').length; return n ? <span className="text-[10px] font-bold text-muted-b">{n}/{SLOTS.length}</span> : null }}
          />
        </main>
      )}

      {view === 'List' && <PageBody>
        {/* presentations */}
        <section className="rounded-card bg-surface border border-border shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-divider flex items-center gap-2 flex-wrap">
            <Play size={15} className="text-accent" /><span className="text-[14px] font-bold text-ink">{loc} — every booking &amp; proposal</span><span className="text-[12px] text-muted-2 ml-1">{here.length} in total</span>
            <div className="flex items-center gap-1 ml-3 bg-[#E9EDF2] border border-[#DDE3EA] rounded-control p-[3px]">
              {(['all', 'upcoming', 'won', 'presented', 'lost', 'no-show'] as const).map((f) => <button key={f} onClick={() => { setFilter(f); setLimit(25) }} className={classNames('h-7 px-2.5 rounded-[6px] text-[12px] font-semibold capitalize flex items-center gap-1', filter === f ? 'bg-white text-ink font-bold shadow-[0_1px_3px_rgba(11,18,32,0.14)]' : 'text-ink-3')}>{f === 'all' ? 'All' : f}<span className="text-[10.5px] text-muted-3">{count(f)}</span></button>)}
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or postcode…" className="ml-auto h-8 w-[220px] px-3 rounded-control border border-border text-[12.5px] outline-none focus:border-accent" />
          </div>
          {list.slice(0, limit).map((s) => {
            const m = showroomModel(s), tone = toneOf(s)
            return (
              <button key={s.id} onClick={() => nav(`/showroom/${s.id}`)} className="w-full px-4 py-2.5 border-b border-divider-row flex items-center gap-3 text-left hover:bg-[#FAFCFB]">
                <div className="w-[88px] shrink-0"><div className="text-[12.5px] font-semibold text-ink-2">{s.scheduledDate ? new Date(`${s.scheduledDate}T12:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</div><div className="text-[11px] text-muted-2">{s.scheduledTime ?? ''}</div></div>
                <Avatar name={s.name} size={30} />
                <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate">{s.name}</div><div className="text-[11.5px] text-muted-2 truncate">{s.address}</div></div>
                <div className="hidden md:block text-right w-[170px]"><div className="text-[12.5px] font-semibold text-ink-2">{s.design.systemKwp} kWp{s.design.hasBattery ? ` + ${s.design.batteryKwh} kWh` : ''}</div><div className="text-[11px] text-muted-2">{money(m.price, { compact: true })} · save {money(m.annualSaving, { compact: true })}/yr</div></div>
                <span className="w-[110px] text-[12px] text-muted-b truncate">{s.presenter}</span>
                <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 w-[82px] text-center" style={{ color: tone.color, background: tone.bg }}>{tone.label}</span>
              </button>
            )
          })}
          {!list.length && <div className="p-8 text-center text-[13px] text-muted-2">No presentations match.</div>}
          {list.length > limit && <button onClick={() => setLimit((l) => l + 50)} className="w-full py-2.5 text-[12.5px] font-semibold text-accent hover:bg-accent-wash">Show more ({list.length - limit} remaining)</button>}
        </section>
      </PageBody>}
      <NewSessionModal open={open} onClose={() => setOpen(false)} onCreated={(id) => { setOpen(false); nav(`/showroom/${id}`) }} />
      {book && <BookSlotModal date={book.date} time={book.time} location={loc} onClose={() => setBook(null)} onBooked={() => setBook(null)} />}
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
  const [billFileName, setBillFileName] = useState<string | undefined>(undefined)
  const create = () => {
    if (!name.trim() || !address.trim()) return
    const t = Number(tariff) || 28
    const annualKwh = Number(kwh) || kwhFromSpend(Number(spend) || 0, t)
    const s = act.createShowroom({
      name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, address: address.trim(), postcode: postcode.trim() || undefined,
      monthlySpend: Number(spend) || 0, annualKwh, tariffPence: t, occupancy: occ, design: starterDesign(annualKwh), presenter: 'Jordan Miles',
      billFileName,
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
      <Field label="Photo of their bill (optional)">
        <label className="h-9 px-3 rounded-lg border border-input-border text-[13px] text-muted-b flex items-center gap-2 cursor-pointer hover:bg-control w-fit">
          <Upload size={14} /> {billFileName || 'Attach a photo'}
          <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setBillFileName(e.target.files?.[0]?.name)} />
        </label>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone (opt.)"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="At home during the day?"><Select value={occ} onChange={(e) => setOcc(e.target.value as ShowroomSession['occupancy'])}><option value="home_all_day">Home most of the day</option><option value="in_half_day">In part of the day</option><option value="out_all_day">Out all day</option></Select></Field>
      </div>
    </Modal>
  )
}

/* ============================ The presentation ============================ */
const sections = [
  { key: 'welcome', label: 'Welcome' },
  { key: 'home', label: 'Your home' },
  { key: 'today', label: 'Energy today' },
  { key: 'motivations', label: 'Why go solar' },
  { key: 'design', label: 'Design your system' },
  { key: 'bill', label: 'Your new bill' },
  { key: 'why', label: 'Why Solar House' },
  { key: 'process', label: 'How it works' },
  { key: 'portal', label: 'Your portal' },
  { key: 'quote', label: 'Your quote' },
  { key: 'close', label: 'Accept & sign' },
]

export function ShowroomExperience() {
  const { id } = useParams()
  const nav = useNavigate()
  const { showroom } = useState_()
  const session = showroom.find((s) => s.id === id)
  const [activeKey, setActiveKey] = useState('welcome')
  const [won, setWon] = useState<{ portalId: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) setActiveKey(visible[0].target.id)
    }, { root, rootMargin: '-15% 0px -70% 0px', threshold: 0 })
    sections.forEach((s) => { const el = sectionRefs.current[s.key]; if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, [session?.id])

  if (!session) return <div className="p-8 text-muted-b">Session not found. <button onClick={() => nav('/showroom')} className="text-accent font-semibold">Back to showroom</button>.</div>

  function goTo(key: string) {
    const el = sectionRefs.current[key]
    if (el && scrollRef.current) scrollRef.current.scrollTo({ top: el.offsetTop - 20, behavior: 'smooth' })
  }

  return (
    <div className="flex-1 flex min-h-0">
      {/* presenter sidebar — table of contents, not shown on any customer-facing screen elsewhere */}
      <aside className="w-[240px] shrink-0 flex flex-col overflow-y-auto" style={{ background: NAVY }}>
        <div className="p-4 border-b border-white/10">
          <button onClick={() => nav('/showroom')} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/70 hover:text-white"><ChevronRight size={13} className="rotate-180" /> Exit</button>
          <div className="flex items-center gap-2 mt-3"><Avatar name={session.name} size={30} /><div className="min-w-0"><div className="text-[13px] font-bold text-white truncate">{session.name}</div><div className="text-[11.5px] text-white/55 truncate">{session.address}</div></div></div>
        </div>
        <nav className="p-2.5 flex flex-col gap-0.5">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => goTo(s.key)}
              className={classNames('text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-colors', activeKey === s.key ? 'text-white font-semibold' : 'text-white/60 hover:bg-white/8 hover:text-white/90')}
              style={activeKey === s.key ? { background: 'rgba(255,255,255,0.12)' } : undefined}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* scrollable presentation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-canvas">
        <div className="max-w-[900px] mx-auto px-5 sm:px-8 py-10 flex flex-col gap-16">
          <section id="welcome" ref={(el) => { sectionRefs.current.welcome = el }} className="scroll-mt-6"><SlideWelcome session={session} /></section>
          <section id="home" ref={(el) => { sectionRefs.current.home = el }} className="scroll-mt-6"><SlideHome session={session} /></section>
          <section id="today" ref={(el) => { sectionRefs.current.today = el }} className="scroll-mt-6"><SlideToday session={session} /></section>
          <section id="motivations" ref={(el) => { sectionRefs.current.motivations = el }} className="scroll-mt-6"><SectionMotivations /></section>
          <section id="design" ref={(el) => { sectionRefs.current.design = el }} className="scroll-mt-6"><SectionDesign session={session} /></section>
          <section id="bill" ref={(el) => { sectionRefs.current.bill = el }} className="scroll-mt-6"><SlideBill session={session} /></section>
          <section id="why" ref={(el) => { sectionRefs.current.why = el }} className="scroll-mt-6"><SectionWhy /></section>
          <section id="process" ref={(el) => { sectionRefs.current.process = el }} className="scroll-mt-6"><SectionProcess /></section>
          <section id="portal" ref={(el) => { sectionRefs.current.portal = el }} className="scroll-mt-6"><SlidePortal session={session} /></section>
          <section id="quote" ref={(el) => { sectionRefs.current.quote = el }} className="scroll-mt-6"><SlideQuote session={session} /></section>
          <section id="close" ref={(el) => { sectionRefs.current.close = el }} className="scroll-mt-6"><SlideClose session={session} won={won} onWin={(p) => setWon(p)} /></section>
        </div>
      </div>
    </div>
  )
}

/* ---- shared bits ---- */
function Eyebrow({ children }: { children: any }) { return <div className="text-[12px] font-semibold uppercase tracking-wide text-accent">{children}</div> }
function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return <div className="bg-surface border border-border rounded-card p-4"><div className="text-[11px] font-semibold uppercase tracking-wide text-muted-3">{label}</div><div className="text-[22px] font-bold leading-tight text-ink" style={tone ? { color: tone } : undefined}>{value}</div>{sub && <div className="text-[11.5px] text-muted-2 mt-0.5">{sub}</div>}</div>
}

/* ---- charts ---- */
function MonthlyGenerationChart({ data }: { data: { month: string; kwh: number }[] }) {
  const max = Math.max(...data.map((d) => d.kwh), 1)
  return (
    <div className="flex items-end gap-1.5 h-[120px]">
      {data.map((d) => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
          <div className="text-[10px] text-muted-3 font-medium">{d.kwh}</div>
          <div className="w-full rounded-t-[3px]" style={{ height: `${Math.max(3, (d.kwh / max) * 84)}px`, background: ACCENT }} />
          <div className="text-[10px] text-muted-3">{d.month}</div>
        </div>
      ))}
    </div>
  )
}

function DailyGenerationChart({ points }: { points: { hour: number; kw: number }[] }) {
  const W = 460, H = 150, pad = 4, bottom = H - 26
  const maxKw = Math.max(...points.map((p) => p.kw), 0.1)
  const xFor = (h: number) => pad + ((h - 5) / 16) * (W - pad * 2)
  const yFor = (kw: number) => bottom - (kw / maxKw) * (bottom - pad)
  const line = 'M ' + points.map((p) => `${xFor(p.hour)} ${yFor(p.kw)}`).join(' L ')
  const area = `M ${xFor(points[0].hour)} ${bottom} ` + points.map((p) => `L ${xFor(p.hour)} ${yFor(p.kw)}`).join(' ') + ` L ${xFor(points[points.length - 1].hour)} ${bottom} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs><linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={ACCENT} stopOpacity="0.25" /><stop offset="1" stopColor={ACCENT} stopOpacity="0.02" /></linearGradient></defs>
      <path d={area} fill="url(#dg)" />
      <path d={line} fill="none" stroke={ACCENT} strokeWidth="2" />
      {[6, 9, 12, 15, 18, 21].map((h) => <text key={h} x={xFor(h)} y={H - 8} fontSize="9.5" fill="#98A1B0" textAnchor="middle">{h}:00</text>)}
    </svg>
  )
}

function CashFlowChart({ series }: { series: number[] }) {
  const years = series.length - 1
  const W = 620, H = 200, pad = 4, bottom = H - 22
  const min = Math.min(...series), max = Math.max(...series)
  const range = max - min || 1
  const xFor = (y: number) => pad + (y / years) * (W - pad * 2)
  const yFor = (v: number) => bottom - ((v - min) / range) * (bottom - pad)
  const zeroY = yFor(0)
  const line = 'M ' + series.map((v, y) => `${xFor(y)} ${yFor(v)}`).join(' L ')
  const area = `M ${xFor(0)} ${zeroY} ` + series.map((v, y) => `L ${xFor(y)} ${yFor(v)}`).join(' ') + ` L ${xFor(years)} ${zeroY} Z`
  const breakEvenYear = series.findIndex((v) => v >= 0)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs><linearGradient id="cf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={ACCENT} stopOpacity="0.28" /><stop offset="1" stopColor={ACCENT} stopOpacity="0.02" /></linearGradient></defs>
      <path d={area} fill="url(#cf)" />
      <line x1={pad} y1={zeroY} x2={W - pad} y2={zeroY} stroke="#C7CDD8" strokeWidth="1" />
      <path d={line} fill="none" stroke={ACCENT} strokeWidth="2" />
      {breakEvenYear > 0 && (
        <>
          <line x1={xFor(breakEvenYear)} y1={pad} x2={xFor(breakEvenYear)} y2={bottom} stroke={ACCENT} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
          <circle cx={xFor(breakEvenYear)} cy={zeroY} r="3.5" fill={ACCENT} />
          <text x={xFor(breakEvenYear) + 6} y={pad + 11} fontSize="10.5" fill={ACCENT} fontWeight="600">Break-even ≈ yr {breakEvenYear}</text>
        </>
      )}
      <text x={pad} y={H - 6} fontSize="9.5" fill="#98A1B0">Year 0</text>
      <text x={W - pad} y={H - 6} fontSize="9.5" fill="#98A1B0" textAnchor="end">Year {years}</text>
    </svg>
  )
}

function SlideWelcome({ session }: { session: ShowroomSession }) {
  const m = useMemo(() => showroomModel(session), [session])
  return (
    <div className="rounded-card p-7 text-white relative overflow-hidden" style={{ background: `linear-gradient(150deg,${NAVY},#0A3B33)` }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 100% at 90% -10%, rgba(245,166,35,0.18), transparent 55%)' }} />
      <div className="relative flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: '#F5B85C' }}><Sun size={14} /> SOLAR PROPOSAL · PREPARED IN PERSON</div>
        <h1 className="text-[30px] sm:text-[38px] font-bold leading-tight">Welcome, {session.name.split(' ')[0]}.</h1>
        <p className="text-[14px] max-w-[600px]" style={{ color: '#c3ccdb' }}>Let’s design the right solar &amp; battery system for <b className="text-white">{session.address}</b> and show you exactly what it does to your bills.</p>
        <div className="flex flex-wrap gap-2">
          {['MCS certified', 'NICEIC approved', 'RECC member', '4.8★ from 43 reviews'].map((t) => <Chip key={t} tone="positive">{t}</Chip>)}
        </div>
        <div className="flex flex-wrap gap-5 mt-3 pt-4 border-t border-white/12">
          <div><div className="text-[11px]" style={{ color: '#93A0B4' }}>You'll save</div><div className="text-[26px] font-bold" style={{ color: '#8FE0C6' }}>{money(m.annualSaving + m.evSaving)}<span className="text-[13px] font-medium">/yr</span></div></div>
          <div><div className="text-[11px]" style={{ color: '#93A0B4' }}>Over 25 years</div><div className="text-[26px] font-bold" style={{ color: '#8FE0C6' }}>{money(m.lifetimeSaving, { compact: true })}</div></div>
          <div><div className="text-[11px]" style={{ color: '#93A0B4' }}>System size</div><div className="text-[26px] font-bold text-white">{session.design.systemKwp} kWp</div></div>
          <div><div className="text-[11px]" style={{ color: '#93A0B4' }}>Bill cut by</div><div className="text-[26px] font-bold" style={{ color: '#8FE0C6' }}>{Math.round((1 - m.newBill / Math.max(1, m.currentBill)) * 100)}%</div></div>
        </div>
      </div>
    </div>
  )
}

function SlideHome({ session }: { session: ShowroomSession }) {
  const act = useActions()
  const [stage, setStage] = useState<'idle' | 'pin' | 'photo' | 'render' | 'done'>('idle')
  const headingRef = useRef(0)
  const busy = stage !== 'idle' && stage !== 'done'

  async function runMockup(force?: boolean) {
    setStage('pin'); await new Promise((r) => setTimeout(r, 500))
    setStage('photo'); await new Promise((r) => setTimeout(r, 400))
    const { dataUrl, source } = await generateMockupForAddress(session.address, session.design.panels, force ? headingRef.current : undefined)
    headingRef.current = (headingRef.current + 90) % 360
    setStage('render'); await new Promise((r) => setTimeout(r, 300))
    act.updateShowroom(session.id, { mockupImage: dataUrl, mockupSource: source })
    setStage('done')
  }

  useEffect(() => {
    if (!session.mockupImage && stage === 'idle') void runMockup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id])

  const stageLabel = { pin: 'Dropping a pin on their address…', photo: 'Capturing the front of the home…', render: 'Placing panels on the roof…' }[stage as 'pin' | 'photo' | 'render']

  return (
    <div className="grid gap-6 md:grid-cols-2 items-center">
      <div className="rounded-card overflow-hidden relative grid place-items-center" style={{ minHeight: 260, background: NAVY }}>
        {session.mockupImage ? (
          <img src={session.mockupImage} alt="Solar mockup of the property" className="w-full h-full object-cover absolute inset-0" />
        ) : (
          <img src="/brand/portal-hero-cutout.webp" alt="Your home" className="w-[86%] max-h-[300px] object-contain" style={{ filter: 'drop-shadow(0 16px 26px rgba(0,0,0,0.5))' }} />
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0b1424]/70">
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <div className="w-8 h-8 rounded-full border-2 border-white/25 border-t-white animate-spin" />
              <div className="text-[13px] font-medium text-white/90">{stageLabel}</div>
            </div>
          </div>
        )}
        {session.mockupImage && !busy && (
          <button onClick={() => runMockup(true)} className="absolute bottom-3 right-3 text-[11.5px] font-semibold text-white/85 hover:text-white bg-black/35 rounded-full px-3 py-1.5 flex items-center gap-1.5"><Camera size={13} /> Try another angle</button>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <Eyebrow>Your home</Eyebrow>
        <h2 className="text-[26px] sm:text-[32px] font-bold leading-tight text-ink">{session.address}</h2>
        <p className="text-[13.5px] text-muted-b">This is an <b className="text-ink-2">example design</b> based on your roof and postcode. On your south-facing roof there’s room for around <b className="text-ink-2">{panelsFor(session.design.systemKwp)} panels</b> — a <b className="text-ink-2">{session.design.systemKwp} kWp</b> system. We’ll confirm the exact layout at survey.</p>
        <div className="grid grid-cols-3 gap-3 mt-1">
          <Stat label="Panels" value={`${session.design.panels}`} sub="fit the roof" />
          <Stat label="System" value={`${session.design.systemKwp} kWp`} sub="example" tone={ACCENT} />
          <Stat label="Generates" value={`${Math.round(session.design.systemKwp * 950).toLocaleString()}`} sub="kWh / yr" tone={ACCENT} />
        </div>
        {session.mockupSource && (
          <div className="text-[11.5px] text-muted-3">
            {session.mockupSource === 'ai' ? 'AI-generated preview of solar panels on this property, from a real street-level photo.' : session.mockupSource === 'streetview' ? 'A real street photo of this address, with a preview of panel placement.' : 'No street imagery was available for this address — showing an illustrated preview instead.'}
          </div>
        )}
      </div>
    </div>
  )
}

function SlideToday({ session }: { session: ShowroomSession }) {
  const m = useMemo(() => showroomModel(session), [session])
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Eyebrow>Your energy today</Eyebrow>
        <h2 className="text-[22px] font-bold text-ink mt-1">Right now you’re spending about <span className="text-warning">{money(m.currentBill)}</span> a year on electricity.</h2>
        <p className="text-[13.5px] text-muted-b mt-1.5">Based on your bill — {session.annualKwh.toLocaleString()} kWh a year at {session.tariffPence}p a unit — and energy prices only tend to go one way.</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Per year" value={money(m.currentBill)} sub="electricity" tone="#C2410C" />
        <Stat label="Per month" value={money(session.monthlySpend)} sub="today" />
        <Stat label="Usage" value={`${(session.annualKwh / 1000).toFixed(1)}k`} sub="kWh / yr" tone={ACCENT} />
      </div>
    </div>
  )
}

const motivations = [
  {
    icon: <Bolt size={18} />, title: 'Stop renting your electricity', stat: '+64% since 2021',
    blurb: 'Grid prices have climbed relentlessly and show no sign of stopping — every panel on your roof is a fixed-price unit you never have to buy again.',
  },
  {
    icon: <Lock size={18} />, title: 'Energy independence', stat: 'Generate your own',
    blurb: 'Less exposure to price shocks, supplier changes and grid outages — the electricity your home runs on, made on your own roof.',
  },
  {
    icon: <Star size={18} />, title: "Adds to your home's value", stat: 'Buyers notice it',
    blurb: 'Solar with a strong track record of low bills is a tangible, provable asset in a sale — not just a nice-to-have.',
  },
  {
    icon: <Sun size={18} />, title: 'Lower carbon footprint', stat: '~1.3t CO₂/yr avg.',
    blurb: 'A meaningful, measurable cut to your footprint with no change to how you live — the panels do the work.',
  },
]

function SectionMotivations() {
  return (
    <div className="flex flex-col gap-4">
      <div><Eyebrow>Why go solar</Eyebrow><h2 className="text-[22px] font-bold text-ink mt-1">This isn't just about the bill</h2></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {motivations.map((m) => (
          <div key={m.title} className="bg-surface border border-border rounded-card p-4 flex flex-col gap-1.5">
            <div className="w-9 h-9 rounded-lg bg-accent-wash text-accent flex items-center justify-center">{m.icon}</div>
            <div className="text-[14px] font-semibold text-ink mt-1">{m.title}</div>
            <div className="text-[12px] font-bold text-accent">{m.stat}</div>
            <div className="text-[12.5px] text-muted-b leading-snug">{m.blurb}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---- the interactive proposal builder (the core) ---- */
function SectionDesign({ session }: { session: ShowroomSession }) {
  const act = useActions()
  const m = useMemo(() => showroomModel(session), [session])
  const d = session.design
  const monthly = useMemo(() => monthlyGeneration(m.generationKwh), [m.generationKwh])
  const daily = useMemo(() => dailyGenerationCurve(d.systemKwp), [d.systemKwp])
  const setKwp = (kwp: number) => act.updateShowroomDesign(session.id, { systemKwp: Math.round(kwp * 10) / 10, panels: panelsFor(kwp) })
  const KWPS = [3.2, 4.0, 4.8, 5.6, 6.4]
  const BATTS = [5, 10, 15]
  return (
    <div className="flex flex-col gap-4">
      <div><Eyebrow>Design your system</Eyebrow><h2 className="text-[22px] font-bold text-ink mt-1">Build it together — everything updates live</h2></div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr] items-start">
        {/* controls */}
        <div className="bg-surface border border-border rounded-card p-5 flex flex-col gap-5">
          <div>
            <div className="flex items-center justify-between mb-2"><span className="text-[13px] font-semibold text-ink-2">System size</span><span className="text-[13px] font-bold text-accent">{d.systemKwp} kWp · {d.panels} panels</span></div>
            <div className="flex gap-2 flex-wrap">
              {KWPS.map((k) => <button key={k} onClick={() => setKwp(k)} className={classNames('px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors', Math.abs(d.systemKwp - k) < 0.05 ? 'text-white' : 'bg-control text-ink-2 hover:bg-[#E7EAF0]')} style={Math.abs(d.systemKwp - k) < 0.05 ? { background: ACCENT } : undefined}>{k} kWp</button>)}
            </div>
          </div>
          <div className="border-t border-divider pt-4">
            <button onClick={() => act.updateShowroomDesign(session.id, { hasBattery: !d.hasBattery })} className="w-full flex items-center gap-3 text-left">
              <span className="w-11 h-7 rounded-full relative transition-colors shrink-0" style={{ background: d.hasBattery ? ACCENT : '#D8DEE7' }}><span className="absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all shadow" style={{ left: d.hasBattery ? 18 : 2 }} /></span>
              <span className="flex-1"><span className="text-[14px] font-semibold text-ink-2">Add a battery</span><span className="block text-[12px] text-muted-2">Store daytime solar for the evening — big jump in savings</span></span>
              <Bolt size={18} className={d.hasBattery ? 'text-accent' : 'text-muted-3'} />
            </button>
            {d.hasBattery && <div className="flex gap-2 mt-3 pl-14">{BATTS.map((b) => <button key={b} onClick={() => act.updateShowroomDesign(session.id, { batteryKwh: b })} className={classNames('px-3 py-1.5 rounded-lg text-[12.5px] font-semibold', d.batteryKwh === b ? 'text-white' : 'bg-control text-ink-2')} style={d.batteryKwh === b ? { background: ACCENT } : undefined}>{b} kWh</button>)}</div>}
          </div>
          <div className="border-t border-divider pt-4">
            <button onClick={() => act.updateShowroomDesign(session.id, { hasEv: !d.hasEv, addEvCharger: !d.hasEv })} className="w-full flex items-center gap-3 text-left">
              <span className="w-11 h-7 rounded-full relative transition-colors shrink-0" style={{ background: d.hasEv ? ACCENT : '#D8DEE7' }}><span className="absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all shadow" style={{ left: d.hasEv ? 18 : 2 }} /></span>
              <span className="flex-1"><span className="text-[14px] font-semibold text-ink-2">Drive an EV (or planning to)</span><span className="block text-[12px] text-muted-2">Add a smart charger and run the car on sunshine</span></span>
              <Sun size={18} className={d.hasEv ? 'text-accent' : 'text-muted-3'} />
            </button>
          </div>
        </div>
        {/* live readout */}
        <div className="rounded-card p-5 text-white flex flex-col gap-4" style={{ background: `linear-gradient(150deg,${NAVY},#0A3B33)` }}>
          <div className="flex items-center gap-2"><Sparkle size={15} className="text-[#8FE0C6]" /><span className="text-[12px] font-semibold tracking-wide" style={{ color: '#8FE0C6' }}>LIVE RESULT</span></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.06)' }}><div className="text-[10.5px] uppercase tracking-wide text-white/55 font-semibold">Bill now</div><div className="text-[20px] font-bold" style={{ color: '#F5B85C' }}>{money(m.currentBill)}</div></div>
            <div className="rounded-lg p-3" style={{ background: 'rgba(143,224,198,0.14)' }}><div className="text-[10.5px] uppercase tracking-wide text-white/55 font-semibold">Bill after</div><div className="text-[20px] font-bold" style={{ color: '#8FE0C6' }}>{money(m.newBill)}</div></div>
          </div>
          <div className="rounded-lg p-4 text-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: '#8FE0C6' }}>You save</div>
            <div className="text-[30px] font-bold leading-tight">{money(m.annualSaving + m.evSaving)}<span className="text-[15px] font-semibold">/yr</span></div>
            {m.evSaving > 0 && <div className="text-[11.5px] text-white/70">incl. ~{money(m.evSaving)} EV fuel</div>}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><div className="text-[16px] font-bold">{m.selfSufficiency}%</div><div className="text-[10.5px] text-white/55">self-powered</div></div>
            <div><div className="text-[16px] font-bold">{m.paybackYears}<span className="text-[11px]">yrs</span></div><div className="text-[10.5px] text-white/55">payback</div></div>
            <div><div className="text-[16px] font-bold">{money(m.price, { compact: true })}</div><div className="text-[10.5px] text-white/55">system price</div></div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-surface border border-border rounded-card p-5">
          <div className="text-[13.5px] font-semibold text-ink mb-0.5">Yearly generation</div>
          <div className="text-[11.5px] text-muted-2 mb-3">{m.generationKwh.toLocaleString()} kWh/yr across the seasons — UK solar shape, this system size</div>
          <MonthlyGenerationChart data={monthly} />
        </div>
        <div className="bg-surface border border-border rounded-card p-5">
          <div className="text-[13.5px] font-semibold text-ink mb-0.5">Daily generation</div>
          <div className="text-[11.5px] text-muted-2 mb-3">Typical shape on a clear day — panels start early, peak around midday</div>
          <DailyGenerationChart points={daily} />
        </div>
      </div>

      <div className="text-[12px] text-muted-3">Prices are a guide and confirmed at survey. Savings modelled from your usage at {session.tariffPence}p/unit.</div>
    </div>
  )
}

function SlideBill({ session }: { session: ShowroomSession }) {
  const m = useMemo(() => showroomModel(session), [session])
  const cashFlow = useMemo(() => cashFlowSeries(m.annualSaving + m.evSaving, m.price), [m.annualSaving, m.evSaving, m.price])
  const cut = Math.round((1 - m.newBill / Math.max(1, m.currentBill)) * 100)
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Eyebrow>Your new bill</Eyebrow>
        <h2 className="text-[22px] font-bold text-ink mt-1">From {money(m.currentBill)} down to <span className="text-accent">{money(m.newBill)}</span> a year.</h2>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="bg-surface border border-border rounded-card px-5 py-3.5"><div className="text-[11px] font-semibold uppercase text-muted-3">Cut your bill by</div><div className="text-[26px] font-bold text-accent">{cut}%</div></div>
        <div className="text-[28px] text-muted-3">→</div>
        <div className="bg-surface border border-border rounded-card px-5 py-3.5"><div className="text-[11px] font-semibold uppercase text-muted-3">Over 25 years</div><div className="text-[26px] font-bold text-accent">{money(m.lifetimeSaving, { compact: true })}</div></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Self-powered" value={`${m.selfSufficiency}%`} sub="your own solar" />
        <Stat label="Payback" value={`${m.paybackYears} yrs`} sub="then free energy" tone={ACCENT} />
        <Stat label="CO₂ saved" value={`${(m.co2Saved / 1000).toFixed(1)}t`} sub="per year" tone={ACCENT} />
      </div>
      <div className="bg-surface border border-border rounded-card p-5">
        <div className="text-[13.5px] font-semibold text-ink mb-0.5">25-year cash flow</div>
        <div className="text-[11.5px] text-muted-2 mb-3">Cumulative net position vs the {money(m.price)} upfront cost — degradation and energy-price inflation modelled in</div>
        <CashFlowChart series={cashFlow} />
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
    <div className="flex flex-col gap-4">
      <div><Eyebrow>Why Solar House</Eyebrow><h2 className="text-[22px] font-bold text-ink mt-1">Rated 4.8★ by 43 homeowners</h2></div>
      <div className="grid gap-3 sm:grid-cols-3">
        {reviews.map((r) => (
          <div key={r.name} className="bg-surface border border-border rounded-card p-4">
            <div className="flex gap-0.5 mb-2">{[0, 1, 2, 3, 4].map((i) => <Star key={i} size={14} className="text-warning" />)}</div>
            <p className="text-[13px] text-ink-2 leading-snug">“{r.text}”</p>
            <div className="text-[12px] text-muted-2 mt-2 font-semibold">{r.name} · {r.town}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[{ i: Check, t: 'MCS certified', s: 'Every install' }, { i: Check, t: 'NICEIC approved', s: 'Electrical safety' }, { i: Check, t: 'RECC member', s: 'Consumer code' }, { i: Building, t: '3 showrooms', s: 'Cardiff · Cheltenham · Melksham' }].map((a) => (
          <div key={a.t} className="bg-surface border border-border rounded-card p-4 flex items-center gap-2.5"><span className="w-8 h-8 rounded-lg grid place-items-center text-white shrink-0" style={{ background: ACCENT }}><a.i size={15} /></span><div><div className="text-[13px] font-semibold text-ink">{a.t}</div><div className="text-[11px] text-muted-2">{a.s}</div></div></div>
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
    <div className="flex flex-col gap-4">
      <div><Eyebrow>How it works</Eyebrow><h2 className="text-[22px] font-bold text-ink mt-1">From yes to switched-on</h2></div>
      <div className="flex flex-col gap-2">
        {steps.map((s, i) => (
          <div key={s.t} className="bg-surface border border-border rounded-card p-4 flex items-center gap-4">
            <span className="w-9 h-9 rounded-lg grid place-items-center text-white shrink-0 font-bold text-[13px]" style={{ background: i === 0 ? ACCENT : NAVY }}>{i + 1}</span>
            <span className="w-9 h-9 rounded-lg grid place-items-center shrink-0 bg-accent-wash text-accent"><s.i size={17} /></span>
            <div><div className="text-[13.5px] font-semibold text-ink">{s.t}</div><div className="text-[12.5px] text-muted-b">{s.s}</div></div>
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
        <h2 className="text-[24px] font-bold text-ink leading-tight">And it doesn’t stop at install.</h2>
        <p className="text-[13.5px] text-muted-b">Every Solar House customer gets their own portal — live generation and savings, all your documents, a countdown to install day, and help whenever you need it. Here’s yours, ready to go the moment you say yes.</p>
        <div className="flex flex-wrap gap-2">{['Live monitoring', 'Your documents', 'Install countdown', 'Ask Ovi help'].map((t) => <Chip key={t} tone="positive">{t}</Chip>)}</div>
      </div>
      {/* device mock of the portal overview */}
      <div className="rounded-card p-4 text-white" style={{ background: `linear-gradient(150deg,${NAVY},#0A3B33)` }}>
        <div className="flex items-center gap-2 mb-3"><img src="/brand/solar-house-logo.png" width={22} height={22} /><span className="text-[12px] font-bold lowercase">the solar house</span><span className="ml-auto text-[10.5px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(143,224,198,0.18)', color: '#8FE0C6' }}>Live</span></div>
        <div className="text-[12px]" style={{ color: '#8FE0C6' }}>Welcome, {session.name.split(' ')[0]} 👋</div>
        <div className="text-[19px] font-bold">{session.design.systemKwp} kWp{session.design.hasBattery ? ' + battery' : ''}</div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase text-white/50 font-semibold">Saving/yr</div><div className="text-[14px] font-bold" style={{ color: '#8FE0C6' }}>{money(m.annualSaving, { compact: true })}</div></div>
          <div className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase text-white/50 font-semibold">Self-power</div><div className="text-[14px] font-bold">{m.selfSufficiency}%</div></div>
          <div className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.06)' }}><div className="text-[9px] uppercase text-white/50 font-semibold">Payback</div><div className="text-[14px] font-bold">{m.paybackYears}y</div></div>
        </div>
      </div>
    </div>
  )
}

function SlideQuote({ session }: { session: ShowroomSession }) {
  const m = useMemo(() => showroomModel(session), [session])
  const b = useMemo(() => priceBreakdown(session.design), [session.design])
  const monthly = Math.round(b.total / 120) // ~10yr 0% finance guide
  return (
    <div className="flex flex-col gap-4">
      <div><Eyebrow>Your quote</Eyebrow><h2 className="text-[22px] font-bold text-ink mt-1">Everything, itemised — no surprises</h2></div>
      <div className="bg-surface border border-border rounded-card p-5">
        <div className="flex items-center justify-between py-1.5"><span className="text-[13px] text-muted-b">Solar panels, inverter &amp; installation</span><span className="text-[13px] font-semibold text-ink-2">{money(b.panels)}</span></div>
        {session.design.hasBattery && <div className="flex items-center justify-between py-1.5"><span className="text-[13px] text-muted-b">Battery storage ({session.design.batteryKwh} kWh)</span><span className="text-[13px] font-semibold text-ink-2">{money(b.battery)}</span></div>}
        {session.design.addEvCharger && <div className="flex items-center justify-between py-1.5"><span className="text-[13px] text-muted-b">EV smart charger</span><span className="text-[13px] font-semibold text-ink-2">{money(b.charger)}</span></div>}
        <div className="flex items-center justify-between py-1.5 border-t border-divider mt-1"><span className="text-[13px] text-muted-b">VAT (0% on domestic solar &amp; battery)</span><span className="text-[13px] font-semibold text-positive">£0</span></div>
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-divider"><span className="text-[15px] font-bold text-ink">Total</span><span className="text-[26px] font-bold text-ink">{money(b.total)}</span></div>
        <div className="text-[12.5px] text-muted-2 mt-1">or about <b className="text-accent">{money(monthly)}/month</b> on 0% finance over 10 years</div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="You save" value={`${money(m.annualSaving + m.evSaving, { compact: true })}/yr`} tone={ACCENT} />
        <Stat label="Payback" value={`${m.paybackYears} yrs`} />
        <Stat label="25yr saving" value={money(m.lifetimeSaving, { compact: true })} tone={ACCENT} />
      </div>
      <div className="text-[11.5px] text-muted-3">Guide price, confirmed at survey. Valid for 30 days from today. Includes full design, scaffolding, install, commissioning and MCS/DNO paperwork.</div>
    </div>
  )
}

/** A drawn signature, captured on the session as a data URL — not a legally-binding e-signature,
 *  but a real captured mark kept for the record, gating the accept action. */
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const drawn = useRef(false)

  function pos(clientX: number, clientY: number) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) }
  }
  function start(clientX: number, clientY: number) {
    drawing.current = true
    const { x, y } = pos(clientX, clientY)
    canvasRef.current!.getContext('2d')!.beginPath()
    canvasRef.current!.getContext('2d')!.moveTo(x, y)
  }
  function move(clientX: number, clientY: number) {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(clientX, clientY)
    ctx.strokeStyle = NAVY; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.lineTo(x, y); ctx.stroke()
    drawn.current = true
  }
  function end() {
    if (!drawing.current) return
    drawing.current = false
    onChange(drawn.current ? canvasRef.current!.toDataURL('image/png') : null)
  }
  function clear() {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    drawn.current = false
    onChange(null)
  }
  return (
    <div className="flex flex-col gap-1.5">
      <canvas
        ref={canvasRef} width={480} height={110}
        className="w-full border border-input-border rounded-lg bg-white touch-none cursor-crosshair"
        style={{ height: 110 }}
        onPointerDown={(e) => start(e.clientX, e.clientY)} onPointerMove={(e) => move(e.clientX, e.clientY)} onPointerUp={end} onPointerLeave={end}
        onMouseDown={(e) => start(e.clientX, e.clientY)} onMouseMove={(e) => move(e.clientX, e.clientY)} onMouseUp={end} onMouseLeave={end}
        onTouchStart={(e) => start(e.touches[0].clientX, e.touches[0].clientY)} onTouchMove={(e) => { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY) }} onTouchEnd={end}
      />
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-muted-3">Sign above to accept</div>
        <button onClick={clear} className="text-[11.5px] font-semibold text-muted-2 hover:text-ink-2">Clear</button>
      </div>
    </div>
  )
}

function SlideClose({ session, won, onWin }: { session: ShowroomSession; won: { portalId: string } | null; onWin: (p: { portalId: string }) => void }) {
  const act = useActions()
  const nav = useNavigate()
  const m = useMemo(() => showroomModel(session), [session])
  const b = useMemo(() => priceBreakdown(session.design), [session.design])
  const monthly = Math.round(b.total / 120) // ~10yr 0% finance guide
  const [signature, setSignature] = useState<string | null>(null)
  const accept = () => {
    if (signature) act.updateShowroom(session.id, { signature })
    const r = act.winShowroom(session, b.total, m.annualSaving)
    onWin({ portalId: r.portalId })
  }
  const [losing, setLosing] = useState(false)
  const [reason, setReason] = useState('')
  if (won || session.status === 'won') {
    const pid = won?.portalId ?? session.portalId!
    return (
      <div className="bg-surface border border-positive-border rounded-card p-8 text-center flex flex-col items-center gap-3">
        <span className="w-14 h-14 rounded-full grid place-items-center text-white" style={{ background: ACCENT }}><Check size={26} /></span>
        <h2 className="text-[24px] font-bold text-ink">Welcome to Solar House! 🎉</h2>
        <p className="text-[13.5px] text-muted-b max-w-[520px]">{session.name.split(' ')[0]}’s proposal is accepted and signed, the deal is logged, and their portal is live. We’ll be in touch to book the survey.</p>
        <div className="flex gap-2.5 flex-wrap justify-center mt-1">
          <Button variant="primary" color={ACCENT} icon={<Robot size={15} />} onClick={() => nav(`/customers/${pid}`)}>Open their portal</Button>
          <Button onClick={() => nav('/showroom')}>Back to showroom</Button>
        </div>
      </div>
    )
  }
  if (session.status === 'presented') {
    return (
      <div className="bg-surface border border-border rounded-card p-7 text-center flex flex-col items-center gap-2">
        <div className="text-[14px] font-semibold text-ink">{session.name.split(' ')[0]} is thinking it over</div>
        <div className="text-[12.5px] text-muted-b max-w-[440px]">A follow-up task is queued for the team. When they're ready, come back here to accept &amp; sign.</div>
        <Button variant="primary" color={ACCENT} className="mt-1" onClick={() => act.updateShowroom(session.id, { status: 'draft' })}>Back to accept &amp; sign</Button>
      </div>
    )
  }
  if (session.status === 'lost') {
    return (
      <div className="bg-surface border border-border rounded-card p-7 text-center flex flex-col items-center gap-2">
        <div className="text-[14px] font-semibold text-ink">Not going ahead</div>
        <div className="text-[12.5px] text-muted-b max-w-[440px]">Logged as lost — a follow-up task is queued in 3 days.</div>
        <Button className="mt-1" onClick={() => act.updateShowroom(session.id, { status: 'draft' })}>Reopen</Button>
      </div>
    )
  }
  return (
    <div className="bg-surface border-2 border-positive-border rounded-card p-7">
      <div className="text-center">
        <Eyebrow>Accept &amp; sign</Eyebrow>
        <h2 className="text-[22px] font-bold text-ink mt-1">Your {session.design.systemKwp} kWp{session.design.hasBattery ? ' + battery' : ''} system</h2>
        <div className="text-[38px] font-bold text-ink mt-3">{money(b.total)}</div>
        <div className="text-[13px] text-muted-b">or about <b className="text-accent">{money(monthly)}/month</b> on 0% finance</div>
        <div className="grid grid-cols-3 gap-3 mt-4 max-w-[480px] mx-auto">
          <Stat label="You save" value={`${money(m.annualSaving + m.evSaving, { compact: true })}/yr`} tone={ACCENT} />
          <Stat label="New bill" value={money(m.newBill)} tone={ACCENT} />
          <Stat label="25yr saving" value={money(m.lifetimeSaving, { compact: true })} tone={ACCENT} />
        </div>
      </div>
      <div className="max-w-[480px] mx-auto mt-5 flex flex-col gap-3">
        <SignaturePad onChange={setSignature} />
        <Button variant="primary" color={ACCENT} icon={<Check size={16} />} className={classNames('w-full justify-center', !signature && 'opacity-40 pointer-events-none')} onClick={() => signature && accept()}>
          Accept &amp; sign
        </Button>
        <div className="text-[11.5px] text-muted-3 text-center">A draft proposal — nothing’s locked in until survey. No deposit taken here.</div>

        {!losing ? (
          <div className="flex items-center justify-center gap-4 pt-2 border-t border-divider mt-1">
            <button onClick={() => act.presentShowroom(session)} className="text-[11.5px] font-semibold text-muted-2 hover:text-ink-2">They need time to think it over</button>
            <button onClick={() => setLosing(true)} className="text-[11.5px] font-semibold text-muted-2 hover:text-negative">Not going ahead</button>
          </div>
        ) : (
          <div className="pt-2 border-t border-divider mt-1 flex flex-col gap-2">
            <div className="text-[12px] font-semibold text-ink-2">Why aren't they going ahead? (kept for the team)</div>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. price, needs to check with partner, roof unsuitable…" className="w-full rounded-lg border border-input-border px-3 py-2 text-[13px] outline-none focus:border-accent" />
            <div className="flex gap-2">
              <Button onClick={() => setLosing(false)}>Cancel</Button>
              <Button color="#B01B4F" onClick={() => act.loseShowroom(session, reason)}>Confirm — not going ahead</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
