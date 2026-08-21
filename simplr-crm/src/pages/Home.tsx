import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Kpi, Chip, Segmented, type ChipTone } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Plus, Search, Check, Sparkle } from '../components/icons'
import { type Health } from '../data/mock'
import { useState_, useSelectors, useActions } from '../store/store'
import { money } from '../lib/format'

const chartData = [
  { m: 'Apr', created: 112, closed: 64 },
  { m: 'May', created: 88, closed: 78 },
  { m: 'Jun', created: 146, closed: 92 },
  { m: 'Jul', created: 104, closed: 120 },
  { m: 'Aug', created: 168, closed: 88 },
  { m: 'Sep', created: 74, closed: 36, current: true },
]

const healthTone: Record<Health, ChipTone> = { Healthy: 'positive', 'At risk': 'warning', Stalled: 'negative', 'No next step': 'warning' }

export function Home() {
  const nav = useNavigate()
  const { deals } = useState_()
  const sel = useSelectors()
  const act = useActions()
  const [scope, setScope] = useState('My deals')

  const open = deals.filter((d) => !d.won && !d.lost)
  const openValue = open.reduce((s, d) => s + d.value, 0)
  const wonValue = deals.filter((d) => d.won).reduce((s, d) => s + d.value, 0)
  const quota = 1_100_000
  const quotaPct = Math.round((wonValue / quota) * 100)
  const expectedPct = 74 // pace target for day of quarter
  const tasks = sel.openTasks().slice(0, 5)
  const closing = open.slice(0, 5)

  return (
    <>
      <TopBar
        title="Home"
        center={
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('simplr-open-palette'))}
            className="min-w-[280px] max-w-[420px] h-[38px] border border-border rounded-control flex items-center gap-2.5 px-3 text-muted-3 text-[14px] hover:border-border-blue hover:bg-surface-tint transition-colors"
          >
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
            <div className="text-[14px] text-muted-b mt-1">You're 68% to quota with 24 days left in Q3.</div>
          </div>
          <Segmented options={['My deals', 'Team']} value={scope} onChange={setScope} />
        </div>

        {/* AI daily brief */}
        <div className="rounded-card bg-deep-panel p-4 flex items-start gap-3.5">
          <span className="w-9 h-9 rounded-[10px] bg-white/10 text-white flex items-center justify-center shrink-0"><Sparkle size={18} /></span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2"><span className="text-[13px] font-semibold text-white">Your morning brief</span><span className="eyebrow text-[9px] bg-white/15 text-white rounded px-1.5 py-0.5">AI</span></div>
            <div className="text-[13px] leading-relaxed mt-1" style={{ color: '#C7D3F2' }}>
              You have <strong className="text-white">{tasks.length} open tasks</strong> and {open.length} live deals worth {money(openValue, { compact: true })}. <strong className="text-white">Cirrus Hosting</strong> has a legal call at 16:00 — I’ve prepped talking points. Overnight I triaged {sel.unreadCount()} emails and drafted replies for your review.
            </div>
          </div>
          <button onClick={() => nav('/ai')} className="shrink-0 h-8 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[12.5px] font-semibold flex items-center gap-1.5 transition-colors"><Sparkle size={14} /> Open Simplr AI</button>
        </div>

        {/* quota pacing */}
        <div className="bg-surface border border-border rounded-card p-5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-[15px] font-semibold text-ink">Q3 quota</div>
            <div className="text-[13px] text-muted-b"><span className="font-bold text-ink-2">{money(wonValue, { compact: true })}</span> of {money(quota, { compact: true })} · <span className={quotaPct >= expectedPct ? 'text-positive font-semibold' : 'text-warning font-semibold'}>{quotaPct >= expectedPct ? 'on pace' : `${expectedPct - quotaPct}pts behind pace`}</span></div>
          </div>
          <div className="relative h-3 rounded-full bg-control overflow-hidden">
            <div className="absolute inset-y-0 left-0 rounded-full bg-accent-gradient" style={{ width: `${Math.min(100, quotaPct)}%` }} />
            <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${expectedPct}%` }} title="Pace target" />
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted-2">
            <span>{quotaPct}% attained</span>
            <span>Pace target {expectedPct}% · 24 days left</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Kpi variant="blue" label="Open pipeline" value={money(openValue, { compact: true })} delta={`${open.length} deals`} deltaTone="muted" />
          <Kpi label="Closed won" value={money(deals.filter((d) => d.won).reduce((s, d) => s + d.value, 0), { compact: true })} delta={`${deals.filter((d) => d.won).length} deals`} />
          <Kpi label="Win rate" value="31%" delta="−2.1 pts" deltaTone="negative" />
          <Kpi variant="deep" label="Open tasks" value={String(sel.openTaskCount())} delta="Across your deals" />
        </div>

        <div className="grid grid-cols-[2fr_1fr] gap-4">
          <div className="bg-surface border border-border rounded-card p-5 flex flex-col">
            <div className="flex justify-between items-center">
              <div className="text-[15px] font-semibold text-ink">Pipeline created vs. closed</div>
              <div className="flex gap-3.5 text-[12px] text-muted-b">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-accent inline-block" />Created</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-accent-300 inline-block" />Closed</span>
              </div>
            </div>
            <div className="flex-1 flex items-end gap-6 pt-6">
              {chartData.map((d) => (
                <div key={d.m} className="flex-1 flex flex-col items-center gap-2">
                  <div className="flex gap-1.5 items-end h-[190px]">
                    <div className="w-[22px] rounded-t" style={{ height: d.created, background: d.current ? '#8FB0FF' : '#1D4ED8' }} />
                    <div className="w-[22px] rounded-t" style={{ height: d.closed, background: d.current ? '#E3E9F7' : '#C7D3F2' }} />
                  </div>
                  <div className="text-[12px] text-muted-2b">{d.m}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-card p-5 flex flex-col gap-3.5">
            <div className="flex justify-between items-center">
              <div className="text-[15px] font-semibold text-ink">Today</div>
              <div className="text-[12px] text-accent font-semibold">{tasks.length} open</div>
            </div>
            <div className="flex flex-col gap-1">
              {tasks.map((t) => (
                <button key={t.id} onClick={() => act.toggleActivity(t.id)} className="flex items-start gap-3 py-2 text-left">
                  <span className="mt-0.5 w-[18px] h-[18px] rounded-[5px] border shrink-0 flex items-center justify-center" style={{ borderColor: t.done ? '#1D4ED8' : '#C3CBD8', background: t.done ? '#1D4ED8' : 'transparent' }}>
                    {t.done && <Check size={12} className="text-white" strokeWidth={2.4} />}
                  </span>
                  <span className="min-w-0">
                    <span className={'block text-[13px] font-medium ' + (t.done ? 'text-muted-3 line-through' : 'text-ink-2')}>{t.subject}</span>
                    <span className="block text-[12px] text-muted-2">{t.due ?? 'No due date'}</span>
                  </span>
                </button>
              ))}
              {tasks.length === 0 && <div className="text-[13px] text-muted-2 py-2">All caught up 🎉</div>}
            </div>
            <button onClick={() => nav('/activities')} className="mt-auto rounded-[10px] bg-accent-wash-3 border border-[#D3E0FA] p-3 text-left hover:bg-[#E1E9FA] transition-colors">
              <div className="text-[12px] font-semibold text-accent-700">View all activities</div>
              <div className="text-[12px] text-ink-3 mt-1 leading-relaxed">{sel.openTaskCount()} open across your pipeline.</div>
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-[15px] font-semibold text-ink">Deals in your pipeline</div>
            <button onClick={() => nav('/deals')} className="text-[13px] text-accent font-semibold">View pipeline</button>
          </div>
          <Table
            template="2.2fr 1fr 1.2fr 1fr 0.9fr"
            columns={[{ key: 'deal', header: 'Deal' }, { key: 'value', header: 'Value', align: 'right' }, { key: 'stage', header: 'Stage' }, { key: 'close', header: 'Close date' }, { key: 'health', header: 'Health' }]}
          >
            {closing.map((d) => (
              <Row key={d.id} template="2.2fr 1fr 1.2fr 1fr 0.9fr" onClick={() => nav(`/deals/${d.id}`)}>
                <Cell><div className="font-semibold text-ink-2 truncate">{d.name}</div><div className="text-[12px] text-muted-2">{d.org}</div></Cell>
                <Cell align="right" className="font-semibold text-ink-2">{money(d.value)}</Cell>
                <Cell><Chip tone="accent">{d.stage}</Chip></Cell>
                <Cell muted>{d.closeDate}</Cell>
                <Cell><Chip tone={healthTone[d.health]} dot>{d.health}</Chip></Cell>
              </Row>
            ))}
          </Table>
        </div>
      </PageBody>
    </>
  )
}
