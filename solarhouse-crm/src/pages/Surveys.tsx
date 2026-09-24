import { Fragment, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Button, Kpi, Panel, Segmented } from '../components/ui'
import { Modal, Field, Input, Select } from '../components/overlays'
import { Dropdown } from '../components/Dropdown'
import { MonthColumns, HBars, DataTable, Legend, C } from '../components/charts'
import { MapPin, Calendar, Check, Clock, Camera, Person, ChevronRight, Pie, Wrench, Search, Home } from '../components/icons'
import { useState_, useActions } from '../store/store'
import type { Deal, Showroom } from '../store/types'
import { money, classNames } from '../lib/format'
import { SHOWROOM_META, SURVEYORS } from '../lib/solarHouseData'
import { allSurveys, bookPatch, completePatch, SURVEY_STATUS, SLOTS, needsUpgrade, needsBridging, hasShading, type SurveyRow } from '../lib/surveys'

/* Site surveys — Operations (today's visits, the week's diary, what needs booking, marking visits
 * complete with findings) and Analytics (throughput, speed, findings, surveyor performance). */

const DAY = 86_400_000
const SHOWROOMS = Object.keys(SHOWROOM_META) as Showroom[]
const d0 = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
const mondayOf = (t: number) => { const d = new Date(d0(t)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime() }
const fmtDay = (t: number) => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtTime = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const sys = (d: Deal) => { const s = d.journey?.system; return s ? `${s.kwp} kWp${s.batteryKwh ? ` + ${s.batteryKwh} kWh` : ''}${s.evCharger ? ' + EV' : ''}` : '—' }
const street = (d: Deal) => (d.journey?.address || d.org).split(',')[0]

function useTabs(on: 'ops' | 'analytics') {
  const nav = useNavigate()
  return { items: [{ id: 'ops', label: 'Operations', icon: Wrench }, { id: 'analytics', label: 'Analytics', icon: Pie }], value: on, onChange: (id: string) => nav(id === 'ops' ? '/studio/surveys' : '/studio/surveys/analytics') }
}

/* ============================ Operations ============================ */
export function SurveysOps() {
  const nav = useNavigate()
  const { deals } = useState_()
  const act = useActions()
  const tabs = useTabs('ops')
  const [view, setView] = useState<'Today' | 'Week' | 'To book' | 'Not done' | 'Completed'>('Today')
  const [surveyor, setSurveyor] = useState('all')
  const [showroom, setShowroom] = useState<Showroom | 'all'>('all')
  const [q, setQ] = useState('')
  const [week, setWeek] = useState(() => mondayOf(Date.now()))
  const [booking, setBooking] = useState<SurveyRow | null>(null)
  const [completing, setCompleting] = useState<SurveyRow | null>(null)

  const now = Date.now()
  const rows = useMemo(() => allSurveys(deals, now).filter((r) => !r.deal.lost), [deals]) // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = rows.filter((r) => (surveyor === 'all' || r.surveyor === surveyor) && (showroom === 'all' || r.deal.journey!.showroom === showroom) && (!q || `${r.deal.name} ${r.deal.journey!.postcode} ${r.deal.journey!.address}`.toLowerCase().includes(q.toLowerCase())))
  const weekEnd = mondayOf(now) + 7 * DAY
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const counts = {
    today: filtered.filter((r) => r.status === 'today').length,
    week: filtered.filter((r) => r.visit && r.visit >= d0(now) && r.visit < weekEnd && r.status !== 'completed').length,
    toBook: filtered.filter((r) => r.status === 'to-book').length,
    overdue: filtered.filter((r) => r.status === 'overdue').length,
    doneMonth: filtered.filter((r) => r.completedAt && r.completedAt >= monthStart).length,
  }
  const list = view === 'To book' ? filtered.filter((r) => r.status === 'to-book').sort((a, b) => a.bookedAt - b.bookedAt)
    : view === 'Not done' ? filtered.filter((r) => r.status === 'overdue').sort((a, b) => (a.visit ?? 0) - (b.visit ?? 0))
      : view === 'Completed' ? filtered.filter((r) => r.status === 'completed').sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)).slice(0, 80)
        : []
  const surveyors = surveyor === 'all' ? SURVEYORS : [surveyor]

  // Week diary item — one tidy row: time · name · postcode, with small icon actions (no cramped buttons)
  const WeekChip = ({ r }: { r: SurveyRow }) => {
    const done = r.status === 'completed'
    return (
      <div className={classNames('group relative shrink-0 rounded-[9px] border px-2 py-1.5 transition-colors', done ? 'bg-[#F7F9FB] border-[#EEF1F5]' : 'bg-white border-[#E1E6EC] hover:border-[#15223B]')}>
        <button onClick={() => nav(`/deals/${r.deal.id}`)} className="w-full text-left leading-tight">
          <span className="flex items-center gap-1.5">
            <span className={classNames('text-[10.5px] font-bold rounded px-1 py-px tabular-nums shrink-0', done ? 'bg-[#E1F6F1] text-[#0A5A4C]' : 'bg-[#15223B] text-white')}>{fmtTime(r.visit!)}</span>
            <span className={classNames('text-[12px] font-bold truncate', done ? 'text-muted-b' : 'text-ink')}>{r.deal.name}</span>
            {done && <Check size={13} className="text-[#0E7A66] shrink-0 ml-auto" />}
          </span>
          <span className="block text-[10.5px] text-muted-2 truncate mt-0.5">{r.deal.journey!.postcode} · {street(r.deal)}</span>
        </button>
        {!done && (
          // actions appear on hover so the name gets the full width
          <span className="absolute right-1 top-1 hidden group-hover:flex items-center gap-0.5 bg-white rounded-[7px] shadow-[0_2px_8px_rgba(16,24,40,0.15)] p-0.5">
            <button onClick={() => setCompleting(r)} title="Mark complete" className="w-6 h-6 rounded-[6px] bg-[#15223B] text-[#62E4CC] flex items-center justify-center"><Check size={13} /></button>
            <button onClick={() => setBooking(r)} title="Reschedule" className="w-6 h-6 rounded-[6px] hover:bg-control text-ink-3 flex items-center justify-center"><Calendar size={12} /></button>
          </span>
        )}
      </div>
    )
  }

  const VisitCard = ({ r, compact }: { r: SurveyRow; compact?: boolean }) => (
    <div className={classNames('rounded-[10px] bg-white border border-[#E1E6EC] shadow-[0_1px_2px_rgba(16,24,40,0.05)]', compact ? 'p-2' : 'p-3')}>
      <div className="flex items-center gap-2">
        {r.visit && <span className="text-[11px] font-bold text-[#15223B] bg-[#E9EDF4] rounded px-1.5 py-px tabular-nums">{fmtTime(r.visit)}</span>}
        <button onClick={() => nav(`/deals/${r.deal.id}`)} className="text-[13px] font-bold text-ink truncate flex-1 text-left hover:underline">{r.deal.name}</button>
        {r.status === 'completed' && <Check size={14} className="text-[#0E7A66]" />}
      </div>
      <div className="text-[11.5px] text-ink-3 truncate mt-0.5">{street(r.deal)} · <b className="text-ink-2">{r.deal.journey!.postcode}</b></div>
      {!compact && <div className="text-[11.5px] text-muted-2 mt-0.5 flex items-center gap-2"><span className="tabular-nums">{r.deal.journey!.phone}</span><span className="ml-auto font-semibold text-[#0A5A4C] bg-[#E6FAF6] rounded px-1.5">{sys(r.deal)}</span></div>}
      {r.status !== 'completed' && (
        <div className={classNames('flex items-center gap-1.5', compact ? 'mt-1.5' : 'mt-2.5')}>
          <button onClick={() => setCompleting(r)} className="h-7 px-2.5 rounded-[7px] bg-[#15223B] text-white text-[11.5px] font-semibold flex items-center gap-1 hover:bg-[#1E2F4E]"><Check size={12} className="text-[#62E4CC]" />Complete</button>
          <button onClick={() => setBooking(r)} className="h-7 px-2.5 rounded-[7px] border border-[#E1E6EC] text-[11.5px] font-semibold text-ink-3 hover:bg-control">Reschedule</button>
          {!compact && <a href={`https://www.google.com/maps/search/${encodeURIComponent(`${r.deal.journey!.address} ${r.deal.journey!.postcode}`)}`} target="_blank" rel="noreferrer" className="ml-auto h-7 px-2 rounded-[7px] text-[11.5px] font-semibold text-ink-3 hover:bg-control flex items-center gap-1"><MapPin size={12} />Map</a>}
        </div>
      )}
    </div>
  )

  return (
    <>
      <TopBar title="Site surveys" crumbs={['Delivery']} identity={{ icon: MapPin, accent: '#15223B' }} tabs={tabs} />
      <main className="flex-1 min-h-0 flex flex-col">
        <div className="px-7 pt-5 grid grid-cols-5 gap-4 shrink-0">
          <Kpi variant="navy" icon={Calendar} label="Surveys today" value={String(counts.today)} delta={`${SURVEYORS.length} surveyors on the road`} />
          <Kpi icon={Clock} label="Rest of this week" value={String(counts.week)} delta="booked visits" deltaTone="muted" />
          <Kpi icon={Person} label="Waiting to be booked" value={String(counts.toBook)} delta="proposal accepted, no visit yet" deltaTone="muted" />
          <Kpi icon={Camera} label="Visit passed, not written up" value={String(counts.overdue)} delta="mark complete or reschedule" deltaTone="muted" />
          <Kpi variant="teal" icon={Check} label="Completed this month" value={String(counts.doneMonth)} delta="write-ups in" />
        </div>
        <div className="sh-toolbar shrink-0 px-7 pb-3 flex items-center gap-2.5 flex-wrap">
          <Segmented options={['Today', 'Week', 'To book', 'Not done', 'Completed']} value={view} onChange={(v) => setView(v as typeof view)} />
          <Dropdown value={surveyor} onChange={(e) => setSurveyor(e.target.value)} className="h-9 px-3 rounded-[10px] border border-[#E1E6EC] bg-white text-[13px] font-semibold text-ink-3">
            <option value="all">All surveyors</option>{SURVEYORS.map((s) => <option key={s}>{s}</option>)}
          </Dropdown>
          <Dropdown value={showroom} onChange={(e) => setShowroom(e.target.value as Showroom | 'all')} className="h-9 px-3 rounded-[10px] border border-[#E1E6EC] bg-white text-[13px] font-semibold text-ink-3">
            <option value="all">All showrooms</option>{SHOWROOMS.map((s) => <option key={s} value={s}>{SHOWROOM_META[s].name}</option>)}
          </Dropdown>
          <label className="h-9 w-[240px] rounded-[10px] border border-[#E1E6EC] bg-white flex items-center gap-2 px-3"><Search size={14} className="text-muted-3" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or postcode" className="flex-1 min-w-0 bg-transparent outline-none text-[13px]" /></label>
          {view === 'Week' && (
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={() => setWeek((w) => w - 7 * DAY)} className="w-9 h-9 rounded-[10px] border border-[#E1E6EC] bg-white grid place-items-center"><ChevronRight size={14} className="rotate-180" /></button>
              <button onClick={() => setWeek(mondayOf(Date.now()))} className="h-9 px-3 rounded-[10px] border border-[#E1E6EC] bg-white text-[13px] font-semibold text-ink-3">This week</button>
              <button onClick={() => setWeek((w) => w + 7 * DAY)} className="w-9 h-9 rounded-[10px] border border-[#E1E6EC] bg-white grid place-items-center"><ChevronRight size={14} /></button>
              <span className="text-[14px] font-bold text-ink ml-1">{fmtDay(week)} – {fmtDay(week + 5 * DAY)}</span>
            </div>
          )}
        </div>

        {view === 'Today' && (
          <div className="flex-1 min-h-0 px-7 pb-5 grid gap-4" style={{ gridTemplateColumns: `repeat(${surveyors.length}, minmax(0,1fr))` }}>
            {surveyors.map((s) => {
              const mine = filtered.filter((r) => r.surveyor === s && r.visit && new Date(r.visit).toDateString() === new Date().toDateString()).sort((a, b) => a.visit! - b.visit!)
              return (
                <div key={s} className="min-h-0 flex flex-col rounded-card bg-[#F3F5F8] border border-[#E1E6EC] overflow-hidden">
                  <div className="shrink-0 px-4 py-3 bg-white border-b border-[#E6EAF0] flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-[#15223B] text-[#62E4CC] text-[11px] font-bold flex items-center justify-center">{s.split(' ').map((w) => w[0]).join('')}</span>
                    <div className="min-w-0 flex-1"><div className="text-[13.5px] font-bold text-ink">{s}</div><div className="text-[11.5px] text-muted-2">{mine.length} visit{mine.length === 1 ? '' : 's'} today</div></div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto p-2.5 flex flex-col gap-2">
                    {SLOTS.map((slot) => {
                      const r = mine.find((x) => fmtTime(x.visit!) === slot)
                      return r ? <VisitCard key={slot} r={r} /> : <div key={slot} className="rounded-[10px] border border-dashed border-[#D5DBE3] px-3 py-3 text-[12px] text-muted-3 flex items-center gap-2"><span className="font-bold text-muted-b">{slot}</span> Free slot</div>
                    })}
                    {mine.filter((x) => !SLOTS.includes(fmtTime(x.visit!) as never)).map((r) => <VisitCard key={r.deal.id} r={r} />)}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {view === 'Week' && (
          <div className="flex-1 min-h-0 px-7 pb-5">
            <div className="h-full grid rounded-card bg-white border border-[#E1E6EC] shadow-card overflow-hidden" style={{ gridTemplateColumns: '150px repeat(6, minmax(0,1fr))', gridTemplateRows: `auto repeat(${surveyors.length}, minmax(0,1fr))` }}>
              <div className="border-b border-r border-[#EEF1F5] bg-[#FAFBFC]" />
              {Array.from({ length: 6 }, (_, i) => week + i * DAY).map((t) => (
                <div key={t} className={classNames('border-b border-r border-[#EEF1F5] last:border-r-0 px-2.5 py-2 text-[12px] font-bold', d0() === t ? 'bg-[#15223B] text-white' : 'bg-[#FAFBFC] text-ink-2')}>{fmtDay(t)}</div>
              ))}
              {surveyors.map((s) => (
                <Fragment key={s}>
                  <div className="border-b border-r border-[#EEF1F5] px-3 py-2 flex items-start gap-2"><span className="w-7 h-7 rounded-full bg-[#15223B] text-[#62E4CC] text-[10px] font-bold flex items-center justify-center shrink-0">{s.split(' ').map((w) => w[0]).join('')}</span><span className="text-[12.5px] font-bold text-ink-2 leading-tight">{s}</span></div>
                  {Array.from({ length: 6 }, (_, i) => week + i * DAY).map((t) => {
                    const cell = filtered.filter((r) => r.surveyor === s && r.visit && d0(r.visit) === t).sort((a, b) => a.visit! - b.visit!)
                    return <div key={s + t} className={classNames("min-h-0 overflow-hidden border-b border-r border-[#EEF1F5] last:border-r-0 p-1.5 flex flex-col gap-1", d0() === t && "bg-[#F1FBF8]")}>{cell.slice(0, 3).map((r) => <WeekChip key={r.deal.id} r={r} />)}{cell.length > 3 && <span className="text-[10.5px] font-bold text-muted-b pl-1">+{cell.length - 3} more</span>}{!cell.length && <span className="m-auto text-[11px] text-muted-3">Free</span>}</div>
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        )}

        {(view === 'To book' || view === 'Not done' || view === 'Completed') && (
          <div className="flex-1 min-h-0 overflow-y-auto px-7 pb-5">
            <div className="rounded-card bg-white border border-[#E1E6EC] shadow-card overflow-hidden">
              <div className="grid gap-3 px-4 h-10 items-center bg-[#FAFBFC] border-b border-[#EEF1F5] text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted-3" style={{ gridTemplateColumns: 'minmax(180px,1.4fr) minmax(170px,1.3fr) 130px 120px 150px 110px 230px' }}>
                <span>Customer</span><span>Address</span><span>System</span><span>{view === 'Completed' ? 'Completed' : view === 'To book' ? 'Waiting' : 'Visit was'}</span><span>Surveyor</span><span>Status</span><span />
              </div>
              {list.map((r) => {
                const st = SURVEY_STATUS[r.status]
                return (
                  <div key={r.deal.id} className="grid gap-3 px-4 py-2.5 items-center border-b border-[#F0F2F5] last:border-b-0 hover:bg-[#FAFCFB]" style={{ gridTemplateColumns: 'minmax(180px,1.4fr) minmax(170px,1.3fr) 130px 120px 150px 110px 230px' }}>
                    <button onClick={() => nav(`/deals/${r.deal.id}`)} className="min-w-0 text-left"><div className="text-[13px] font-bold text-ink truncate hover:underline">{r.deal.name}</div><div className="text-[11.5px] text-muted-2 tabular-nums">{r.deal.journey!.phone}</div></button>
                    <div className="min-w-0 text-[12.5px] text-ink-3 truncate">{street(r.deal)} · <b className="text-ink-2">{r.deal.journey!.postcode}</b></div>
                    <div className="text-[12px] font-semibold text-[#0A5A4C]">{sys(r.deal)}</div>
                    <div className="text-[12px] text-ink-3">{view === 'Completed' ? fmtDay(r.completedAt!) : view === 'To book' ? `${Math.floor((now - r.bookedAt) / DAY)} days` : fmtDay(r.visit!)}</div>
                    <div className="text-[12px] text-ink-3 truncate">{r.surveyor ?? '—'}</div>
                    <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 w-fit" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                    <div className="flex items-center gap-1.5 justify-end">
                      {r.status !== 'completed' ? (
                        <>
                          <button onClick={() => setBooking(r)} className="h-8 px-3 rounded-[8px] border border-[#E1E6EC] text-[12px] font-semibold text-ink-3 hover:bg-control">{r.status === 'to-book' ? 'Book visit' : 'Reschedule'}</button>
                          {r.status !== 'to-book' && <button onClick={() => setCompleting(r)} className="h-8 px-3 rounded-[8px] bg-[#15223B] text-white text-[12px] font-semibold flex items-center gap-1"><Check size={12} className="text-[#62E4CC]" />Complete</button>}
                        </>
                      ) : (
                        <span className="text-[11.5px] text-muted-2 truncate">{[r.findings.roof, needsUpgrade(r) && 'CU upgrade', needsBridging(r) && 'bridging'].filter(Boolean).join(' · ')}</span>
                      )}
                    </div>
                  </div>
                )
              })}
              {!list.length && <div className="py-12 text-center text-[13px] text-muted-2">Nothing here.</div>}
            </div>
          </div>
        )}
      </main>
      {booking && <BookVisitModal r={booking} onClose={() => setBooking(null)} onSave={(visit, s) => { act.updateDeal(booking.deal.id, bookPatch(booking.deal, visit, s)); act.toast(`Survey booked · ${booking.deal.name} · ${fmtDay(visit)} ${fmtTime(visit)} with ${s.split(' ')[0]}`); setBooking(null) }} />}
      {completing && <CompleteModal r={completing} onClose={() => setCompleting(null)} onSave={(f, s) => { act.updateDeal(completing.deal.id, completePatch(completing.deal, f, s)); act.toast(`Survey complete for ${completing.deal.name} — contract is next`); setCompleting(null) }} />}
    </>
  )
}

function BookVisitModal({ r, onClose, onSave }: { r: SurveyRow; onClose: () => void; onSave: (visit: number, surveyor: string) => void }) {
  const start = r.visit && r.visit > Date.now() ? new Date(r.visit) : new Date(Date.now() + DAY)
  const [date, setDate] = useState(start.toISOString().slice(0, 10))
  const [slot, setSlot] = useState<string>(SLOTS[0])
  const [who, setWho] = useState(r.surveyor ?? SURVEYORS[0])
  return (
    <Modal open onClose={onClose} title={r.status === 'to-book' ? 'Book site survey' : 'Reschedule site survey'} subtitle={`${r.deal.name} · ${street(r.deal)}, ${r.deal.journey!.postcode}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => onSave(new Date(`${date}T${slot}`).getTime(), who)}>Save booking</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Surveyor"><Select value={who} onChange={(e) => setWho(e.target.value)}>{SURVEYORS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
      </div>
      <Field label="Slot">
        <div className="flex gap-2">{SLOTS.map((s) => <button key={s} onClick={() => setSlot(s)} className={classNames('h-9 px-4 rounded-[9px] border text-[13px] font-semibold', slot === s ? 'bg-[#15223B] border-[#15223B] text-white' : 'border-[#E1E6EC] text-ink-3 hover:bg-control')}>{s}</button>)}</div>
      </Field>
      <div className="text-[12px] text-muted-2">The customer's next action updates to this visit, so it shows on their record and in My Tasks.</div>
    </Modal>
  )
}

function CompleteModal({ r, onClose, onSave }: { r: SurveyRow; onClose: () => void; onSave: (f: SurveyRow['findings'], surveyor: string) => void }) {
  const [roof, setRoof] = useState(r.findings.roof ?? 'Concrete tile, good condition')
  const [scaffold, setScaffold] = useState(r.findings.scaffold ?? 'Standard')
  const [shading, setShading] = useState(r.findings.shading ?? 'None')
  const [cu, setCu] = useState(r.findings.consumerUnit ?? 'OK')
  const [photos, setPhotos] = useState(String(r.findings.photos ?? 24))
  const [who, setWho] = useState(r.surveyor ?? SURVEYORS[0])
  return (
    <Modal open onClose={onClose} title="Mark survey complete" subtitle={`${r.deal.name} · ${sys(r.deal)}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => onSave({ roof, scaffold, shading, consumerUnit: cu, photos: Number(photos) || 0 }, who)}>Save write-up</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Roof"><Select value={roof} onChange={(e) => setRoof(e.target.value)}>{['Concrete tile, good condition', 'Slate, good condition', 'Clay tile, minor repairs', 'Concrete tile, fair', 'Flat roof'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
        <Field label="Scaffold"><Select value={scaffold} onChange={(e) => setScaffold(e.target.value)}>{['Standard', 'Needs bridging over conservatory', 'Restricted access', 'Tower only'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
        <Field label="Shading"><Select value={shading} onChange={(e) => setShading(e.target.value)}>{['None', 'Minor (chimney)', 'Tree to west, afternoons', 'Significant — redesign'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
        <Field label="Consumer unit"><Select value={cu} onChange={(e) => setCu(e.target.value)}>{['OK', 'Needs upgrade (+£450)', 'Needs isolator only'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
        <Field label="Photos taken"><Input type="number" value={photos} onChange={(e) => setPhotos(e.target.value)} /></Field>
        <Field label="Surveyor"><Select value={who} onChange={(e) => setWho(e.target.value)}>{SURVEYORS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
      </div>
      <div className="text-[12px] text-muted-2">Saving sets the next action to “Send contract for signature”. Findings feed the survey analytics and the DNO application.</div>
    </Modal>
  )
}

/* ============================ Analytics ============================ */
export function SurveysAnalytics() {
  const { deals } = useState_()
  const tabs = useTabs('analytics')
  const [showroom, setShowroom] = useState<Showroom | 'all'>('all')
  const now = Date.now()
  const rows = useMemo(() => allSurveys(deals, now).filter((r) => showroom === 'all' || r.deal.journey!.showroom === showroom), [deals, showroom]) // eslint-disable-line react-hooks/exhaustive-deps
  const done = rows.filter((r) => r.status === 'completed')
  const mKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}` }
  const months = Array.from({ length: 8 }, (_, i) => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - 5 + i, 1).getTime() })
  const thisK = mKey(now)
  const chart = months.map((m) => {
    const k = mKey(m)
    const n = k <= thisK ? done.filter((r) => mKey(r.completedAt!) === k).length : rows.filter((r) => r.status !== 'completed' && r.visit && mKey(r.visit) === k).length
    const booked = k === thisK ? rows.filter((r) => r.status !== 'completed' && r.visit && mKey(r.visit) === k && r.visit > now).length : 0
    return { label: new Date(m).toLocaleDateString('en-GB', { month: 'short' }), value: n + booked, forecast: k > thisK || booked > 0, sub: k > thisK ? 'booked visits' : booked ? `${n} done + ${booked} still booked` : `${n} completed` }
  })
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getTime()
  const doneThis = done.filter((r) => r.completedAt! >= monthStart).length
  const doneLast = done.filter((r) => r.completedAt! >= lastMonthStart && r.completedAt! < monthStart).length
  const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
  const toVisit = median(rows.filter((r) => r.visit).map((r) => (r.visit! - r.bookedAt) / DAY))
  const decidedRows = rows.filter((r) => r.deal.won || r.deal.lost)
  const signedAfter = decidedRows.filter((r) => r.deal.won).length
  const conv = decidedRows.length ? Math.round((signedAfter / decidedRows.length) * 100) : 0
  const cuRate = done.length ? Math.round((done.filter(needsUpgrade).length / done.length) * 100) : 0
  const count = (f: (r: SurveyRow) => string | undefined) => { const m = new Map<string, number>(); done.forEach((r) => { const k = f(r); if (k) m.set(k, (m.get(k) ?? 0) + 1) }); return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })) }
  const bySurveyor = SURVEYORS.map((s) => {
    const mine = rows.filter((r) => r.surveyor === s), fin = mine.filter((r) => r.status === 'completed')
    return { s, done30: fin.filter((r) => r.completedAt! > now - 30 * DAY).length, upcoming: mine.filter((r) => r.status === 'booked' || r.status === 'today').length, overdue: mine.filter((r) => r.status === 'overdue').length, photos: fin.length ? Math.round(fin.reduce((a, r) => a + (r.findings.photos ?? 0), 0) / fin.length) : 0, conv: fin.length ? Math.round((fin.filter((r) => r.deal.won).length / fin.length) * 100) : 0, value: fin.filter((r) => r.deal.won).reduce((a, r) => a + r.deal.value, 0) }
  })
  const bySr = SHOWROOMS.map((s) => { const mine = allSurveys(deals, now).filter((r) => r.deal.journey!.showroom === s); return { s, done: mine.filter((r) => r.status === 'completed').length, open: mine.filter((r) => r.status !== 'completed').length, toBook: mine.filter((r) => r.status === 'to-book').length } })

  return (
    <>
      <TopBar title="Site surveys" crumbs={['Delivery']} identity={{ icon: MapPin, accent: '#15223B' }} tabs={tabs}
        center={<Segmented options={['All', ...SHOWROOMS.map((s) => SHOWROOM_META[s].name)]} value={showroom === 'all' ? 'All' : SHOWROOM_META[showroom].name} onChange={(v) => setShowroom(v === 'All' ? 'all' : (SHOWROOMS.find((s) => SHOWROOM_META[s].name === v) ?? 'all'))} />} />
      <main className="flex-1 overflow-y-auto">
        <div className="px-7 py-6 flex flex-col gap-5 max-w-[1500px]">
          <div className="grid grid-cols-4 gap-4">
            <Kpi variant="navy" icon={Check} label="Completed this month" value={String(doneThis)} delta={`${doneLast} last month · ${doneLast ? Math.round(((doneThis - doneLast) / doneLast) * 100) : 0}% change`} />
            <Kpi icon={Clock} label="Proposal accepted → visit" value={`${Math.round(toVisit * 10) / 10} days`} delta="median wait for a survey" deltaTone="muted" />
            <Kpi icon={Home} label="Surveyed → signed" value={`${conv}%`} meter={conv} delta={`${signedAfter} signed · ${decidedRows.length - signedAfter} dropped out after the survey`} deltaTone="muted" />
            <Kpi variant="teal" icon={Wrench} label="Consumer unit upgrades" value={`${cuRate}%`} delta="of surveys — add £450 to quotes early" />
          </div>
          <Panel title="Surveys by month" sub="Completed write-ups, with visits already booked ahead" icon={Calendar}>
            <div className="mb-3"><Legend items={[{ label: 'Completed', swatch: C.actual }, { label: 'Booked ahead', swatch: C.forecast, hatched: true }]} /></div>
            <MonthColumns data={chart} fmt={(n) => String(Math.round(n))} height={220} />
          </Panel>
          <div className="grid grid-cols-2 gap-5">
            <Panel title="What surveyors are finding — roofs" sub="Completed surveys" icon={Home}><HBars data={count((r) => r.findings.roof)} fmt={String} /></Panel>
            <Panel title="Access & electrics" sub="Things that change the price or the plan" icon={Wrench}>
              <HBars data={[
                { label: 'Needs scaffold bridging', value: done.filter(needsBridging).length },
                { label: 'Some shading', value: done.filter(hasShading).length },
                { label: 'Consumer unit upgrade', value: done.filter(needsUpgrade).length },
                { label: 'Straightforward', value: done.filter((r) => !needsBridging(r) && !hasShading(r) && !needsUpgrade(r)).length },
              ]} fmt={String} color="#15223B" />
            </Panel>
          </div>
          <Panel title="Surveyors" sub="Workload, write-up quality (photos) and how many surveyed homes go on to sign" icon={Person} pad={false}>
            <div className="p-4">
              <DataTable cols={[{ label: 'Surveyor', w: 'minmax(140px,1.4fr)' }, { label: 'Done (30 days)', align: 'right' }, { label: 'Booked ahead', align: 'right' }, { label: 'Not written up', align: 'right' }, { label: 'Avg photos', align: 'right' }, { label: 'Went on to sign', align: 'right' }, { label: 'Signed value', align: 'right' }]}
                rows={bySurveyor.map((r) => [<b key="s">{r.s}</b>, r.done30, r.upcoming, r.overdue, r.photos, `${r.conv}%`, money(r.value, { compact: true })])} />
            </div>
          </Panel>
          <Panel title="By showroom" sub="Where surveys are coming from and what's waiting" icon={MapPin} pad={false}>
            <div className="p-4">
              <DataTable cols={[{ label: 'Showroom' }, { label: 'Completed', align: 'right' }, { label: 'Open', align: 'right' }, { label: 'Waiting to book', align: 'right' }]}
                rows={bySr.map((r) => [<span key="n" className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: SHOWROOM_META[r.s].color }} /><b>{SHOWROOM_META[r.s].name}</b></span>, r.done, r.open, r.toBook])} />
            </div>
          </Panel>
        </div>
      </main>
    </>
  )
}
