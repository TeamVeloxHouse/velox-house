import { useState } from 'react'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Segmented, Kpi, Chip, type ChipTone } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { useState_, useActions } from '../store/store'
import { money } from '../lib/format'

type Cat = 'Commit' | 'Best case' | 'Pipeline' | 'Closed'
const catTone: Record<Cat, ChipTone> = { Commit: 'positive', 'Best case': 'accent', Pipeline: 'warning', Closed: 'neutral' }

const categoryFor = (d: { won?: boolean; probability: number }): Cat =>
  d.won ? 'Closed' : d.probability >= 80 ? 'Commit' : d.probability >= 50 ? 'Best case' : 'Pipeline'

export function Forecast() {
  const { deals } = useState_()
  const act = useActions()
  const [q, setQ] = useState('Q3 FY26')
  const [owner, setOwner] = useState('All owners')
  const [cat, setCat] = useState('All')
  const template = '2fr 1fr 1.1fr 1fr 1fr'

  const owners = [...new Set(deals.map((d) => d.owner))]
  const rows = deals.filter((d) => !d.lost).map((d) => ({ ...d, category: categoryFor(d) }))
    .filter((d) => owner === 'All owners' || d.owner === owner)
    .filter((d) => cat === 'All' || d.category === cat)
    .sort((a, b) => b.value - a.value)
  const openRows = rows.filter((d) => !d.won)
  const commit = rows.filter((r) => r.category === 'Commit').reduce((s, r) => s + r.value, 0)
  const best = commit + rows.filter((r) => r.category === 'Best case').reduce((s, r) => s + r.value, 0)
  const weighted = Math.round(openRows.reduce((s, d) => s + d.value * (d.probability / 100), 0))
  const activeFilters = (owner !== 'All owners' ? 1 : 0) + (cat !== 'All' ? 1 : 0)
  return (
    <>
      <TopBar
        title="Forecast"
        center={<Segmented options={['Q3 FY26', 'Q4 FY26']} value={q} onChange={setQ} />}
        actions={
          <>
            <Button>Roll-up: Team</Button>
            <Button onClick={() => act.toast('Historical snapshots need stored pipeline history (backend)', 'accent')}>History</Button>
            <Button variant="primary" onClick={() => act.toast('Forecast submitted — snapshot saved')}>Submit forecast</Button>
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-4 gap-4">
          <Kpi variant="deep" label="Commit" value={money(commit, { compact: true })} delta="Quota £1.1M" />
          <Kpi label="Best case" value={money(best, { compact: true })} delta={`+${money(best - commit, { compact: true })} upside`} />
          <Kpi variant="blue" label="Weighted pipeline" value={money(weighted, { compact: true })} delta="prob-weighted" deltaTone="muted" />
          <Kpi label="Gap to quota" value={money(Math.max(0, 1100000 - commit), { compact: true })} delta="Below commit" deltaTone="negative" />
        </div>

        {/* filter bar */}
        <div className="flex items-center gap-2 flex-wrap bg-surface border border-border rounded-card px-3 py-2.5">
          <span className="text-[12px] text-muted-2 mr-1">Filter</span>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className="h-8 px-2.5 rounded-control border border-input-border bg-white text-[12.5px] text-ink-2 outline-none focus:border-accent">
            <option>All owners</option>
            {owners.map((o) => (<option key={o}>{o}</option>))}
          </select>
          <Segmented options={['All', 'Commit', 'Best case', 'Pipeline', 'Closed']} value={cat} onChange={setCat} />
          {activeFilters > 0 && <button onClick={() => { setOwner('All owners'); setCat('All') }} className="ml-auto text-[12.5px] text-accent font-semibold">Clear ({activeFilters})</button>}
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 340px' }}>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="text-[15px] font-semibold text-ink">Forecast by deal</div>
              <span className="text-[12px] text-muted-2">Category set from win probability</span>
            </div>
            <Table
              template={template}
              columns={[
                { key: 'deal', header: 'Deal' },
                { key: 'value', header: 'Value', align: 'right' },
                { key: 'cat', header: 'Category' },
                { key: 'close', header: 'Close' },
                { key: 'prob', header: 'Prob.', align: 'right' },
              ]}
              footer={<><span>{rows.length} deals · {money(best, { compact: true })} best case</span><span>Updated 2h ago</span></>}
            >
              {rows.map((d) => (
                <Row key={d.id} template={template}>
                  <Cell>
                    <div className="font-semibold text-ink-2 truncate">{d.name}</div>
                    <div className="text-[12px] text-muted-2">{d.org}</div>
                  </Cell>
                  <Cell align="right" className="font-semibold text-ink-2">{money(d.value)}</Cell>
                  <Cell><Chip tone={catTone[d.category]}>{d.category}</Chip></Cell>
                  <Cell muted>{d.closeDate}</Cell>
                  <Cell align="right" muted>{d.won ? '100%' : `${d.probability}%`}</Cell>
                </Row>
              ))}
            </Table>
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-surface border border-border rounded-card p-5">
              <div className="text-[15px] font-semibold text-ink mb-3.5">Forecast movement</div>
              <MoveRow label="Last submitted" value="£698K" />
              <MoveRow label="Added" value="+£96K" tone="#0E7C66" />
              <MoveRow label="Slipped" value="−£52K" tone="#C2410C" />
              <div className="border-t border-divider mt-2 pt-2.5 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-ink">This week</span>
                <span className="text-[15px] font-bold text-ink">£742K</span>
              </div>
            </div>
            <div className="bg-surface border border-border rounded-card p-5">
              <div className="text-[15px] font-semibold text-ink mb-3">Risk to commit</div>
              <ul className="flex flex-col gap-2.5 text-[13px] text-ink-3 leading-relaxed">
                <li>· Gale Renewables (£512K) in budget review — could slip to Q4.</li>
                <li>· Cirrus redlines still open with legal.</li>
                <li>· St. Aidan has no next step booked.</li>
              </ul>
            </div>
          </div>
        </div>
      </PageBody>
    </>
  )
}

function MoveRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[13px] text-muted-b">{label}</span>
      <span className="text-[13px] font-semibold" style={{ color: tone ?? '#1B2534' }}>{value}</span>
    </div>
  )
}
