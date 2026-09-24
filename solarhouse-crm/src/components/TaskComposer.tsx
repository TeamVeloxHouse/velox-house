import { useEffect, useRef, useState } from 'react'
import { Modal, Field, Input, Textarea, Select } from './overlays'
import { Button, Chip } from './ui'
import { Plus, Check, Clock, File as FileIcon, Sparkle, Task, Phone, Meeting, Envelope } from './icons'
import { useState_, useActions } from '../store/store'
import type { Activity, ActivityType, SubTask, TaskFile, ID } from '../store/types'
import { ESTIMATES, oviSubtasks, todayISO, addDaysISO, fmtMins } from '../lib/tasks'
import { classNames } from '../lib/format'

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
const TYPES: { id: ActivityType; label: string; icon: any }[] = [
  { id: 'task', label: 'Task', icon: Task },
  { id: 'call', label: 'Call', icon: Phone },
  { id: 'meeting', label: 'Meeting', icon: Meeting },
  { id: 'email', label: 'Email', icon: Envelope },
]

function humanDue(iso: string): string {
  if (!iso) return ''
  const t = todayISO()
  if (iso === t) return 'Today'
  if (iso === addDaysISO(t, 1)) return 'Tomorrow'
  if (iso < t) return 'Overdue'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function TaskComposer({
  open, onClose, editId, defaults,
}: {
  open: boolean
  onClose: () => void
  editId?: ID
  defaults?: Partial<Activity>
}) {
  const { activities, deals, people, teamMembers } = useState_()
  const act = useActions()
  const fileRef = useRef<HTMLInputElement>(null)
  const existing = editId ? activities.find((a) => a.id === editId) : undefined

  const [type, setType] = useState<ActivityType>('task')
  const [subject, setSubject] = useState('')
  const [detail, setDetail] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium')
  const [estimate, setEstimate] = useState<number>(30)
  const [assignees, setAssignees] = useState<ID[]>([])
  const [dealId, setDealId] = useState('')
  const [subs, setSubs] = useState<SubTask[]>([])
  const [files, setFiles] = useState<TaskFile[]>([])
  const [subDraft, setSubDraft] = useState('')
  const [oviThinking, setOviThinking] = useState(false)

  // (re)seed the form whenever it opens or the target changes
  useEffect(() => {
    if (!open) return
    const src = existing ?? defaults ?? {}
    setType((src.type as ActivityType) ?? 'task')
    setSubject(src.subject ?? '')
    setDetail(src.body ?? '')
    setDueDate(src.dueDate ?? (src.due ? '' : ''))
    setPriority(src.priority ?? 'Medium')
    setEstimate(src.estimateMins ?? 30)
    setAssignees(src.assigneeIds ?? [])
    setDealId(src.dealId ?? '')
    setSubs(src.subtasks ?? [])
    setFiles(src.files ?? [])
    setSubDraft('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId])

  const toggleAssignee = (id: ID) => setAssignees((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))
  const addSub = () => { if (subDraft.trim()) { setSubs((s) => [...s, { id: uid('sub'), label: subDraft.trim(), done: false }]); setSubDraft('') } }
  const askOvi = () => {
    if (!subject.trim()) return
    setOviThinking(true)
    setTimeout(() => {
      const { subs: generated, detail: d } = oviSubtasks(subject)
      setSubs((cur) => [...cur, ...generated.filter((g) => !cur.some((c) => c.label === g)).map((label) => ({ id: uid('sub'), label, done: false }))])
      if (!detail.trim()) setDetail(d)
      setOviThinking(false)
    }, 650)
  }
  const onFiles = (list: FileList | null) => {
    if (!list) return
    const added: TaskFile[] = Array.from(list).map((f) => ({ id: uid('f'), name: f.name, kind: f.type || undefined, size: f.size }))
    setFiles((cur) => [...cur, ...added])
  }

  function save() {
    if (!subject.trim()) return
    const linkedPerson = deals.find((d) => d.id === dealId)?.personIds[0]
    const patch: Partial<Activity> = {
      type, subject: subject.trim(), body: detail.trim() || undefined,
      dueDate: dueDate || undefined, due: dueDate ? humanDue(dueDate) : existing?.due,
      priority, estimateMins: estimate,
      assigneeIds: assignees.length ? assignees : undefined,
      dealId: dealId || undefined, personId: linkedPerson,
      subtasks: subs.length ? subs : undefined,
      files: files.length ? files : undefined,
    }
    if (existing) {
      act.updateActivity(existing.id, patch, 'Task updated')
    } else {
      act.logActivity({ type, subject: patch.subject!, ...patch, done: false }, `Task “${patch.subject}” created`)
    }
    onClose()
  }

  const totalSubs = subs.length
  const doneSubs = subs.filter((s) => s.done).length

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={640}
      title={existing ? 'Edit task' : 'New task'}
      subtitle="Assign it, time-box it, add context — or let Ovi break it down"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{existing ? 'Save changes' : 'Create task'}</Button></>}
    >
      {/* type */}
      <div className="inline-flex bg-control rounded-control p-[3px] gap-0.5 self-start">
        {TYPES.map((t) => (
          <button key={t.id} onClick={() => setType(t.id)} className={classNames('h-8 px-3 rounded-[7px] text-[12.5px] font-medium flex items-center gap-1.5 transition-colors', type === t.id ? 'bg-white text-accent shadow-[0_1px_2px_rgba(11,18,32,0.08)]' : 'text-muted-b hover:text-ink-3')}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What needs doing?" autoFocus /></Field>

      {/* detail + Ask Ovi */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-ink-3">Detail / context</span>
          <button onClick={askOvi} disabled={oviThinking} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-accent-wash text-accent text-[12px] font-semibold hover:bg-[#E4ECFB] transition-colors disabled:opacity-60">
            <Sparkle size={13} /> {oviThinking ? 'Ovi is thinking…' : 'Ask Ovi'}
          </button>
        </div>
        <Textarea rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Add context, links, what 'done' looks like…" />
      </div>

      {/* date / priority / time */}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Due date">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Priority"><Select value={priority} onChange={(e) => setPriority(e.target.value as any)}>{['High', 'Medium', 'Low'].map((p) => (<option key={p}>{p}</option>))}</Select></Field>
        <Field label="Time estimate">
          <Select value={estimate} onChange={(e) => setEstimate(Number(e.target.value))}>{ESTIMATES.map((x) => (<option key={x.m} value={x.m}>{x.l}</option>))}</Select>
        </Field>
      </div>
      <div className="flex items-center gap-1.5 -mt-1">
        {[['Today', todayISO()], ['Tomorrow', addDaysISO(todayISO(), 1)], ['In 3 days', addDaysISO(todayISO(), 3)], ['Next week', addDaysISO(todayISO(), 7)]].map(([label, iso]) => (
          <button key={label} onClick={() => setDueDate(iso)} className={classNames('h-7 px-2.5 rounded-lg text-[12px] font-medium border transition-colors', dueDate === iso ? 'bg-accent text-white border-accent' : 'border-border text-muted-b hover:bg-control')}>{label}</button>
        ))}
      </div>

      {/* assignees */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-ink-3">Assign to <span className="text-muted-3 font-normal">· shared task if more than one</span></span>
        <div className="flex flex-wrap gap-1.5">
          {teamMembers.map((m) => {
            const on = assignees.includes(m.id)
            return (
              <button key={m.id} onClick={() => toggleAssignee(m.id)} className={classNames('flex items-center gap-1.5 h-8 pl-1 pr-2.5 rounded-full border transition-colors', on ? 'border-accent bg-accent-wash' : 'border-border hover:bg-control')}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: m.color }}>{m.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                <span className={classNames('text-[12.5px] font-medium', on ? 'text-accent' : 'text-ink-3')}>{m.you ? 'Me' : m.name.split(' ')[0]}</span>
                {on && <Check size={13} className="text-accent" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* link to deal */}
      <Field label="Link to deal (optional)">
        <Select value={dealId} onChange={(e) => setDealId(e.target.value)}>
          <option value="">None</option>
          {deals.filter((d) => !d.lost).map((d) => (<option key={d.id} value={d.id}>{d.name} · {d.org}</option>))}
        </Select>
      </Field>

      {/* subtasks */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-ink-3">Checklist {totalSubs > 0 && <span className="text-muted-3 font-normal">· {doneSubs}/{totalSubs}</span>}</span>
        </div>
        {subs.length > 0 && (
          <div className="flex flex-col gap-1">
            {subs.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5 group">
                <button onClick={() => setSubs((cur) => cur.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))} className="w-[17px] h-[17px] rounded-[5px] border flex items-center justify-center shrink-0" style={{ borderColor: s.done ? '#0E7C66' : '#C3CBD8', background: s.done ? '#0E7C66' : 'transparent' }}>
                  {s.done && <Check size={11} className="text-white" strokeWidth={2.6} />}
                </button>
                <span className={classNames('text-[13px] flex-1', s.done ? 'text-muted-3 line-through' : 'text-ink-2')}>{s.label}</span>
                <button onClick={() => setSubs((cur) => cur.filter((x) => x.id !== s.id))} className="text-muted-3 hover:text-negative opacity-0 group-hover:opacity-100 text-[16px] leading-none">×</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Input value={subDraft} onChange={(e) => setSubDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub() } }} placeholder="Add a checklist step…" className="h-8" />
          <button onClick={addSub} className="h-8 w-8 rounded-control border border-border text-muted-b hover:text-accent hover:border-accent flex items-center justify-center shrink-0"><Plus size={15} /></button>
        </div>
      </div>

      {/* files */}
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-semibold text-ink-3">Attachments</span>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = '' }} />
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {files.map((f) => (
              <span key={f.id} className="inline-flex items-center gap-1.5 h-7 pl-2 pr-1.5 rounded-lg bg-surface-tint border border-border text-[12px] text-ink-3">
                <FileIcon size={12} className="text-muted-2" /> <span className="max-w-[160px] truncate">{f.name}</span>
                <button onClick={() => setFiles((cur) => cur.filter((x) => x.id !== f.id))} className="text-muted-3 hover:text-negative text-[15px] leading-none">×</button>
              </span>
            ))}
          </div>
        )}
        <button onClick={() => fileRef.current?.click()} className="self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-control border border-dashed border-input-border text-[12.5px] text-muted-b hover:border-accent hover:text-accent transition-colors">
          <FileIcon size={14} /> Attach files
        </button>
      </div>

      {estimate > 0 && (
        <div className="flex items-center gap-1.5 text-[12px] text-muted-2 border-t border-divider pt-2.5">
          <Clock size={13} /> Time-boxed to {fmtMins(estimate)}{assignees.length > 1 ? ` · shared with ${assignees.length}` : ''}
        </div>
      )}
    </Modal>
  )
}
