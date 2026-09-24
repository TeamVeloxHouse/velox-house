import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Sparkle, Envelope, Task, Check } from './icons'
import { useState_ } from '../store/store'
import { classNames } from '../lib/format'

type Notif = { id: string; icon: any; title: string; sub: string; when: number; to: string; accent?: boolean }

function rel(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export function NotificationsBell() {
  const nav = useNavigate()
  const { agentRuns, emails, activities } = useState_()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [])

  const pending = agentRuns.filter((r) => r.status === 'pending')
  const items: Notif[] = [
    ...pending.map((r) => ({ id: r.id, icon: Sparkle, title: r.title, sub: `${r.agent} · needs review`, when: r.when, to: '/agents', accent: true })),
    ...emails.filter((e) => e.folder === 'inbox' && e.unread).slice(0, 3).map((e) => ({ id: e.id, icon: Envelope, title: `New email from ${e.from}`, sub: e.subject, when: e.createdAt, to: '/inbox' })),
    ...activities.filter((a) => !a.done && (a.due ?? '').includes('overdue')).slice(0, 3).map((a) => ({ id: a.id, icon: Task, title: 'Overdue task', sub: a.subject, when: a.createdAt, to: '/activities' })),
  ].sort((a, b) => b.when - a.when)

  const count = pending.length + emails.filter((e) => e.folder === 'inbox' && e.unread).length

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="w-9 h-9 rounded-[10px] bg-white/60 backdrop-blur border border-white/80 shadow-[0_1px_2px_rgba(10,59,52,0.08)] flex items-center justify-center text-[#2F5A50] hover:bg-white hover:text-accent-700 transition-colors relative" title="Notifications">
        <Bell size={17} />
        {count > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-negative text-white text-[10px] font-bold flex items-center justify-center">{count}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-[340px] bg-surface border border-border rounded-overlay shadow-modal z-[90] overflow-hidden">
          <div className="px-4 py-3 border-b border-divider flex items-center justify-between">
            <span className="text-[14px] font-bold text-ink">Notifications</span>
            <span className="text-[12px] text-accent font-semibold">{count} new</span>
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {items.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-muted-2"><Check size={22} className="text-positive mx-auto mb-1.5" />You’re all caught up.</div>}
            {items.map((n) => (
              <button key={n.id} onClick={() => { nav(n.to); setOpen(false) }} className="w-full flex items-start gap-3 px-4 py-3 text-left border-b border-divider-row last:border-0 hover:bg-[#F7F9FC]">
                <span className={classNames('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', n.accent ? 'bg-accent-gradient text-white' : 'bg-accent-wash text-accent')}><n.icon size={15} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-ink-2 truncate">{n.title}</span>
                  <span className="block text-[12px] text-muted-2 truncate">{n.sub}</span>
                </span>
                <span className="text-[11px] text-muted-3 shrink-0">{rel(n.when)}</span>
              </button>
            ))}
          </div>
          <button onClick={() => { nav('/agents'); setOpen(false) }} className="w-full py-2.5 text-[13px] text-accent font-semibold border-t border-divider hover:bg-accent-wash transition-colors">Open agent inbox</button>
        </div>
      )}
    </div>
  )
}
