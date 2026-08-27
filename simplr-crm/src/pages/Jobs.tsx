import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Segmented, Kpi, Chip } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Plus, Sparkle, Wrench, Clock, MapPin, Check } from '../components/icons'
import { Modal, Field, Input, Select } from '../components/overlays'
import { useState_, useActions } from '../store/store'
import { tradeByKey, jobKindMeta } from '../lib/trades'
import type { Job, JobKind, JobStatus, Engineer } from '../store/types'
import { classNames } from '../lib/format'

// ---- date helpers (current working week, Mon-anchored) ----
const isoOf = (d: Date) => d.toISOString().slice(0, 10)
function weekDays(): Date[] {
  const t = new Date()
  const dow = t.getDay() // 0 Sun..6 Sat
  const monOffset = dow === 0 ? -6 : 1 - dow
  const mon = new Date(t)
  mon.setDate(t.getDate() + monOffset)
  return Array.from({ length: 6 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d })
}
const dayName = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short' })
const dayNum = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const endTime = (start?: string, mins = 60) => {
  if (!start) return ''
  const [h, m] = start.split(':').map(Number)
  const t = h * 60 + m + mins
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
const hrs = (m: number) => (m % 60 === 0 ? `${m / 60}h` : `${(m / 60).toFixed(1)}h`)

const statusTone: Record<JobStatus, 'neutral' | 'accent' | 'warning' | 'positive' | 'negative'> = {
  unscheduled: 'warning', scheduled: 'accent', 'in-progress': 'accent', complete: 'positive', cancelled: 'negative',
}

export function Jobs() {
  const nav = useNavigate()
  const { jobs, engineers, activeTrade } = useState_()
  const act = useActions()
  const [view, setView] = useState('Schedule')
  const [book, setBook] = useState(false)
  const [sel, setSel] = useState<Job | null>(null)
  const [busy, setBusy] = useState(false)

  const week = useMemo(weekDays, [])
  const weekIsos = week.map(isoOf)
  const inWeek = jobs.filter((j) => j.date && weekIsos.includes(j.date))
  const backlog = jobs.filter((j) => j.status === 'unscheduled' || j.crew.length === 0)
  const installsThisWeek = inWeek.filter((j) => j.kind === 'install').length

  // Simulated AI auto-scheduler — assigns the backlog to sensible crew + days.
  const autoAssign = () => {
    if (busy) return
    if (backlog.length === 0) { act.toast('Nothing in the backlog to schedule', 'accent'); return }
    setBusy(true)
    setTimeout(() => {
      backlog.forEach((j, i) => {
        const day = isoOf(week[Math.min(4, (i + 2) % 5)])
        const crew = j.kind === 'survey' || j.kind === 'showroom'
          ? [engineers.find((e) => e.skills.toLowerCase().includes('survey'))?.id ?? engineers[0].id]
          : [engineers[0].id, engineers[1].id]
        act.updateJob(j.id, { date: day, start: j.kind === 'install' ? '08:00' : '10:00', crew, status: 'scheduled' })
      })
      setBusy(false)
      act.toast(`TellOvi AI scheduled ${backlog.length} job${backlog.length > 1 ? 's' : ''} across your team`)
    }, 1100)
  }

  return (
    <>
      <TopBar
        title="Jobs"
        crumbs={['Field operations']}
        center={<Segmented options={['Schedule', 'List']} value={view} onChange={setView} />}
        actions={
          <>
            <Button icon={<Sparkle size={16} />} onClick={autoAssign}>{busy ? 'Scheduling…' : 'Auto-assign'}</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setBook(true)}>Book job</Button>
          </>
        }
      />
      <BookJobModal open={book} onClose={() => setBook(false)} />
      {sel && <JobDetail job={jobs.find((j) => j.id === sel.id) ?? sel} engineers={engineers} onClose={() => setSel(null)} onOpenDeal={(id) => { setSel(null); nav(`/deals/${id}`) }} />}

      <PageBody>
        <div className="grid grid-cols-4 gap-4">
          <Kpi label="Jobs this week" value={String(inWeek.length)} delta={`${engineers.length} engineers`} deltaTone="muted" />
          <Kpi variant="blue" label="Installs booked" value={String(installsThisWeek)} delta="This week" deltaTone="muted" />
          <Kpi label="Surveys & consults" value={String(inWeek.filter((j) => j.kind === 'survey' || j.kind === 'showroom').length)} delta="This week" deltaTone="muted" />
          <Kpi label="Unscheduled backlog" value={String(backlog.length)} delta={backlog.length ? 'Needs a slot' : 'All booked'} deltaTone={backlog.length ? 'negative' : 'muted'} />
        </div>

        {view === 'List' ? (
          <JobList jobs={[...jobs].sort((a, b) => (a.date ?? '9').localeCompare(b.date ?? '9') || (a.start ?? '').localeCompare(b.start ?? ''))} engineers={engineers} onSelect={setSel} />
        ) : (
          <>
            {/* Unscheduled backlog strip */}
            {backlog.length > 0 && (
              <div className="bg-surface border border-border rounded-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[13px] font-bold text-ink">Unscheduled</span>
                  <Chip tone="warning">{backlog.length}</Chip>
                  <span className="text-[12px] text-muted-2">— drop into the week, or let AI place them</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {backlog.map((j) => {
                    const m = jobKindMeta[j.kind]
                    return (
                      <button key={j.id} onClick={() => setSel(j)} className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 hover:border-accent transition-colors text-left">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
                        <span className="text-[12.5px] font-semibold text-ink-2">{j.title}</span>
                        <span className="text-[11.5px] text-muted-2">· {j.customer}</span>
                        <span className="text-[11px] text-muted-3">{hrs(j.durationMins)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Week swimlane grid */}
            <div className="bg-surface border border-border rounded-card overflow-hidden">
              <div className="overflow-x-auto">
                <div style={{ minWidth: 900 }}>
                  {/* day header */}
                  <div className="grid border-b border-border" style={{ gridTemplateColumns: '150px repeat(6, 1fr)' }}>
                    <div className="px-3 py-2.5 text-[11px] font-semibold text-muted-3 uppercase tracking-wide">Team</div>
                    {week.map((d) => {
                      const today = isoOf(d) === isoOf(new Date())
                      return (
                        <div key={isoOf(d)} className={classNames('px-3 py-2.5 text-center border-l border-divider', today && 'bg-accent-wash-4')}>
                          <div className={classNames('text-[12px] font-bold', today ? 'text-accent-700' : 'text-ink-2')}>{dayName(d)}</div>
                          <div className="text-[11px] text-muted-2">{dayNum(d)}</div>
                        </div>
                      )
                    })}
                  </div>
                  {/* engineer lanes */}
                  {engineers.map((eng) => (
                    <div key={eng.id} className="grid border-b border-divider last:border-0" style={{ gridTemplateColumns: '150px repeat(6, 1fr)' }}>
                      <div className="px-3 py-3 flex items-center gap-2 border-r border-divider">
                        <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ background: eng.color }}>{eng.initials}</span>
                        <div className="min-w-0"><div className="text-[12.5px] font-semibold text-ink-2 truncate">{eng.name.split(' ')[0]}</div><div className="text-[10.5px] text-muted-2 truncate">{eng.skills.split('·')[0]}</div></div>
                      </div>
                      {week.map((d) => {
                        const iso = isoOf(d)
                        const cell = inWeek.filter((j) => j.date === iso && j.crew.includes(eng.id)).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))
                        return (
                          <div key={iso} className="px-1.5 py-1.5 border-l border-divider min-h-[64px] flex flex-col gap-1.5">
                            {cell.map((j) => {
                              const m = jobKindMeta[j.kind]
                              return (
                                <button key={j.id} onClick={() => setSel(j)} className="text-left rounded-lg px-2 py-1.5 hover:shadow-card transition-shadow" style={{ background: m.bg, borderLeft: `3px solid ${m.color}` }}>
                                  <div className="flex items-center gap-1 text-[10.5px] font-semibold" style={{ color: m.color }}><Clock size={10} />{j.start}–{endTime(j.start, j.durationMins)}</div>
                                  <div className="text-[11.5px] font-semibold text-ink-2 leading-tight truncate">{j.title}</div>
                                  <div className="text-[10.5px] text-muted-2 truncate">{j.customer}</div>
                                </button>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap text-[11.5px] text-muted-2">
              {(Object.keys(jobKindMeta) as JobKind[]).map((k) => (
                <span key={k} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: jobKindMeta[k].color }} />{jobKindMeta[k].label}</span>
              ))}
              <span className="text-muted-3">· {tradeByKey(activeTrade).name} · times & crew from your trade profile</span>
            </div>
          </>
        )}
      </PageBody>
    </>
  )
}

function JobList({ jobs, engineers, onSelect }: { jobs: Job[]; engineers: Engineer[]; onSelect: (j: Job) => void }) {
  const template = '1.4fr 1.4fr 1fr 1.1fr 1fr 0.9fr'
  const engName = (id: string) => engineers.find((e) => e.id === id)?.name.split(' ')[0] ?? ''
  return (
    <Table
      template={template}
      columns={[
        { key: 'job', header: 'Job' },
        { key: 'customer', header: 'Customer' },
        { key: 'type', header: 'Type' },
        { key: 'when', header: 'When' },
        { key: 'crew', header: 'Crew' },
        { key: 'status', header: 'Status' },
      ]}
      footer={<span>{jobs.length} jobs</span>}
    >
      {jobs.map((j) => {
        const m = jobKindMeta[j.kind]
        return (
          <Row key={j.id} template={template} onClick={() => onSelect(j)}>
            <Cell className="font-semibold text-ink-2"><span className="font-mono text-[11px] text-muted-3 mr-2">{j.ref}</span>{j.title}</Cell>
            <Cell muted>{j.customer}</Cell>
            <Cell><span className="inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color: m.color }}><span className="w-2 h-2 rounded-full" style={{ background: m.color }} />{m.label}</span></Cell>
            <Cell muted>{j.date ? `${j.date.slice(8)}/${j.date.slice(5, 7)}${j.start ? ` · ${j.start}` : ''}` : '—'}</Cell>
            <Cell muted>{j.crew.map(engName).join(', ') || '—'}</Cell>
            <Cell><Chip tone={statusTone[j.status]} dot>{j.status}</Chip></Cell>
          </Row>
        )
      })}
    </Table>
  )
}

function JobDetail({ job, engineers, onClose, onOpenDeal }: { job: Job; engineers: Engineer[]; onClose: () => void; onOpenDeal: (id: string) => void }) {
  const act = useActions()
  const m = jobKindMeta[job.kind]
  const setStatus = (s: JobStatus) => act.setJobStatus(job, s)
  const toggleCrew = (id: string) => {
    const crew = job.crew.includes(id) ? job.crew.filter((c) => c !== id) : [...job.crew, id]
    act.assignCrew(job.id, crew)
  }
  return (
    <Modal open onClose={onClose} title={job.title} subtitle={`${job.ref} · ${m.label}`}
      footer={<>
        <Button onClick={() => { act.removeJob(job.id, job.ref); onClose() }}>Delete</Button>
        <div className="flex-1" />
        {job.dealId && <Button onClick={() => onOpenDeal(job.dealId!)}>Open deal</Button>}
        {job.status !== 'complete'
          ? <Button variant="primary" icon={<Check size={16} />} onClick={() => { setStatus('complete'); onClose() }}>Mark complete</Button>
          : <Button variant="primary" onClick={onClose}>Done</Button>}
      </>}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[13px] text-ink-3"><MapPin size={15} className="text-muted-2" />{job.address || '—'}</div>
        <div className="grid grid-cols-3 gap-3 text-[12.5px]">
          <div><div className="text-[11px] text-muted-3 mb-0.5">Customer</div><div className="font-semibold text-ink-2">{job.customer}</div></div>
          <div><div className="text-[11px] text-muted-3 mb-0.5">When</div><div className="font-semibold text-ink-2">{job.date ? `${job.date} · ${job.start ?? ''}` : 'Unscheduled'}</div></div>
          <div><div className="text-[11px] text-muted-3 mb-0.5">Duration</div><div className="font-semibold text-ink-2">{hrs(job.durationMins)}</div></div>
        </div>
        <div>
          <div className="text-[11px] text-muted-3 mb-1.5">Crew</div>
          <div className="flex flex-wrap gap-2">
            {engineers.map((e) => {
              const on = job.crew.includes(e.id)
              return (
                <button key={e.id} onClick={() => toggleCrew(e.id)} className={classNames('flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors', on ? 'border-border-blue bg-accent-wash-4' : 'border-border hover:bg-control')}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: e.color }}>{e.initials}</span>
                  <span className="text-[12px] font-medium text-ink-2">{e.name.split(' ')[0]}</span>
                  {on && <Check size={13} className="text-accent" />}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-muted-3 mb-1.5">Status</div>
          <div className="flex flex-wrap gap-1.5">
            {(['scheduled', 'in-progress', 'complete', 'cancelled'] as JobStatus[]).map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={classNames('text-[12px] font-medium rounded-lg px-2.5 py-1.5 border transition-colors', job.status === s ? 'border-accent bg-accent-wash-2 text-accent-700' : 'border-border text-ink-3 hover:bg-control')}>{s}</button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function BookJobModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { engineers, activeTrade } = useState_()
  const act = useActions()
  const jobTypes = tradeByKey(activeTrade).jobTypes
  const [kind, setKind] = useState<JobKind>(jobTypes[0].key)
  const [title, setTitle] = useState(jobTypes[0].label)
  const [customer, setCustomer] = useState('')
  const [address, setAddress] = useState('')
  const [date, setDate] = useState('')
  const [start, setStart] = useState('09:00')
  const [crew, setCrew] = useState<string[]>([])

  const pickKind = (k: JobKind) => {
    setKind(k)
    const t = jobTypes.find((x) => x.key === k)
    if (t) setTitle(t.label)
  }
  const reset = () => { setCustomer(''); setAddress(''); setDate(''); setCrew([]) }
  const save = () => {
    if (!title.trim() || !customer.trim()) return
    const dur = jobTypes.find((x) => x.key === kind)?.defaultMins ?? 60
    act.addJob({ kind, title: title.trim(), customer: customer.trim(), address, date: date || undefined, start: date ? start : undefined, durationMins: dur, crew })
    reset(); onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Book a job" subtitle="Survey, appointment, install or service"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={<Wrench size={15} />} onClick={save}>Book job</Button></>}>
      <Field label="Job type">
        <div className="grid grid-cols-3 gap-2">
          {jobTypes.map((t) => (
            <button key={t.key} onClick={() => pickKind(t.key)} className={classNames('text-left rounded-lg border px-2.5 py-2 transition-colors', kind === t.key ? 'border-accent bg-accent-wash-2' : 'border-border hover:bg-control')}>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: jobKindMeta[t.key].color }}><span className="w-2 h-2 rounded-full" style={{ background: jobKindMeta[t.key].color }} />{t.label}</div>
              <div className="text-[10.5px] text-muted-2 mt-0.5">{hrs(t.defaultMins)}</div>
            </button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Customer"><Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Dana Kirk" autoFocus /></Field>
      </div>
      <Field label="Address / location"><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="14 Brightleaf Way, Manchester — or ‘Showroom’" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Start"><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
      </div>
      <Field label="Assign crew">
        <div className="flex flex-wrap gap-2">
          {engineers.map((e) => {
            const on = crew.includes(e.id)
            return (
              <button key={e.id} onClick={() => setCrew((c) => (on ? c.filter((x) => x !== e.id) : [...c, e.id]))} className={classNames('flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors', on ? 'border-border-blue bg-accent-wash-4' : 'border-border hover:bg-control')}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: e.color }}>{e.initials}</span>
                <span className="text-[12px] font-medium text-ink-2">{e.name.split(' ')[0]}</span>
                {on && <Check size={13} className="text-accent" />}
              </button>
            )
          })}
        </div>
      </Field>
      <div className="text-[11.5px] text-muted-3">Leave the date blank to drop it in the unscheduled backlog — Auto-assign can place it for you.</div>
    </Modal>
  )
}
