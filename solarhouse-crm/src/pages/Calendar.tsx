import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Button, Segmented } from '../components/ui'
import { MonthGrid, type GridEvent } from '../components/MonthGrid'
import { Modal, Field, Input, Select, Textarea } from '../components/overlays'
import { EVENT_TYPES, PURPOSES, LOCATIONS, DURATIONS, REMINDERS, fmtDuration, type EventTypeId } from '../lib/activityTaxonomy'
import { Plus, Phone, Meeting as MeetingIcon, Task as TaskIcon, Envelope, Wrench, Note } from '../components/icons'
import { useState_, useActions } from '../store/store'
import { isoDay, todayISO, effectiveDueDate, isTask } from '../lib/tasks'
import { YOU_MEMBER_ID, type Activity, type ActivityType } from '../store/types'
import { classNames } from '../lib/format'

type EvType = 'task' | 'call' | 'email' | 'meeting' | 'job' | 'note'
type CalEvent = { id: string; date: string; start?: string; title: string; sub: string; type: EvType; to?: string; done?: boolean }

// one colour per kind, all from the brand family (navy · deep teal · teal · slate · light navy)
export const EV: Record<EvType, { color: string; wash: string; icon: any; label: string }> = {
  meeting: { color: '#15223B', wash: '#E9EDF4', icon: MeetingIcon, label: 'Meeting' },
  call: { color: '#0E7A66', wash: '#E1F6F1', icon: Phone, label: 'Call' },
  task: { color: '#2FBFA5', wash: '#E6FAF6', icon: TaskIcon, label: 'Task' },
  email: { color: '#64748B', wash: '#F1F3F7', icon: Envelope, label: 'Email' },
  job: { color: '#4A5A78', wash: '#EDF0F5', icon: Wrench, label: 'Job' },
  note: { color: '#7A8494', wash: '#F1F3F7', icon: Note, label: 'Note' },
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function weekDays(cursor: string): string[] {
  const [y, m, d] = cursor.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const lead = (dt.getDay() + 6) % 7
  const mon = new Date(dt); mon.setDate(dt.getDate() - lead)
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return isoDay(x) })
}
const shift = (cursor: string, days: number) => { const [y, m, d] = cursor.split('-').map(Number); const dt = new Date(y, m - 1, d + days); return isoDay(dt) }
const shiftMonth = (cursor: string, n: number) => { const [y, m] = cursor.split('-').map(Number); const dt = new Date(y, m - 1 + n, 1); return isoDay(dt) }
const humanDay = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1].slice(0, 3)}` }

/** Aggregate every dated thing in the CRM into one event list. */
export function useCalendarEvents(): CalEvent[] {
  const { activities, meetings, jobs, deals } = useState_()
  return useMemo(() => {
    const dealName = (id?: string) => deals.find((d) => d.id === id)?.org ?? ''
    const ev: CalEvent[] = []
    activities.forEach((a) => {
      if (!isTask(a)) return
      const date = effectiveDueDate(a)
      if (!date) return
      ev.push({ id: a.id, date, start: a.startTime, title: a.subject, sub: [a.purpose, a.location, dealName(a.dealId) || a.who].filter(Boolean).join(' · '), type: a.type as EvType, to: a.dealId ? `/deals/${a.dealId}` : '/tasks', done: a.done })
    })
    meetings.forEach((m) => { if (m.date) ev.push({ id: m.id, date: m.date, start: m.start, title: m.title, sub: m.dealOrg, type: 'meeting', to: '/meetings' }) })
    jobs.forEach((j) => { if (j.date) ev.push({ id: j.id, date: j.date, start: j.start, title: j.title, sub: j.customer, type: 'job', to: '/jobs' }) })
    return ev
  }, [activities, meetings, jobs, deals])
}

export function CalendarView({ only }: { only?: EvType[] } = {}) {
  const nav = useNavigate()
  const all = useCalendarEvents()
  const events = only ? all.filter((e) => only.includes(e.type)) : all
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')
  const [cursor, setCursor] = useState(todayISO())
  const [newFor, setNewFor] = useState<string | null>(null)
  const today = todayISO()

  const byDay = useMemo(() => {
    const map: Record<string, CalEvent[]> = {}
    events.forEach((e) => { (map[e.date] ??= []).push(e) })
    Object.values(map).forEach((list) => list.sort((a, b) => (a.start ?? '99').localeCompare(b.start ?? '99')))
    return map
  }, [events])

  const [cy, cm] = cursor.split('-').map(Number)
  const label = view === 'month' ? `${MONTHS[cm - 1]} ${cy}` : view === 'day' ? PRETTY(cursor)
    : (() => { const w = weekDays(cursor); return `${humanDay(w[0])} – ${humanDay(w[6])}, ${cy}` })()
  const go = (dir: -1 | 1) => setCursor((c) => (view === 'month' ? shiftMonth(c, dir) : shift(c, dir * (view === 'week' ? 7 : 1))))
  const gridEvents = useMemo(() => {
    const m: Record<string, GridEvent[]> = {}
    Object.entries(byDay).forEach(([d, list]) => {
      m[d] = list.map((e) => ({ id: e.id, label: `${e.start ? `${e.start} ` : ''}${e.title}`, title: `${EV[e.type].label}: ${e.title}${e.sub ? ` · ${e.sub}` : ''}`, color: EV[e.type].color, wash: EV[e.type].wash, done: e.done, onClick: () => e.to && nav(e.to) }))
    })
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byDay])
  const EventCard = ({ e }: { e: CalEvent }) => (
    <button onClick={() => e.to && nav(e.to)} className="w-full text-left rounded-[10px] p-2.5 border-l-[3px] bg-white border border-[#E6EAF0] hover:shadow-card transition-shadow" style={{ borderLeftColor: EV[e.type].color }}>
      <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: EV[e.type].color }}>{EV[e.type].label}{e.start && <span className="text-ink-3 normal-case tracking-normal font-semibold">· {e.start}</span>}</div>
      <div className={classNames('text-[12.5px] font-semibold mt-0.5 leading-snug', e.done ? 'text-muted-3 line-through' : 'text-ink-2')}>{e.title}</div>
      {e.sub && <div className="text-[11px] text-muted-2 truncate mt-0.5">{e.sub}</div>}
    </button>
  )

  return (
    <>
      <div className="sh-toolbar shrink-0 px-7 pb-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <button onClick={() => go(-1)} className="w-9 h-9 rounded-[10px] border border-[#E1E6EC] bg-white text-ink-3 hover:bg-control flex items-center justify-center text-[16px]">‹</button>
          <button onClick={() => setCursor(today)} className="h-9 px-3.5 rounded-[10px] border border-[#E1E6EC] bg-white text-[13px] font-semibold text-ink-3 hover:bg-control">Today</button>
          <button onClick={() => go(1)} className="w-9 h-9 rounded-[10px] border border-[#E1E6EC] bg-white text-ink-3 hover:bg-control flex items-center justify-center text-[16px]">›</button>
        </div>
        <div className="text-[17px] font-bold text-ink tracking-[-0.01em]">{label}</div>
        <div className="flex items-center gap-3.5 text-[11.5px] text-muted-b ml-2">
          {(['meeting', 'call', 'task', 'email', 'job'] as EvType[]).filter((t) => !only || only.includes(t)).map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: EV[t].color }} />{EV[t].label}</span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Segmented options={['Month', 'Week', 'Day']} value={view[0].toUpperCase() + view.slice(1)} onChange={(v) => setView(v.toLowerCase() as 'month' | 'week' | 'day')} />
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setNewFor(view === 'day' ? cursor : today)}>Schedule</Button>
        </div>
      </div>

      {/* every view fills the screen — the whole month is visible without scrolling */}
      <main className="flex-1 min-h-0 px-7 pb-5 flex flex-col">
        {view === 'month' ? (
          <MonthGrid year={cy} month0={cm - 1} events={gridEvents} onDay={(d) => setNewFor(d)} onMore={(d) => { setCursor(d); setView('day') }} />
        ) : view === 'week' ? (
          <div className="flex-1 min-h-0 grid grid-cols-7 gap-2">
            {weekDays(cursor).map((iso) => {
              const isToday = iso === today
              const list = byDay[iso] ?? []
              const [, , dd] = iso.split('-').map(Number)
              const dow = DOW[(new Date(Number(iso.split('-')[0]), Number(iso.split('-')[1]) - 1, dd).getDay() + 6) % 7]
              return (
                <div key={iso} className="min-h-0 flex flex-col rounded-card bg-[#F7F9FB] border border-[#E6EAF0] overflow-hidden">
                  <button onClick={() => { setCursor(iso); setView('day') }} className={classNames('shrink-0 py-2 text-center border-b border-[#E6EAF0]', isToday ? 'bg-[#15223B]' : 'bg-white hover:bg-control')}>
                    <div className={classNames('text-[10.5px] font-bold uppercase tracking-wide', isToday ? 'text-[#62E4CC]' : 'text-muted-2')}>{dow}</div>
                    <div className={classNames('text-[17px] font-bold leading-tight', isToday ? 'text-white' : 'text-ink-2')}>{dd}</div>
                  </button>
                  <div className="flex-1 min-h-0 overflow-y-auto p-1.5 flex flex-col gap-1.5">
                    {list.length === 0 && <button onClick={() => setNewFor(iso)} className="text-[11px] text-muted-3 hover:text-ink-3 text-center py-3">+ Add</button>}
                    {list.map((e) => <EventCard key={e.id} e={e} />)}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto rounded-card bg-white border border-[#E1E6EC] shadow-card p-4">
            {(byDay[cursor] ?? []).length === 0 ? <div className="py-16 text-center text-[13px] text-muted-2">Nothing on {PRETTY(cursor)}. <button onClick={() => setNewFor(cursor)} className="font-semibold text-ink underline">Add something</button></div> : (
              <div className="grid gap-2 max-w-[760px]">{(byDay[cursor] ?? []).map((e) => <EventCard key={e.id} e={e} />)}</div>
            )}
          </div>
        )}
      </main>

      <NewEventModal date={newFor} onClose={() => setNewFor(null)} />
    </>
  )
}

const PRETTY = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}` }

/** Schedule anything — every field is a fixed list (lib/activityTaxonomy) so it records consistently. */
export function NewEventModal({ date, onClose }: { date: string | null; onClose: () => void }) {
  const { deals, teamMembers } = useState_()
  const act = useActions()
  const [type, setType] = useState<EventTypeId>('meeting')
  const [purpose, setPurpose] = useState<string>(PURPOSES.meeting[0])
  const [day, setDay] = useState(date ?? todayISO())
  const [time, setTime] = useState('10:00')
  const [mins, setMins] = useState(60)
  const [location, setLocation] = useState<string>(LOCATIONS[0])
  const [dealId, setDealId] = useState('')
  const [who, setWho] = useState(YOU_MEMBER_ID)
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium')
  const [reminder, setReminder] = useState('1h')
  const [subject, setSubject] = useState('')
  const [notes, setNotes] = useState('')
  useEffect(() => { if (date) setDay(date) }, [date])
  if (!date) return null
  const deal = deals.find((d) => d.id === dealId)
  const title = subject.trim() || `${purpose}${deal ? ` — ${deal.name}` : ''}`
  const people = teamMembers.filter((m) => !m.bot)
  const create = () => {
    const a: Partial<Activity> & { type: ActivityType; subject: string } = {
      type, subject: title, body: notes.trim() || undefined, dueDate: day, due: PRETTY(day), dealId: dealId || undefined, personId: deal?.personIds[0],
      priority, purpose, location, startTime: type === 'task' ? undefined : time, estimateMins: mins, reminder, assigneeIds: [who], who: people.find((m) => m.id === who)?.name,
    }
    act.logActivity(a, `${EVENT_TYPES.find((t) => t.id === type)!.label} scheduled · ${humanDay(day)}${type !== 'task' ? ` ${time}` : ''}`)
    setSubject(''); setNotes(''); onClose()
  }
  return (
    <Modal open onClose={onClose} title="Schedule" subtitle={`${title} · ${PRETTY(day)}${type !== 'task' ? ` at ${time}` : ''} · ${fmtDuration(mins)}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={create}>Add to calendar</Button></>}>
      <div className="grid grid-cols-4 gap-2">
        {EVENT_TYPES.map((t) => (
          <button key={t.id} onClick={() => { setType(t.id); setPurpose(PURPOSES[t.id][0]); setLocation(t.id === 'call' ? 'Phone' : t.id === 'task' || t.id === 'email' ? 'Office' : LOCATIONS[0]); setMins(t.id === 'meeting' ? 60 : t.id === 'call' ? 15 : 30) }}
            className={classNames('h-10 rounded-[10px] border text-[13px] font-semibold flex items-center justify-center gap-1.5', type === t.id ? 'bg-[#15223B] border-[#15223B] text-white' : 'border-[#E1E6EC] text-ink-3 hover:bg-control')}>
            {(() => { const I = EV[t.id].icon; return <I size={14} className={type === t.id ? 'text-[#62E4CC]' : ''} /> })()}{t.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="What is it?"><Select value={purpose} onChange={(e) => setPurpose(e.target.value)}>{PURPOSES[type].map((p) => <option key={p}>{p}</option>)}</Select></Field>
        <Field label="Customer"><Select value={dealId} onChange={(e) => setDealId(e.target.value)}><option value="">No customer</option>{deals.filter((d) => !d.lost).map((d) => (<option key={d.id} value={d.id}>{d.name}{d.journey ? ` · ${d.journey.postcode}` : ''}</option>))}</Select></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Date"><Input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></Field>
        {type !== 'task' ? <Field label="Start"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field> : <Field label="Priority"><Select value={priority} onChange={(e) => setPriority(e.target.value as 'High' | 'Medium' | 'Low')}>{['High', 'Medium', 'Low'].map((p) => <option key={p}>{p}</option>)}</Select></Field>}
        <Field label={type === 'task' ? 'Time needed' : 'Duration'}><Select value={String(mins)} onChange={(e) => setMins(Number(e.target.value))}>{DURATIONS.map((m) => <option key={m} value={m}>{fmtDuration(m)}</option>)}</Select></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Where"><Select value={location} onChange={(e) => setLocation(e.target.value)}>{LOCATIONS.map((l) => <option key={l}>{l}</option>)}</Select></Field>
        <Field label="Who's doing it"><Select value={who} onChange={(e) => setWho(e.target.value)}>{people.map((m) => <option key={m.id} value={m.id}>{m.name}{m.you ? ' (you)' : ''}</option>)}</Select></Field>
        <Field label="Reminder"><Select value={reminder} onChange={(e) => setReminder(e.target.value)}>{REMINDERS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</Select></Field>
      </div>
      <Field label="Title (optional)"><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={title} /></Field>
      <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Agenda, what to bring, access notes, anything the team should know…" /></Field>
    </Modal>
  )
}

export function Calendar() {
  return (
    <>
      <TopBar title="Calendar" crumbs={['Meetings, tasks & jobs']} />
      <CalendarView />
    </>
  )
}
