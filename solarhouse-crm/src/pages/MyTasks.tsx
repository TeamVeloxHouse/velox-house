import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Chip } from '../components/ui'
import { PillTabs } from '../components/chrome'
import { Plus, Check, Clock, Sparkle, File as FileIcon, Phone, Meeting, Task as TaskIcon, Envelope, Search } from '../components/icons'
import { TaskComposer } from '../components/TaskComposer'
import { useState_, useActions } from '../store/store'
import { YOU_MEMBER_ID } from '../store/types'
import type { Activity, ID } from '../store/types'
import { isTask, bucketOf, isYesterday, effectiveDueDate, BUCKET_META, fmtMins, type Bucket } from '../lib/tasks'
import { classNames } from '../lib/format'
import { CalendarView } from './Calendar'

const typeIcon: Record<string, any> = { call: Phone, meeting: Meeting, task: TaskIcon, email: Envelope }
const typeColor: Record<string, string> = { call: '#13927B', meeting: '#0E7C66', task: '#C2410C', email: '#13927B' }
const typeWash: Record<string, string> = { call: '#EAF6F2', meeting: '#E9F5F1', task: '#FDF1E7', email: '#EAF6F2' }
const prioTone: Record<string, 'negative' | 'warning' | 'neutral'> = { High: 'negative', Medium: 'warning', Low: 'neutral' }
const ORDER: Bucket[] = ['overdue', 'today', 'tomorrow', 'upcoming', 'none']

export function MyTasks() {
  const nav = useNavigate()
  const { activities, deals, teamMembers } = useState_()
  const act = useActions()
  const [scope, setScope] = useState<ID>(YOU_MEMBER_ID) // whose tasks
  const [when, setWhen] = useState('today') // today | yesterday | all
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('all') // call | meeting | task | email — the old Activities filter
  const [layout, setLayout] = useState<'list' | 'calendar'>('list')
  const [composerOpen, setComposerOpen] = useState(false)
  const [editId, setEditId] = useState<ID | undefined>(undefined)

  const memberById = (id: ID) => teamMembers.find((m) => m.id === id)
  const scopeMember = memberById(scope)
  const scopeMemberYou = memberById(YOU_MEMBER_ID)?.name
  const assignedToScope = (a: Activity) => {
    if (scope === 'all') return true
    if (scope.startsWith('name:')) return a.who === scope.slice(5) // an adviser picked by name
    if (a.assigneeIds?.length) return a.assigneeIds.includes(scope)
    // legacy fallback: match the free-text owner to the member name
    return scopeMember ? a.who === scopeMember.name : false
  }

  const tasks = useMemo(
    () => activities
      .filter(isTask)
      .filter(assignedToScope)
      .filter((a) => kind === 'all' || a.type === kind)
      .filter((a) => !q || a.subject.toLowerCase().includes(q.toLowerCase()) || (a.body ?? '').toLowerCase().includes(q.toLowerCase())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activities, scope, q, kind],
  )

  const yesterday = tasks.filter(isYesterday)
  const openToday = tasks.filter((a) => !a.done && ['overdue', 'today'].includes(bucketOf(a)))
  const todayMins = openToday.reduce((s, a) => s + (a.estimateMins ?? 0), 0)
  const grouped = useMemo(() => {
    const g: Record<Bucket, Activity[]> = { overdue: [], today: [], tomorrow: [], upcoming: [], none: [], done: [] }
    tasks.forEach((a) => g[bucketOf(a)].push(a))
    return g
  }, [tasks])
  const doneToday = tasks.filter((a) => a.done)

  const dealName = (id?: ID) => deals.find((d) => d.id === id)?.name

  function openNew() { setEditId(undefined); setComposerOpen(true) }
  function openEdit(id: ID) { setEditId(id); setComposerOpen(true) }

  function Rowi({ a }: { a: Activity }) {
    const Icon = typeIcon[a.type] ?? TaskIcon
    const b = bucketOf(a)
    const subs = a.subtasks ?? []
    const doneSubs = subs.filter((s) => s.done).length
    const assignees = (a.assigneeIds ?? []).map(memberById).filter(Boolean)
    return (
      <div className="flex items-start gap-3 px-4 py-3 hover:bg-surface-tint transition-colors cursor-pointer group" onClick={() => openEdit(a.id)}>
        <button
          onClick={(e) => { e.stopPropagation(); act.toggleActivity(a.id) }}
          className="mt-0.5 w-[18px] h-[18px] rounded-full border flex items-center justify-center shrink-0 transition-colors"
          style={{ borderColor: a.done ? '#0E7C66' : '#C3CBD8', background: a.done ? '#0E7C66' : 'transparent' }}
        >
          {a.done && <Check size={11} className="text-white" strokeWidth={2.6} />}
        </button>
        <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-px" style={{ background: typeWash[a.type], color: typeColor[a.type] }}><Icon size={13} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={classNames('text-[13.5px] font-medium truncate', a.done ? 'text-muted-3 line-through' : 'text-ink-2')}>{a.subject}</span>
            {a.source === 'ai' || a.source === 'meeting' ? <span title="From Ovi" className="text-accent shrink-0"><Sparkle size={12} /></span> : null}
          </div>
          {a.body && <div className="text-[12px] text-muted-2 truncate mt-0.5">{a.body}</div>}
          <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
            {a.priority && <Chip tone={prioTone[a.priority]}>{a.priority}</Chip>}
            {a.estimateMins ? <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-2"><Clock size={11} /> {fmtMins(a.estimateMins)}</span> : null}
            {subs.length > 0 && <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-2"><Check size={11} /> {doneSubs}/{subs.length}</span>}
            {a.files?.length ? <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-2"><FileIcon size={11} /> {a.files.length}</span> : null}
            {dealName(a.dealId) && <span className="text-[11.5px] text-accent truncate max-w-[160px]" onClick={(e) => { e.stopPropagation(); nav(`/deals/${a.dealId}`) }}>{dealName(a.dealId)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {assignees.length > 0 && (
            <div className="flex -space-x-1.5">
              {assignees.slice(0, 3).map((m) => (
                <span key={m!.id} title={m!.name} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-white" style={{ background: m!.color }}>{m!.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
              ))}
            </div>
          )}
          {when === 'all' && b !== 'none' && <span className="text-[11.5px] font-medium tabular-nums" style={{ color: BUCKET_META[b].tone }}>{a.dueDate ? new Date(a.dueDate + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : a.due}</span>}
        </div>
      </div>
    )
  }

  function Section({ b }: { b: Bucket }) {
    const list = grouped[b]
    if (list.length === 0) return null
    const meta = BUCKET_META[b]
    return (
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-divider">
          <span className="w-2 h-2 rounded-full" style={{ background: meta.tone }} />
          <span className="text-[13px] font-semibold text-ink-2">{meta.label}</span>
          <span className="text-[11px] font-medium text-muted-3 bg-control rounded-full px-1.5 py-0.5">{list.length}</span>
        </div>
        <div className="divide-y divide-divider">{list.map((a) => <Rowi key={a.id} a={a} />)}</div>
      </div>
    )
  }

  return (
    <>
      <TopBar title="My Tasks" actions={<Button variant="primary" icon={<Plus size={16} />} onClick={openNew}>New task</Button>} />

      <div className="shrink-0 bg-surface border-b border-border px-7 py-2.5 flex items-center gap-3 flex-wrap">
        <div className="inline-flex bg-control rounded-control p-[3px] gap-0.5">
          {(['list', 'calendar'] as const).map((l) => <button key={l} onClick={() => setLayout(l)} className={classNames('h-[30px] px-3 rounded-[7px] text-[12.5px] font-semibold capitalize', layout === l ? 'bg-white text-accent shadow-[0_1px_2px_rgba(11,18,32,0.08)]' : 'text-muted-b')}>{l}</button>)}
        </div>
        <PillTabs value={when} onChange={setWhen} tabs={[{ id: 'today', label: 'To-do' }, { id: 'yesterday', label: 'Yesterday' }, { id: 'all', label: 'All' }]} />
        <PillTabs value={kind} onChange={setKind} tabs={[{ id: 'all', label: 'Everything' }, { id: 'call', label: 'Calls', icon: Phone, color: typeColor.call }, { id: 'meeting', label: 'Meetings', icon: Meeting, color: typeColor.meeting }, { id: 'task', label: 'Tasks', icon: TaskIcon, color: typeColor.task }, { id: 'email', label: 'Emails', icon: Envelope, color: typeColor.email }]} />
        <div className="h-9 w-[220px] rounded-control border border-border bg-surface flex items-center gap-2 px-3">
          <Search size={15} className="text-muted-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks" className="bg-transparent outline-none flex-1 text-[13px] text-ink-2 placeholder:text-muted-3" />
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-ink-3">
          <span className="text-muted-2">Whose</span>
          <select value={scope} onChange={(e) => setScope(e.target.value)} className="h-9 px-2.5 rounded-control border border-input-border bg-white text-[13px] outline-none focus:border-accent">
            <option value={YOU_MEMBER_ID}>My tasks</option>
            <option value="all">Everyone</option>
            {[...new Set(activities.map((a) => a.who))].filter((n) => n && n !== 'System' && n !== scopeMemberYou && !n.includes('team')).sort().map((n) => (<option key={n} value={`name:${n}`}>{n}</option>))}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-2 text-[12.5px]">
          <Chip tone="accent" dot>{openToday.length} due today</Chip>
          {todayMins > 0 && <span className="inline-flex items-center gap-1 text-muted-2"><Clock size={13} /> {fmtMins(todayMins)} planned</span>}
        </div>
      </div>

      {layout === 'calendar' ? <CalendarView /> : <PageBody>
        {when === 'yesterday' ? (
          <div className="flex flex-col gap-3">
            <div className="text-[13px] text-muted-b">What {scope === YOU_MEMBER_ID ? 'you' : scope === 'all' ? 'the team' : scopeMember?.name.split(' ')[0]} worked yesterday — {yesterday.filter((a) => a.done).length} done, {yesterday.filter((a) => !a.done).length} rolled over.</div>
            {yesterday.length === 0 ? <Empty label="Nothing tracked for yesterday." /> : (
              <div className="bg-surface border border-border rounded-card overflow-hidden divide-y divide-divider">{yesterday.map((a) => <Rowi key={a.id} a={a} />)}</div>
            )}
          </div>
        ) : when === 'all' ? (
          <div className="flex flex-col gap-3">
            {[...tasks].filter((a) => !a.done).sort((a, b) => (effectiveDueDate(a) ?? '9999').localeCompare(effectiveDueDate(b) ?? '9999')).length === 0 && doneToday.length === 0 ? <Empty label="No tasks yet — create one." /> : (
              <div className="bg-surface border border-border rounded-card overflow-hidden divide-y divide-divider">
                {[...tasks].sort((a, b) => Number(a.done) - Number(b.done) || (effectiveDueDate(a) ?? '9999').localeCompare(effectiveDueDate(b) ?? '9999')).map((a) => <Rowi key={a.id} a={a} />)}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {ORDER.every((b) => grouped[b].length === 0) && doneToday.length === 0 && <Empty label="You're all clear. Create a task to get going." />}
            {ORDER.map((b) => <Section key={b} b={b} />)}
            {doneToday.length > 0 && (
              <details className="bg-surface border border-border rounded-card overflow-hidden">
                <summary className="flex items-center gap-2 px-4 py-2.5 cursor-pointer list-none">
                  <span className="w-2 h-2 rounded-full" style={{ background: BUCKET_META.done.tone }} />
                  <span className="text-[13px] font-semibold text-ink-2">Completed</span>
                  <span className="text-[11px] font-medium text-muted-3 bg-control rounded-full px-1.5 py-0.5">{doneToday.length}</span>
                </summary>
                <div className="divide-y divide-divider border-t border-divider">{doneToday.map((a) => <Rowi key={a.id} a={a} />)}</div>
              </details>
            )}
          </div>
        )}
      </PageBody>}

      <TaskComposer open={composerOpen} onClose={() => setComposerOpen(false)} editId={editId} />
    </>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-16 bg-surface border border-dashed border-border rounded-card">
      <TaskIcon size={30} className="text-muted-3" />
      <div className="text-[14px] text-muted-b">{label}</div>
    </div>
  )
}
