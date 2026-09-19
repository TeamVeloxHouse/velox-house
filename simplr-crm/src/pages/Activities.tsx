import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Button, Chip } from '../components/ui'
import { ViewSwitch, PillTabs } from '../components/chrome'
import { Table, Row, Cell } from '../components/Table'
import { Modal, Field, Input, Select } from '../components/overlays'
import { Plus, Bars, Calendar, Phone, Meeting, Task, Envelope, Check, Filter, Note } from '../components/icons'
import { useState_, useActions } from '../store/store'
import { CalendarView } from './Calendar'
import { bucketOf, effectiveDueDate, BUCKET_META } from '../lib/tasks'
import type { Activity, ActivityType } from '../store/types'

const typeColor: Record<string, string> = { call: '#13927B', meeting: '#0E7C66', task: '#C2410C', email: '#13927B', note: '#7A8494' }
const typeWash: Record<string, string> = { call: '#EAF6F2', meeting: '#E9F5F1', task: '#FDF1E7', email: '#EAF6F2', note: '#F1F3F7' }
const typeIcon: Record<string, any> = { call: Phone, meeting: Meeting, task: Task, email: Envelope, note: Note }
const prioTone: Record<string, 'negative' | 'warning' | 'neutral'> = { High: 'negative', Medium: 'warning', Low: 'neutral' }

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
    .filter((a) => (period === 'todo' ? !a.done : period === 'overdue' ? bucketOf(a) === 'overdue' : true))
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
              const bucket = bucketOf(r)
              const overdue = bucket === 'overdue'
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
                  <Cell><span className="font-medium" style={{ color: BUCKET_META[bucket].tone }}>{effectiveDueDate(r) ? BUCKET_META[bucket].label : (r.done ? 'Done' : '—')}</span></Cell>
                </Row>
              )
            })}
          </Table>
        </main>
      ) : (
        <CalendarView />
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
