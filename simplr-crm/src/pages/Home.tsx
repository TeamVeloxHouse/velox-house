import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button } from '../components/ui'
import { Plus, Search, Sparkle, ChevronDown, Check } from '../components/icons'
import { useState_, useSelectors, useActions } from '../store/store'
import { money, classNames } from '../lib/format'
import { RoleDashboard } from '../components/RoleDashboards'
import { ROLES, roleByKey } from '../lib/roles'
import { YOU_MEMBER_ID, type UserRole, type Activity } from '../store/types'
import { isTask, bucketOf, isYesterday, fmtMins } from '../lib/tasks'

export function Home() {
  const nav = useNavigate()
  const { deals, currentRole } = useState_()
  const sel = useSelectors()
  const act = useActions()
  const role = roleByKey(currentRole)

  const open = deals.filter((d) => !d.won && !d.lost)
  const openValue = open.reduce((s, d) => s + d.value, 0)
  const tasks = sel.openTasks()

  // AI brief tailored to the role being viewed
  const brief: Record<UserRole, string> = {
    owner: `The business has ${open.length} live deals worth ${money(openValue, { compact: true })} and installs running across delivery. Cash outstanding needs a chase — I’ve flagged the overdue invoices.`,
    finance: `You have outstanding invoices awaiting payment, one overdue. Deposits are collected on all active installs. I’ve prepped the overdue chase-ups for your approval.`,
    operations: `Your crews are booked across the week with installs and surveys. There’s an unscheduled backlog I can auto-assign, and one callback to slot in.`,
    sales: `You have ${tasks.length} open tasks and ${open.length} live deals worth ${money(openValue, { compact: true })}. Cirrus Hosting has a legal call at 16:00 — talking points prepped. I triaged ${sel.unreadCount()} emails overnight.`,
    marketing: `Leads are coming in across several sources with campaigns live. Reply rates are holding. I’ve drafted this week’s follow-ups to everyone who opened but didn’t reply.`,
    engineer: `You have jobs booked this week including installs and surveys. I’ve pulled the site notes and survey checklist for each onto your job cards.`,
  }

  return (
    <>
      <TopBar
        title="Home"
        center={
          <button onClick={() => window.dispatchEvent(new CustomEvent('simplr-open-palette'))} className="min-w-[280px] max-w-[420px] h-[38px] border border-border rounded-control flex items-center gap-2.5 px-3 text-muted-3 text-[14px] hover:border-border-blue hover:bg-surface-tint transition-colors">
            <Search size={16} /> Search deals, people, companies
            <kbd className="ml-auto text-[11px] font-semibold text-muted-3 bg-control px-1.5 py-0.5 rounded">⌘K</kbd>
          </button>
        }
        actions={<><Button>This quarter</Button><Button variant="primary" icon={<Plus size={16} />} onClick={() => nav('/deals')}>New deal</Button></>}
      />
      <PageBody>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[24px] font-bold text-ink tracking-[-0.02em]">Good morning, Jordan</div>
            <div className="text-[14px] text-muted-b mt-1">As {role.label} — {role.short}.</div>
          </div>
          <RoleSwitch role={currentRole} onChange={(r) => act.setRole(r, true)} />
        </div>

        {/* AI daily brief (role-aware) */}
        <div className="rounded-card bg-deep-panel p-4 flex items-start gap-3.5">
          <span className="w-9 h-9 rounded-[10px] bg-white/10 text-white flex items-center justify-center shrink-0"><Sparkle size={18} /></span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2"><span className="text-[13px] font-semibold text-white">Your morning brief</span><span className="eyebrow text-[9px] bg-white/15 text-white rounded px-1.5 py-0.5">AI</span></div>
            <div className="text-[13px] leading-relaxed mt-1" style={{ color: '#A7E6DA' }}>{brief[currentRole]}</div>
          </div>
          <button onClick={() => nav('/ai')} className="shrink-0 h-8 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[12.5px] font-semibold flex items-center gap-1.5 transition-colors"><Sparkle size={14} /> Open TellOvi AI</button>
        </div>

        {/* today's tasks — your daily to-do, straight on the dashboard */}
        <TodayTasks />

        {/* the role's dashboard */}
        <RoleDashboard role={currentRole} />
      </PageBody>
    </>
  )
}

function TodayTasks() {
  const nav = useNavigate()
  const { activities } = useState_()
  const act = useActions()
  const mine = (a: Activity) => (a.assigneeIds?.length ? a.assigneeIds.includes(YOU_MEMBER_ID) : a.who === 'Jordan Miles')
  const tasks = activities.filter(isTask).filter(mine)
  const today = tasks.filter((a) => !a.done && ['overdue', 'today'].includes(bucketOf(a))).sort((a, b) => (a.priority === 'High' ? -1 : 1))
  const yesterday = tasks.filter(isYesterday)
  const yDone = yesterday.filter((a) => a.done).length
  const mins = today.reduce((s, a) => s + (a.estimateMins ?? 0), 0)

  return (
    <div className="bg-surface border border-border rounded-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-divider">
        <Check size={16} className="text-accent" />
        <span className="text-[14px] font-semibold text-ink">Today’s tasks</span>
        {mins > 0 && <span className="text-[12px] text-muted-2">· {fmtMins(mins)} planned</span>}
        <button onClick={() => nav('/tasks')} className="ml-auto text-[12.5px] text-accent font-semibold">Open My Tasks →</button>
      </div>
      {today.length === 0 ? (
        <div className="px-5 py-6 text-[13px] text-muted-b text-center">Nothing due today. {yDone > 0 ? `You cleared ${yDone} yesterday.` : ''} <button onClick={() => nav('/tasks')} className="text-accent font-medium">Add a task</button>.</div>
      ) : (
        <div className="divide-y divide-divider">
          {today.slice(0, 6).map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-tint cursor-pointer" onClick={() => nav('/tasks')}>
              <button onClick={(e) => { e.stopPropagation(); act.toggleActivity(a.id) }} className="w-[18px] h-[18px] rounded-full border flex items-center justify-center shrink-0" style={{ borderColor: '#C3CBD8' }}>
                {a.done && <Check size={11} className="text-positive" />}
              </button>
              <span className="text-[13px] text-ink-2 font-medium truncate flex-1">{a.subject}</span>
              {a.priority === 'High' && <span className="text-[11px] font-semibold text-negative">High</span>}
              {a.estimateMins ? <span className="text-[11.5px] text-muted-2 tabular-nums">{fmtMins(a.estimateMins)}</span> : null}
              {bucketOf(a) === 'overdue' && <span className="text-[11px] font-semibold text-warning">Overdue</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RoleSwitch({ role, onChange }: { role: UserRole; onChange: (r: UserRole) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = roleByKey(role)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="h-9 flex items-center gap-2 rounded-control border border-border bg-surface px-3 text-[13px] hover:border-border-blue transition-colors">
        <span className="w-2 h-2 rounded-full" style={{ background: current.accent }} />
        <span className="text-muted-2">Viewing as</span>
        <span className="font-semibold text-ink-2">{current.label}</span>
        <ChevronDown size={15} className="text-muted-3" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[280px] bg-surface rounded-overlay shadow-modal border border-border overflow-hidden">
          <div className="px-3 py-2 eyebrow text-muted-3 border-b border-divider">Preview any role’s dashboard</div>
          {ROLES.map((r) => (
            <button key={r.key} onClick={() => { onChange(r.key); setOpen(false) }} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-control border-b border-divider last:border-0">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[12px] font-bold shrink-0" style={{ background: r.accent }}>{r.label[0]}</span>
              <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-ink-2">{r.label}</span><span className="block text-[12px] text-muted-2 truncate">{r.blurb}</span></span>
              {r.key === role && <Check size={15} className="text-accent shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
