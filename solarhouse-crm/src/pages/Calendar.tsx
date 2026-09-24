import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Button } from '../components/ui'
import { Modal, Field, Input, Select } from '../components/overlays'
import { Plus, Phone, Meeting as MeetingIcon, Task as TaskIcon, Envelope, Wrench, Note } from '../components/icons'
import { useState_, useActions } from '../store/store'
import { isoDay, todayISO, effectiveDueDate, isTask } from '../lib/tasks'
import type { Activity, ActivityType } from '../store/types'
import { classNames } from '../lib/format'

type EvType = 'task' | 'call' | 'email' | 'meeting' | 'job' | 'note'
type CalEvent = { id: string; date: string; start?: string; title: string; sub: string; type: EvType; to?: string; done?: boolean }

const EV: Record<EvType, { color: string; wash: string; icon: any; label: string }> = {
  task: { color: '#C2410C', wash: '#FDF1E7', icon: TaskIcon, label: 'Task' },
  call: { color: '#13927B', wash: '#EAF6F2', icon: Phone, label: 'Call' },
  email: { color: '#13927B', wash: '#EAF6F2', icon: Envelope, label: 'Email' },
  meeting: { color: '#0E7C66', wash: '#E9F5F1', icon: MeetingIcon, label: 'Meeting' },
  job: { color: '#0891B2', wash: '#E6F5F9', icon: Wrench, label: 'Job' },
  note: { color: '#7A8494', wash: '#F1F3F7', icon: Note, label: 'Note' },
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function monthMatrix(cursor: string): string[][] {
  const [y, m] = cursor.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const lead = (first.getDay() + 6) % 7 // Monday = 0
  const start = new Date(y, m - 1, 1 - lead)
  const weeks: string[][] = []
  for (let w = 0; w < 6; w++) {
    const row: string[] = []
    for (let d = 0; d < 7; d++) { const dt = new Date(start); dt.setDate(start.getDate() + w * 7 + d); row.push(isoDay(dt)) }
    weeks.push(row)
  }
  return weeks
}
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
      ev.push({ id: a.id, date, title: a.subject, sub: dealName(a.dealId) || (a.who ?? ''), type: a.type as EvType, to: a.dealId ? `/deals/${a.dealId}` : '/tasks', done: a.done })
    })
    meetings.forEach((m) => { if (m.date) ev.push({ id: m.id, date: m.date, start: m.start, title: m.title, sub: m.dealOrg, type: 'meeting', to: '/meetings' }) })
    jobs.forEach((j) => { if (j.date) ev.push({ id: j.id, date: j.date, start: j.start, title: j.title, sub: j.customer, type: 'job', to: '/jobs' }) })
    return ev
  }, [activities, meetings, jobs, deals])
}

export function CalendarView() {
  const nav = useNavigate()
  const events = useCalendarEvents()
  const [view, setView] = useState<'month' | 'week'>('month')
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
  const label = view === 'month' ? `${MONTHS[cm - 1]} ${cy}` : (() => { const w = weekDays(cursor); return `${humanDay(w[0])} – ${humanDay(w[6])}, ${cy}` })()
  const go = (dir: -1 | 1) => setCursor((c) => (view === 'month' ? shiftMonth(c, dir) : shift(c, dir * 7)))

  return (
    <>
      <div className="shrink-0 bg-surface border-b border-border px-7 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => go(-1)} className="w-8 h-8 rounded-lg border border-border text-muted-b hover:bg-control flex items-center justify-center">‹</button>
          <button onClick={() => setCursor(today)} className="h-8 px-3 rounded-lg border border-border text-[13px] font-medium text-ink-3 hover:bg-control">Today</button>
          <button onClick={() => go(1)} className="w-8 h-8 rounded-lg border border-border text-muted-b hover:bg-control flex items-center justify-center">›</button>
        </div>
        <div className="text-[16px] font-bold text-ink">{label}</div>
        <div className="ml-auto flex items-center gap-3">
          <div className="inline-flex bg-control rounded-control p-[3px] gap-0.5">
            {(['month', 'week'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={classNames('h-[30px] px-3 rounded-[7px] text-[12.5px] font-medium capitalize transition-colors', view === v ? 'bg-white text-accent shadow-[0_1px_2px_rgba(11,18,32,0.08)]' : 'text-muted-b hover:text-ink-3')}>{v}</button>
            ))}
          </div>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setNewFor(today)}>New event</Button>
        </div>
      </div>

      {/* legend */}
      <div className="shrink-0 bg-surface-tint border-b border-border px-7 py-1.5 flex items-center gap-4 text-[11.5px] text-muted-b">
        {(['meeting', 'call', 'task', 'email', 'job'] as EvType[]).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: EV[t].color }} />{EV[t].label}</span>
        ))}
      </div>

      {view === 'month' ? (
        <main className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-7 gap-px bg-border rounded-t-lg overflow-hidden">
            {DOW.map((d) => (<div key={d} className="bg-surface text-[11px] font-semibold uppercase tracking-wide text-muted-2 text-center py-2">{d}</div>))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-border rounded-b-lg overflow-hidden" style={{ gridAutoRows: 'minmax(112px, 1fr)' }}>
            {monthMatrix(cursor).flat().map((iso) => {
              const inMonth = Number(iso.split('-')[1]) === cm
              const isToday = iso === today
              const list = byDay[iso] ?? []
              return (
                <div key={iso} onClick={() => setNewFor(iso)} className={classNames('bg-surface p-1.5 flex flex-col gap-1 cursor-pointer hover:bg-[#FBFCFF] transition-colors', !inMonth && 'bg-surface-tint')}>
                  <div className="flex items-center justify-between">
                    <span className={classNames('text-[12px] font-semibold w-6 h-6 flex items-center justify-center rounded-full', isToday ? 'bg-accent text-white' : inMonth ? 'text-ink-3' : 'text-muted-3')}>{Number(iso.split('-')[2])}</span>
                  </div>
                  {list.slice(0, 3).map((e) => (
                    <button key={e.id} onClick={(ev) => { ev.stopPropagation(); e.to && nav(e.to) }} className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-left hover:brightness-95" style={{ background: EV[e.type].wash }}>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: EV[e.type].color }} />
                      <span className={classNames('text-[11px] truncate', e.done ? 'text-muted-3 line-through' : 'text-ink-2')}>{e.start ? `${e.start} ` : ''}{e.title}</span>
                    </button>
                  ))}
                  {list.length > 3 && <button onClick={(ev) => { ev.stopPropagation(); setCursor(iso); setView('week') }} className="text-[10.5px] text-accent font-medium text-left pl-1.5">+{list.length - 3} more</button>}
                </div>
              )
            })}
          </div>
        </main>
      ) : (
        <main className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-7 gap-2">
            {weekDays(cursor).map((iso) => {
              const isToday = iso === today
              const list = byDay[iso] ?? []
              const [, , dd] = iso.split('-').map(Number)
              const dow = DOW[(new Date(Number(iso.split('-')[0]), Number(iso.split('-')[1]) - 1, dd).getDay() + 6) % 7]
              return (
                <div key={iso} className="flex flex-col gap-2 min-h-[60vh]">
                  <button onClick={() => setNewFor(iso)} className={classNames('rounded-lg py-2 text-center border', isToday ? 'border-accent bg-accent-wash' : 'border-border bg-surface hover:bg-control')}>
                    <div className="text-[11px] uppercase tracking-wide text-muted-2">{dow}</div>
                    <div className={classNames('text-[16px] font-bold', isToday ? 'text-accent' : 'text-ink-2')}>{dd}</div>
                  </button>
                  <div className="flex flex-col gap-1.5">
                    {list.length === 0 && <div className="text-[11px] text-muted-3 text-center py-3">—</div>}
                    {list.map((e) => (
                      <button key={e.id} onClick={() => e.to && nav(e.to)} className="text-left rounded-lg p-2 border hover:brightness-[0.98]" style={{ background: EV[e.type].wash, borderColor: EV[e.type].color + '33' }}>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: EV[e.type].color }} />
                          {e.start && <span className="text-[10.5px] font-semibold text-ink-3">{e.start}</span>}
                        </div>
                        <div className={classNames('text-[12px] font-medium mt-0.5 leading-tight', e.done ? 'text-muted-3 line-through' : 'text-ink-2')}>{e.title}</div>
                        {e.sub && <div className="text-[10.5px] text-muted-2 truncate">{e.sub}</div>}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </main>
      )}

      <NewEventModal date={newFor} onClose={() => setNewFor(null)} />
    </>
  )
}

const PRETTY = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}` }

function NewEventModal({ date, onClose }: { date: string | null; onClose: () => void }) {
  const { deals } = useState_()
  const act = useActions()
  const [type, setType] = useState<ActivityType>('meeting')
  const [subject, setSubject] = useState('')
  const [time, setTime] = useState('10:00')
  const [dealId, setDealId] = useState('')
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium')
  if (!date) return null
  const create = () => {
    if (!subject.trim()) return
    const person = deals.find((d) => d.id === dealId)?.personIds[0]
    const a: Partial<Activity> & { type: ActivityType; subject: string } = { type, subject, dueDate: date, due: PRETTY(date), dealId: dealId || undefined, personId: person, priority }
    act.logActivity(a, `${type[0].toUpperCase() + type.slice(1)} scheduled for ${humanDay(date)}`)
    setSubject(''); onClose()
  }
  return (
    <Modal open={!!date} onClose={onClose} title="New event" subtitle={`Scheduled for ${PRETTY(date)}${time ? ` · ${time}` : ''}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={create}>Add to calendar</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value as ActivityType)}>{['meeting', 'call', 'task', 'email'].map((t) => (<option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>))}</Select></Field>
        <Field label="Time"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      </div>
      <Field label="Title"><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What's happening?" autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Deal"><Select value={dealId} onChange={(e) => setDealId(e.target.value)}><option value="">None</option>{deals.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}</Select></Field>
        <Field label="Priority"><Select value={priority} onChange={(e) => setPriority(e.target.value as 'High' | 'Medium' | 'Low')}>{['High', 'Medium', 'Low'].map((p) => (<option key={p}>{p}</option>))}</Select></Field>
      </div>
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
