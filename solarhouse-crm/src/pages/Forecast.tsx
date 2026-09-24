import { useState } from 'react'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Kpi, Chip, type ChipTone } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Lock, Sparkle } from '../components/icons'
import { useState_, useActions } from '../store/store'
import { money, classNames } from '../lib/format'
import { stages } from '../data/mock'
import type { Deal, UserRole } from '../store/types'
import { Dropdown } from '../components/Dropdown'

// Only Finance and Directors see the revenue forecast.
const ALLOWED: UserRole[] = ['owner', 'finance']
const ROLE_LABEL: Record<UserRole, string> = { owner: 'Director / Owner', finance: 'Finance', sales: 'Sales', operations: 'Operations', marketing: 'Marketing', engineer: 'Engineer' }
const QUOTA = 1_100_000

type Cat = 'Closed' | 'Commit' | 'Best case' | 'Pipeline'
const CATS: Cat[] = ['Closed', 'Commit', 'Best case', 'Pipeline']
const catTone: Record<Cat, ChipTone> = { Closed: 'positive', Commit: 'positive', 'Best case': 'accent', Pipeline: 'warning' }
const catBar: Record<Cat, string> = { Closed: '#0E7C66', Commit: '#13927B', 'Best case': '#57C9B4', Pipeline: '#C79A3A' }

const proposalIdx = stages.indexOf('Proposal Made')
// A deal is "quoted" once a proposal has gone out (Proposal Made or later).
const isQuoted = (d: Deal) => (d.quoted ?? false) || stages.indexOf(d.stage) >= proposalIdx
function categoryFor(d: Deal): Cat {
  if (d.won) return 'Closed'
  if (isQuoted(d) && d.probability >= 60) return 'Commit'
  if (d.probability >= 40) return 'Best case'
  return 'Pipeline'
}

export function Forecast() {
  const { deals, currentRole } = useState_()
  const act = useActions()
  const allowed = ALLOWED.includes(currentRole)

  const roleSwitch = (
    <label className="flex items-center gap-2 text-[12.5px] text-muted-b">
      <span className="hidden sm:inline">Viewing as</span>
      <Dropdown value={currentRole} onChange={(e) => act.setRole(e.target.value as UserRole)} className="h-8 px-2.5 rounded-control border border-input-border bg-white text-[12.5px] text-ink-2 outline-none focus:border-accent">
        {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (<option key={r} value={r}>{ROLE_LABEL[r]}</option>))}
      </Dropdown>
    </label>
  )

  if (!allowed) {
    return (
      <>
        <TopBar title="Forecast" actions={roleSwitch} />
        <PageBody>
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-16">
            <span className="w-14 h-14 rounded-full bg-control text-muted-2 flex items-center justify-center"><Lock size={26} /></span>
            <div className="text-[18px] font-semibold text-ink-2">Forecast is limited to Finance &amp; Directors</div>
            <div className="text-[13px] text-muted-b max-w-[42ch]">Revenue forecasts include commercially sensitive numbers, so they’re only visible to Finance and Director roles. You’re viewing as <span className="font-semibold text-ink-3">{ROLE_LABEL[currentRole]}</span>.</div>
            <div className="mt-1">{roleSwitch}</div>
          </div>
        </PageBody>
      </>
    )
  }

  const rows = deals.filter((d) => !d.lost).map((d) => ({ ...d, category: categoryFor(d), quoted: isQuoted(d) })).sort((a, b) => b.value - a.value)
  const totalOf = (c: Cat) => rows.filter((r) => r.category === c).reduce((s, r) => s + r.value, 0)
  const closed = totalOf('Closed')
  const commit = totalOf('Commit')
  const bestCase = totalOf('Best case')
  const pipeline = totalOf('Pipeline')
  const openRows = rows.filter((r) => !r.won)
  const weighted = Math.round(openRows.reduce((s, d) => s + d.value * (d.probability / 100), 0))
  // Commit forecast = confirmed (closed) + high-confidence quoted (commit)
  const committed = closed + commit
  const coverage = Math.round((committed / QUOTA) * 100)
  const gap = Math.max(0, QUOTA - committed)

  // Real risk-to-commit: commit/best-case deals whose health or blockers threaten them.
  const atRisk = openRows.filter((d) => (d.category === 'Commit' || d.category === 'Best case') && (d.health !== 'Healthy' || d.chips.some((c) => /redline|budget|legal|risk/i.test(c.label))))
    .sort((a, b) => b.value - a.value).slice(0, 4)

  return (
    <>
      <TopBar title="Forecast" crumbs={['Finance & Directors']} actions={roleSwitch} />
      <PageBody>
        <div className="grid grid-cols-4 gap-4">
          <Kpi variant="deep" label="Closed / won" value={money(closed, { compact: true })} delta="Confirmed revenue" />
          <Kpi variant="blue" label="Commit forecast" value={money(committed, { compact: true })} delta={`${coverage}% of £${(QUOTA / 1e6).toFixed(1)}M quota`} deltaTone={coverage >= 100 ? 'positive' : 'muted'} />
          <Kpi label="Best case" value={money(committed + bestCase, { compact: true })} delta={`+${money(bestCase, { compact: true })} upside`} deltaTone="muted" />
          <Kpi label="Gap to quota" value={money(gap, { compact: true })} delta={gap === 0 ? 'Quota covered 🎉' : 'On commit'} deltaTone={gap === 0 ? 'positive' : 'negative'} />
        </div>

        {/* how the forecast is built */}
        <div className="bg-surface border border-border rounded-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[15px] font-semibold text-ink">Forecast build-up</div>
            <span className="text-[12px] text-muted-2">Quota £{(QUOTA / 1e6).toFixed(1)}M · weighted pipeline {money(weighted, { compact: true })}</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden flex bg-control">
            {CATS.map((c) => { const v = totalOf(c); const pct = (v / (closed + commit + bestCase + pipeline || 1)) * 100; return <div key={c} title={`${c}: ${money(v)}`} style={{ width: `${pct}%`, background: catBar[c] }} /> })}
          </div>
          <div className="grid grid-cols-4 gap-3 mt-4">
            {CATS.map((c) => {
              const list = rows.filter((r) => r.category === c)
              return (
                <div key={c} className="rounded-card border border-border p-3">
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: catBar[c] }} /><span className="text-[12px] font-semibold text-ink-3">{c}</span></div>
                  <div className="text-[19px] font-bold text-ink mt-1">{money(totalOf(c), { compact: true })}</div>
                  <div className="text-[11.5px] text-muted-2">{list.length} deal{list.length === 1 ? '' : 's'}{c === 'Commit' ? ' · quoted, ≥60%' : c === 'Best case' ? ' · ≥40%' : c === 'Pipeline' ? ' · early' : ' · won'}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 320px' }}>
          <div className="flex flex-col gap-2.5">
            <div className="text-[15px] font-semibold text-ink">Forecast by deal</div>
            <Table
              template="1.9fr 1fr 1.1fr 0.8fr 0.7fr 0.9fr"
              columns={[
                { key: 'deal', header: 'Deal' },
                { key: 'value', header: 'Value', align: 'right' },
                { key: 'cat', header: 'Category' },
                { key: 'quoted', header: 'Quoted' },
                { key: 'prob', header: 'Conf.', align: 'right' },
                { key: 'wtd', header: 'Weighted', align: 'right' },
              ]}
              footer={<><span>{rows.length} deals · commit {money(committed, { compact: true })}</span><span>Live from pipeline</span></>}
            >
              {rows.map((d) => (
                <Row key={d.id} template="1.9fr 1fr 1.1fr 0.8fr 0.7fr 0.9fr">
                  <Cell><div className="font-semibold text-ink-2 truncate">{d.name}</div><div className="text-[12px] text-muted-2">{d.org}</div></Cell>
                  <Cell align="right" className="font-semibold text-ink-2">{money(d.value)}</Cell>
                  <Cell><Chip tone={catTone[d.category]}>{d.category}</Chip></Cell>
                  <Cell>{d.won ? <span className="text-[12px] text-positive font-semibold">Won</span> : d.quoted ? <span className="text-[12px] text-accent font-semibold">Quoted</span> : <span className="text-[12px] text-muted-3">—</span>}</Cell>
                  <Cell align="right" muted>{d.won ? '100%' : `${d.probability}%`}</Cell>
                  <Cell align="right" className="font-medium text-ink-3">{money(Math.round(d.value * (d.won ? 1 : d.probability / 100)), { compact: true })}</Cell>
                </Row>
              ))}
            </Table>
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-surface border border-border rounded-card p-5">
              <div className="text-[15px] font-semibold text-ink mb-1">Quota coverage</div>
              <div className="text-[12px] text-muted-2 mb-3">Closed + Commit against £{(QUOTA / 1e6).toFixed(1)}M</div>
              <div className="h-2.5 rounded-full bg-control overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, coverage)}%`, background: coverage >= 100 ? '#0E7C66' : '#13927B' }} /></div>
              <div className="flex items-center justify-between mt-2 text-[12.5px]"><span className="text-muted-b">{coverage}% covered</span><span className="font-semibold text-ink-2">{money(committed, { compact: true })} / {money(QUOTA, { compact: true })}</span></div>
            </div>

            <div className="bg-surface border border-border rounded-card p-5">
              <div className="flex items-center gap-2 text-[15px] font-semibold text-ink mb-3"><Sparkle size={15} className="text-accent" /> Risk to commit</div>
              {atRisk.length === 0 ? (
                <div className="text-[13px] text-muted-2">No commit or best-case deals are flagged at risk. Clean forecast.</div>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {atRisk.map((d) => (
                    <li key={d.id} className="flex items-start gap-2 text-[13px] text-ink-3 leading-snug">
                      <span className={classNames('mt-1.5 w-1.5 h-1.5 rounded-full shrink-0', d.health === 'Stalled' ? 'bg-negative' : 'bg-warning')} />
                      <span><span className="font-semibold text-ink-2">{d.org}</span> ({money(d.value, { compact: true })}) — {d.chips.find((c) => /redline|budget|legal|risk/i.test(c.label))?.label ?? d.health}.</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </PageBody>
    </>
  )
}
