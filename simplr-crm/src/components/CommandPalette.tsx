import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bars, Person, ArrowUpRight, Building, Bolt } from './icons'
import { Avatar } from './ui'
import { useState_ } from '../store/store'
import { money } from '../lib/format'

type Item = { id: string; group: string; label: string; sub: string; icon: 'deal' | 'person' | 'org' | 'action'; to: string }

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate()
  const { deals, people, orgs } = useState_()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)

  const items = useMemo<Item[]>(() => {
    const dItems: Item[] = deals.filter((d) => !d.lost).map((d) => ({ id: d.id, group: 'Deals', label: d.name, sub: `${d.org} · ${money(d.value, { compact: true })}`, icon: 'deal', to: `/deals/${d.id}` }))
    const pItems: Item[] = people.map((p) => ({ id: p.id, group: 'People', label: p.name, sub: `${p.role} · ${p.org}`, icon: 'person', to: `/people/${p.id}` }))
    const oItems: Item[] = orgs.map((o) => ({ id: o.id, group: 'People', label: o.name, sub: o.industry, icon: 'org', to: '/organisations' }))
    const actions: Item[] = [
      { id: 'a0', group: 'Actions', label: 'Ask TellOvi AI', sub: 'Open your CRM copilot', icon: 'action', to: '/ai' },
      { id: 'a1', group: 'Actions', label: 'Go to pipeline', sub: 'Your deals board', icon: 'action', to: '/deals' },
      { id: 'a2', group: 'Actions', label: 'Add lead', sub: 'Log an inbound lead', icon: 'action', to: '/leads' },
      { id: 'a3', group: 'Actions', label: 'Meetings & notetaker', sub: 'Upcoming and recorded calls', icon: 'action', to: '/meetings' },
    ]
    const all = [...dItems, ...pItems, ...oItems, ...actions]
    if (!q.trim()) return all.slice(0, 8)
    const s = q.toLowerCase()
    return all.filter((i) => i.label.toLowerCase().includes(s) || i.sub.toLowerCase().includes(s)).slice(0, 10)
  }, [q, deals, people, orgs])

  useEffect(() => setActive(0), [q, open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
      if (e.key === 'Enter') { const it = items[active]; if (it) { nav(it.to); onClose() } }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, items, active])

  if (!open) return null

  let lastGroup = ''
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center" style={{ paddingTop: 120 }}>
      <div className="absolute inset-0 bg-[rgba(11,18,32,0.28)] backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-[660px] max-w-[92vw] bg-surface rounded-overlay shadow-modal overflow-hidden">
        <div className="flex items-center gap-3 px-4 h-[54px] border-b border-divider">
          <Search size={18} className="text-muted-3" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search deals, people, actions…"
            className="flex-1 bg-transparent outline-none text-[15px] text-ink placeholder:text-muted-3"
          />
          <kbd className="text-[11px] font-semibold text-muted-2 bg-control px-1.5 py-0.5 rounded">esc</kbd>
        </div>
        <div className="max-h-[360px] overflow-y-auto py-1.5">
          {items.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-muted-2">No matches for “{q}”.</div>}
          {items.map((it, idx) => {
            const showGroup = it.group !== lastGroup
            lastGroup = it.group
            return (
              <div key={it.id}>
                {showGroup && <div className="px-4 pt-2 pb-1 eyebrow text-muted-3">{it.group}</div>}
                <button
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => { nav(it.to); onClose() }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-left"
                  style={{ background: idx === active ? '#F5F7FC' : 'transparent' }}
                >
                  {it.icon === 'person' ? (
                    <Avatar name={it.label} size={28} />
                  ) : (
                    <span className="w-7 h-7 rounded-lg bg-accent-wash text-accent flex items-center justify-center shrink-0">
                      {it.icon === 'deal' ? <Bars size={15} /> : it.icon === 'org' ? <Building size={15} /> : <Bolt size={15} />}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-ink truncate">{it.label}</span>
                    <span className="block text-[12px] text-muted-2 truncate">{it.sub}</span>
                  </span>
                  {idx === active && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-2">
                      <ArrowUpRight size={13} /> open
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 px-4 h-9 border-t border-divider text-[11px] text-muted-2">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span className="ml-auto">⌘K anywhere</span>
        </div>
      </div>
    </div>
  )
}
