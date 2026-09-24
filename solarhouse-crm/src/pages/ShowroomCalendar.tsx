import { Fragment, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Chip, Avatar } from '../components/ui'
import { Modal, Field, Input, Select } from '../components/overlays'
import { ChevronRight, Plus, MapPin } from '../components/icons'
import { useState_, useActions } from '../store/store'
import type { ShowroomSession } from '../store/types'
import { SHOWROOM_LOCATIONS, SLOT_TIMES, isoDate, addDays, formatDateLabel, slotIsPast, starterDesign, kwhFromSpend } from '../lib/showroom'
import { generateMockupForAddress } from '../lib/mockup'
import { classNames } from '../lib/format'

const statusTone: Record<string, 'positive' | 'accent' | 'warning' | 'neutral'> = {
  scheduled: 'accent', completed: 'positive', 'no-show': 'warning', cancelled: 'neutral',
}

export function ShowroomCalendar() {
  const nav = useNavigate()
  const act = useActions()
  const { showroom } = useState_()
  const [date, setDate] = useState(() => isoDate(new Date()))
  const [picked, setPicked] = useState<{ location: string; time: string } | null>(null)

  const bookingAt = (location: string, time: string): ShowroomSession | undefined =>
    showroom.find((s) => s.location === location && s.scheduledDate === date && s.scheduledTime === time && s.bookingStatus !== 'cancelled')

  function cancel(s: ShowroomSession) {
    act.updateShowroom(s.id, { bookingStatus: 'cancelled' })
    act.toast(`Cancelled ${s.name}'s showroom visit`, 'warning')
  }
  function markCompleted(s: ShowroomSession) {
    act.presentShowroom(s) // they came in, saw the proposal, no decision recorded here — queues a follow-up
  }
  function markNoShow(s: ShowroomSession) {
    act.updateShowroom(s.id, { bookingStatus: 'no-show' })
    const due = new Date(); due.setDate(due.getDate() + 1)
    act.logActivity({ type: 'task', subject: `Rebook — ${s.name} was a no-show`, dealId: s.dealId, dueDate: due.toISOString().slice(0, 10), due: 'Tomorrow', priority: 'High' }, `Marked ${s.name} as a no-show — rebook task queued`)
  }

  return (
    <>
      <TopBar
        title="Showroom booking calendar"
        crumbs={['Customers', 'Showroom']}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setPicked({ location: SHOWROOM_LOCATIONS[0], time: SLOT_TIMES[0] })}>Book a slot</Button>}
      />
      <PageBody>
        <div className="flex items-center gap-2">
          <button onClick={() => setDate((d) => addDays(d, -1))} className="w-8 h-8 rounded-lg border border-border grid place-items-center hover:bg-control"><ChevronRight size={14} className="rotate-180" /></button>
          <button onClick={() => setDate((d) => addDays(d, 1))} className="w-8 h-8 rounded-lg border border-border grid place-items-center hover:bg-control"><ChevronRight size={14} /></button>
          <button onClick={() => setDate(isoDate(new Date()))} className="h-8 px-3 rounded-lg border border-border text-[12.5px] font-semibold text-ink-2 hover:bg-control">Today</button>
          <div className="text-[15px] font-bold text-ink ml-2">{formatDateLabel(date)}</div>
        </div>

        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <div className="grid grid-cols-[80px_1fr_1fr_1fr]">
            <div className="border-b border-r border-divider bg-canvas" />
            {SHOWROOM_LOCATIONS.map((loc) => (
              <div key={loc} className="border-b border-r border-divider last:border-r-0 bg-canvas px-3 py-2.5 flex items-center gap-1.5">
                <MapPin size={13} className="text-muted-3" /><span className="text-[13px] font-semibold text-ink-2">{loc}</span>
              </div>
            ))}
            {SLOT_TIMES.map((time) => (
              <Fragment key={time}>
                <div className="border-b border-r border-divider px-2 py-3 text-[11.5px] font-semibold text-muted-2 flex items-start">{time}</div>
                {SHOWROOM_LOCATIONS.map((loc) => {
                  const booking = bookingAt(loc, time)
                  const past = slotIsPast(date, time)
                  return (
                    <div key={`${loc}-${time}`} className="border-b border-r border-divider last:border-r-0 p-1.5 min-h-[64px]">
                      {booking ? (
                        <div className="w-full h-full rounded-lg border border-border-blue bg-accent-wash-4 hover:bg-accent-wash p-2 flex items-start gap-2 group relative">
                          <button onClick={() => nav(`/showroom/${booking.id}`)} className="flex items-start gap-2 flex-1 min-w-0 text-left">
                            <Avatar name={booking.name} size={22} />
                            <div className="min-w-0 flex-1">
                              <div className="text-[12.5px] font-semibold text-ink-2 truncate">{booking.name}</div>
                              <div className="text-[11px] text-muted-2 truncate">{booking.address}</div>
                            </div>
                          </button>
                          <div className="flex flex-col items-end gap-1">
                            <Chip tone={statusTone[booking.bookingStatus || 'scheduled']}>{booking.bookingStatus || 'scheduled'}</Chip>
                            {(booking.bookingStatus || 'scheduled') === 'scheduled' && (
                              past ? (
                                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100">
                                  <button onClick={() => markCompleted(booking)} className="text-[10.5px] font-semibold text-positive hover:underline">Completed</button>
                                  <button onClick={() => markNoShow(booking)} className="text-[10.5px] font-semibold text-warning hover:underline">No-show</button>
                                </div>
                              ) : (
                                <button onClick={() => cancel(booking)} className="text-[10.5px] font-semibold text-muted-3 hover:text-negative opacity-0 group-hover:opacity-100">Cancel</button>
                              )
                            )}
                          </div>
                        </div>
                      ) : past ? (
                        <div className="w-full h-full rounded-lg" />
                      ) : (
                        <button onClick={() => setPicked({ location: loc, time })} className="w-full h-full rounded-lg border border-dashed border-border text-muted-3 hover:border-accent hover:text-accent hover:bg-accent-wash text-[11.5px] font-medium flex items-center justify-center gap-1">
                          <Plus size={13} /> Book
                        </button>
                      )}
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </PageBody>
      {picked && <BookSlotModal date={date} location={picked.location} time={picked.time} onClose={() => setPicked(null)} onBooked={(id) => { setPicked(null); nav(`/showroom/${id}`) }} />}
    </>
  )
}

export function BookSlotModal({ date, location, time, onClose, onBooked }: { date: string; location: string; time: string; onClose: () => void; onBooked: (id: string) => void }) {
  const act = useActions()
  const { deals } = useState_()
  // Search-first: most visits are for people already in the CRM, so find them before typing anything.
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [mode, setMode] = useState<'search' | 'new'>('search')
  const matches = q.trim().length < 2 ? [] : deals.filter((d) => d.journey && !d.lost && `${d.name} ${d.org} ${d.journey.postcode} ${d.journey.phone} ${d.journey.email}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
  const existing = deals.find((d) => d.id === picked)
  function bookExisting() {
    if (!existing?.journey) return
    const j = existing.journey
    const design = existing.journey.system
      ? { systemKwp: j.system!.kwp, panels: j.system!.panels, hasBattery: j.system!.batteryKwh > 0, batteryKwh: j.system!.batteryKwh, hasEv: j.property.hasEv, addEvCharger: j.system!.evCharger }
      : starterDesign(j.property.annualKwh)
    const session = act.createShowroom({
      name: existing.name, email: j.email, phone: j.phone, address: existing.org, postcode: j.postcode, monthlySpend: j.property.monthlyBill, annualKwh: j.property.annualKwh, tariffPence: 24.5,
      occupancy: 'in_half_day', design, presenter: existing.owner, dealId: existing.id, location: loc, scheduledDate: date, scheduledTime: time, bookingStatus: 'scheduled',
    })
    act.updateDeal(existing.id, { journey: { ...j, nextAction: { label: `Showroom visit · ${loc} ${formatDateLabel(date)} ${time}`, due: new Date(`${date}T${time}`).getTime() } } })
    act.logActivity({ type: 'meeting', subject: `Showroom visit booked — ${loc}`, body: `${formatDateLabel(date)} at ${time}`, dealId: existing.id, done: false, dueDate: date }, undefined)
    act.toast(`${existing.name} booked into ${loc} · ${time}`)
    onBooked(session.id)
  }
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [postcode, setPostcode] = useState('')
  const [spend, setSpend] = useState('160')
  const [tariff, setTariff] = useState('28')
  const [occ, setOcc] = useState<ShowroomSession['occupancy']>('in_half_day')
  const [loc, setLoc] = useState(location)

  function book() {
    if (!name.trim() || !address.trim()) return
    const t = Number(tariff) || 28
    const annualKwh = kwhFromSpend(Number(spend) || 0, t)
    const design = starterDesign(annualKwh)
    const session = act.createShowroom({
      name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, address: address.trim(), postcode: postcode.trim() || undefined,
      monthlySpend: Number(spend) || 0, annualKwh, tariffPence: t, occupancy: occ, design, presenter: 'Jordan Miles',
      location: loc, scheduledDate: date, scheduledTime: time, bookingStatus: 'scheduled',
    })
    const deal = act.addDeal({
      name: `Showroom visit — ${name.trim()}`, org: address.trim(), subtitle: `Booked · ${loc} · ${formatDateLabel(date)} ${time}`,
      value: 0, stage: 'Demo Scheduled', owner: 'Jordan Miles', health: 'Healthy',
      chips: [{ label: 'Showroom', tone: 'accent' }], personIds: [],
    })
    act.updateShowroom(session.id, { dealId: deal.id })
    act.logActivity({ type: 'meeting', subject: `Showroom visit booked — ${loc}`, body: `${formatDateLabel(date)} at ${time}`, dealId: deal.id, done: false, dueDate: date }, undefined)
    act.logActivity({ type: 'email', subject: 'Showroom visit confirmation sent', body: `Sent to ${email.trim() || name.trim()}: ${loc} showroom, ${formatDateLabel(date)} at ${time}.`, dealId: deal.id, done: true, source: 'email' }, undefined)
    act.toast(`Booked — confirmation email sent, design preview generating`, 'positive')
    // Fire the AI/composite design preview now, ahead of the visit, so it's ready when they arrive.
    void generateMockupForAddress(address.trim(), design.panels).then(({ dataUrl, source }) => {
      act.updateShowroom(session.id, { mockupImage: dataUrl, mockupSource: source })
    })
    onBooked(session.id)
  }

  return (
    <Modal open onClose={onClose} title="Book a showroom slot" subtitle={`${loc} · ${formatDateLabel(date)} · ${time}`}
      footer={<><Button onClick={onClose}>Cancel</Button>{mode === 'search' ? <Button variant="primary" onClick={bookExisting}>{existing ? `Book ${existing.name.split(' ')[0]} in` : 'Pick a customer'}</Button> : <Button variant="primary" onClick={book}>Book &amp; send confirmation</Button>}</>}>
      <Field label="Showroom location">
        <Select value={loc} onChange={(e) => setLoc(e.target.value)}>
          {SHOWROOM_LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
        </Select>
      </Field>
      {mode === 'search' ? (
        <>
          <Field label="Find the customer">
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPicked(null) }} placeholder="Name, postcode, phone or email…" autoFocus />
          </Field>
          <div className="flex flex-col gap-1 max-h-[260px] overflow-y-auto">
            {matches.map((d) => (
              <button key={d.id} onClick={() => setPicked(d.id)} className={classNames('text-left rounded-lg border px-3 py-2 flex items-center gap-3 transition-colors', picked === d.id ? 'border-accent bg-accent-wash' : 'border-border hover:border-input-border')}>
                <Avatar name={d.name} size={28} />
                <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-ink-2 truncate">{d.name}</span><span className="block text-[11.5px] text-muted-2 truncate">{d.org} · {d.journey!.phone}</span></span>
                <span className="text-[11px] font-semibold text-muted-b shrink-0">{d.won ? 'Customer' : d.stage}</span>
              </button>
            ))}
            {q.trim().length >= 2 && !matches.length && <div className="text-[12.5px] text-muted-2 px-1">No one matches “{q}”.</div>}
          </div>
          <button onClick={() => { setMode('new'); setName(q) }} className="text-[12.5px] font-semibold text-accent self-start">+ Not in the system? Add a new customer</button>
        </>
      ) : (
        <>
          <button onClick={() => setMode('search')} className="text-[12.5px] font-semibold text-accent self-start">← Search existing customers instead</button>
          <Field label="Customer name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus /></Field>
        </>
      )}
      {mode === 'new' && (<>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" /></Field>
        <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Address"><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House & street, town" /></Field>
        <Field label="Postcode"><Input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="GL52 3AB" /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Bill (£/month)"><Input type="number" value={spend} onChange={(e) => setSpend(e.target.value)} /></Field>
        <Field label="Unit rate (p)"><Input type="number" value={tariff} onChange={(e) => setTariff(e.target.value)} /></Field>
        <Field label="At home during the day?"><Select value={occ} onChange={(e) => setOcc(e.target.value as ShowroomSession['occupancy'])}><option value="home_all_day">Home most of the day</option><option value="in_half_day">In part of the day</option><option value="out_all_day">Out all day</option></Select></Field>
      </div>
      </>)}
    </Modal>
  )
}
