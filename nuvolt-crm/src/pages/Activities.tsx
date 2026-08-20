import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Button, Chip } from '../components/ui'
import { ViewSwitch, PillTabs } from '../components/chrome'
import { Table, Row, Cell } from '../components/Table'
import { Modal, Field, Input, Select } from '../components/overlays'
import { Plus, Bars, Calendar, Phone, Meeting, Task, Envelope, Check, Filter, Note } from '../components/icons'
import { useState_, useActions } from '../store/store'
import type { Activity, ActivityType } from '../store/types'

const typeColor: Record<string, string> = { call: '#1D4ED8', meeting: '#0E7C66', task: '#C2410C', email: '#3A67E4', note: '#7A8494' }
const typeWash: Record<string, string> = { call: '#EEF2FB', meeting: '#E9F5F1', task: '#FDF1E7', email: '#EEF2FB', note: '#F1F3F7' }
const typeIcon: Record<string, any> = { call: Phone, meeting: Meeting, task: Task, email: Envelope, note: Note }
const prioTone: Record<string, 'negative' | 'warning' | 'neutral'> = { High: 'negative', Medium: 'warning', Low: 'neutral' }

const hours = Array.from({ length: 10 }, (_, i) => 8 + i)
const days = [{ d: 'Mon', n: 14 }, { d: 'Tue', n: 15, today: true }, { d: 'Wed', n: 16 }, { d: 'Thu', n: 17 }, { d: 'Fri', n: 18 }, { d: 'Sat', n: 19 }, { d: 'Sun', n: 20 }]
const HOUR = 70
const calEvents = [
  { day: 0, start: 9, dur: 1, title: 'Call — Callum Reed', sub: 'Cirrus Hosting', type: 'call' },
  { day: 1, start: 10, dur: 1.5, title: 'Microgrid proposal review', sub: 'Fenwick University', type: 'meeting' },
  { day: 1, start: 14, dur: 1, title: 'Send revised quote', sub: 'Ashford Utilities', type: 'task' },
  { day: 3, start: 9.5, dur: 1, title: 'Call — Elena Voss', sub: 'Meridian Power', type: 'call' },
  { day: 3, start: 15, dur: 2, title: 'Site survey — Brightleaf', sub: 'On-site', type: 'meeting' },
  { day: 4, start: 13, dur: 1, title: 'Follow up redlines', sub: 'Cirrus Hosting', type: 'task' },
]

export function Activities() {
  const nav = useNavigate()
  const { activities, deals, people } = useState_()
  const act = useActions()
  const [view, setView] = useState<'list' | 'week'>('list')
  const [type, setType] = useState('all')
  const [period, setPeriod] = useState('todo')
  const [showNew, setShowNew] = useState(false)

  const rows = activities
    .filter((a) => a.type === 'task' || a.type === 'call' || a.type === 'meeting' || a.type === 'email')
    .filter((a) => (type === 'all' ? true : a.type === type))
    .filter((a) => (period === 'todo' ? !a.done : period === 'overdue' ? !a.done && (a.due ?? '').includes('overdue') : true))
    .sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt)

  const template = '40px 2fr 1.6fr 0.9fr 1.2fr 1fr'
  const dealName = (id?: string) => deals.find((d) => d.id === id)?.name ?? '—'
  const personName = (id?: string) => people.find((p) => p.id === id)?.name ?? '—'

  return (
    <>
      <TopBar title="Activities" actions={<><Button icon={<Filter size={16} />}>Filter</Button><Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowNew(true)}>Activity</Button></>} />

      <div className="shrink-0 bg-surface border-b border-border px-7 py-2.5 flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <ViewSwitch tabs={[{ id: 'list', icon: Bars, label: 'List' }, { id: 'week', icon: Calendar, label: 'Calendar' }]} value={view} onChange={setView} />
          <PillTabs value={type} onChange={setType} tabs={[{ id: 'all', label: 'All' }, { id: 'call', label: 'Call', icon: Phone, color: typeColor.call }, { id: 'meeting', label: 'Meeting', icon: Meeting, color: typeColor.meeting }, { id: 'task', label: 'Task', icon: Task, color: typeColor.task }, { id: 'email', label: 'Email', icon: Envelope, color: typeColor.email }]} />
          <div className="ml-auto flex items-center gap-3 text-[13px]"><span className="text-muted-2"><span className="font-semibold text-ink-2">{rows.length}</span> activities</span><Chip tone="warning" dot>Sync inactive</Chip></div>
        </div>
        {view === 'list' && (
          <PillTabs value={period} onChange={setPeriod} tabs={[{ id: 'todo', label: 'To-do' }, { id: 'overdue', label: 'Overdue' }, { id: 'all', label: 'All' }]} />
        )}
      </div>

      {view === 'list' ? (
        <main className="flex-1 overflow-y-auto p-7">
          <Table
            template={template}
            columns={[{ key: 'done', header: 'Done' }, { key: 'subject', header: 'Subject' }, { key: 'deal', header: 'Deal' }, { key: 'prio', header: 'Priority' }, { key: 'contact', header: 'Contact' }, { key: 'due', header: 'Due' }]}
            footer={<span>{rows.length} activities</span>}
          >
            {rows.map((r) => {
              const Icon = typeIcon[r.type] ?? Task
              const overdue = (r.due ?? '').includes('overdue')
              return (
                <Row key={r.id} template={template} onClick={() => r.dealId && nav(`/deals/${r.dealId}`)}>
                  <Cell>
                    <button onClick={(e) => { e.stopPropagation(); act.toggleActivity(r.id) }} className="w-[18px] h-[18px] rounded-full border flex items-center justify-center transition-colors" style={{ borderColor: r.done ? '#0E7C66' : '#C3CBD8', background: r.done ? '#0E7C66' : 'transparent' }}>
                      {r.done && <Check size={11} className="text-white" strokeWidth={2.6} />}
                    </button>
                  </Cell>
                  <Cell><div className="flex items-center gap-2.5"><span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: typeWash[r.type], color: typeColor[r.type] }}><Icon size={13} /></span><span className={'font-medium ' + (r.done ? 'text-muted-3 line-through' : 'text-ink-2')}>{r.subject}</span></div></Cell>
                  <Cell muted>{dealName(r.dealId)}</Cell>
                  <Cell>{r.priority ? <Chip tone={prioTone[r.priority]}>{r.priority}</Chip> : <span className="text-muted-3">—</span>}</Cell>
                  <Cell muted>{personName(r.personId)}</Cell>
                  <Cell><span className={overdue ? 'text-warning font-semibold' : 'text-muted'}>{r.due ?? (r.done ? 'Done' : '—')}</span></Cell>
                </Row>
              )
            })}
          </Table>
        </main>
      ) : (
        <main className="flex-1 overflow-auto">
          <div className="min-w-[840px]">
            <div className="grid sticky top-0 bg-surface z-10 border-b border-border" style={{ gridTemplateColumns: `56px repeat(7,1fr)` }}>
              <div />
              {days.map((d) => (<div key={d.d} className={'h-14 flex flex-col items-center justify-center border-l border-divider ' + (d.today ? 'bg-[#EEF4FE]' : '')}><span className="text-[11px] uppercase tracking-wide text-muted-2">{d.d}</span><span className={'text-[15px] font-bold ' + (d.today ? 'text-accent' : 'text-ink-2')}>{d.n}</span></div>))}
            </div>
            <div className="grid relative" style={{ gridTemplateColumns: `56px repeat(7,1fr)` }}>
              <div>{hours.map((h) => (<div key={h} className="text-[11px] text-muted-3 text-right pr-2 -mt-1.5" style={{ height: HOUR }}>{String(h).padStart(2, '0')}:00</div>))}</div>
              {days.map((d, di) => (
                <div key={d.d} className={'relative border-l border-divider ' + (d.today ? 'bg-[#EEF4FE]/40' : '')} style={{ height: hours.length * HOUR }}>
                  {hours.map((h) => (<div key={h} className="border-b border-divider" style={{ height: HOUR }} />))}
                  {calEvents.filter((e) => e.day === di).map((e, ei) => (
                    <div key={ei} className="absolute left-1 right-1 rounded-md px-2 py-1.5 overflow-hidden" style={{ top: (e.start - 8) * HOUR + 2, height: e.dur * HOUR - 4, background: typeWash[e.type], borderLeft: `3px solid ${typeColor[e.type]}` }}>
                      <div className="text-[12px] font-semibold text-ink-2 truncate">{e.title}</div><div className="text-[11px] text-muted-2 truncate">{e.sub}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      <NewActivityModal open={showNew} onClose={() => setShowNew(false)} deals={deals} onCreate={(a) => { act.logActivity(a, 'Activity created'); setShowNew(false) }} />
    </>
  )
}

function NewActivityModal({ open, onClose, deals, onCreate }: { open: boolean; onClose: () => void; deals: { id: string; name: string; personIds: string[] }[]; onCreate: (a: Partial<Activity> & { type: ActivityType; subject: string }) => void }) {
  const [type, setType] = useState<ActivityType>('task')
  const [subject, setSubject] = useState('')
  const [dealId, setDealId] = useState('')
  const [due, setDue] = useState('Today')
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium')
  return (
    <Modal open={open} onClose={onClose} title="New activity" subtitle="Schedule a call, task, meeting or email" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => subject.trim() && onCreate({ type, subject, dealId: dealId || undefined, personId: deals.find((d) => d.id === dealId)?.personIds[0], due, priority })}>Create</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value as ActivityType)}>{['task', 'call', 'meeting', 'email'].map((t) => (<option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>))}</Select></Field>
        <Field label="Priority"><Select value={priority} onChange={(e) => setPriority(e.target.value as any)}>{['High', 'Medium', 'Low'].map((p) => (<option key={p}>{p}</option>))}</Select></Field>
      </div>
      <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What needs doing?" autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Deal"><Select value={dealId} onChange={(e) => setDealId(e.target.value)}><option value="">None</option>{deals.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}</Select></Field>
        <Field label="Due"><Input value={due} onChange={(e) => setDue(e.target.value)} placeholder="Today / Tomorrow…" /></Field>
      </div>
    </Modal>
  )
}
