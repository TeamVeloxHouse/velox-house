import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Button, Avatar, Chip, type ChipTone } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Modal, Field, Input, Select } from '../components/overlays'
import { Plus, Bars, Filter, ChevronDown, Grid, Pie, Box } from '../components/icons'
import { ScorePill, RiskBadge } from '../components/ai-widgets'
import { dealScore, dealRisk } from '../lib/intelligence'
import { stages, stageColors, type Health, type StageName } from '../data/mock'
import { useState_, useActions } from '../store/store'
import type { Deal } from '../store/types'
import { money, classNames } from '../lib/format'

const healthTone: Record<Health, ChipTone> = { Healthy: 'positive', 'At risk': 'warning', Stalled: 'negative', 'No next step': 'warning' }

export function DealsBoard() {
  const nav = useNavigate()
  const { deals, orgs, activities } = useState_()
  const { moveStage, addDeal } = useActions()
  const [view, setView] = useState<'board' | 'list' | 'forecast' | 'archive'>('board')
  const [dragId, setDragId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const active = deals.filter((d) => !d.lost)
  const byStage = useMemo(() => {
    const map: Record<string, Deal[]> = {}
    stages.forEach((s) => (map[s] = []))
    active.forEach((d) => map[d.stage]?.push(d))
    return map
  }, [deals])

  const open = active.filter((d) => !d.won)
  const total = open.reduce((s, d) => s + d.value, 0)
  const weighted = Math.round(open.reduce((s, d) => s + d.value * (d.probability / 100), 0))
  const lost = deals.filter((d) => d.lost)

  const viewTabs = [
    { id: 'board', icon: Bars, label: 'Board' },
    { id: 'list', icon: Grid, label: 'List' },
    { id: 'forecast', icon: Pie, label: 'Forecast' },
    { id: 'archive', icon: Box, label: 'Archive' },
  ] as const

  return (
    <>
      <TopBar
        title="Deals"
        actions={
          <>
            <Button icon={<Filter size={16} />}>Filter</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowNew(true)}>New deal</Button>
          </>
        }
      />

      <div className="h-[52px] shrink-0 bg-surface border-b border-border flex items-center gap-3 px-7">
        <div className="inline-flex bg-control rounded-control p-[3px] gap-0.5">
          {viewTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              title={t.label}
              className={classNames('h-[30px] w-9 rounded-[7px] flex items-center justify-center transition-colors', view === t.id ? 'bg-white text-accent shadow-[0_1px_2px_rgba(11,18,32,0.08)]' : 'text-muted-b hover:text-ink-3')}
            >
              <t.icon size={16} />
            </button>
          ))}
        </div>
        <button className="h-9 px-3 rounded-control border border-border flex items-center gap-2 text-[13px] font-medium text-ink-3 hover:bg-control">
          <Bars size={15} className="text-accent" /> Enterprise pipeline <ChevronDown size={14} className="text-muted-2" />
        </button>
        <button onClick={() => setShowNew(true)} className="text-[13px] text-muted-b hover:text-ink-3 flex items-center gap-1.5"><Plus size={14} /> Add condition</button>
        <div className="ml-auto flex items-center gap-3 text-[13px]">
          <span className="text-muted-2"><span className="font-semibold text-ink-2">{open.length}</span> deals · <span className="font-semibold text-ink-2">{money(total, { compact: true })}</span></span>
          <Chip tone="accent" dot>Owner: Jordan Miles</Chip>
        </div>
      </div>

      {view === 'board' && (
        <main className="flex-1 overflow-hidden p-7 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="text-[13px] text-muted-b">Weighted <span className="font-semibold text-ink-2">{money(weighted)}</span> of {money(total)} open</div>
            <div className="flex-1 max-w-[440px] h-2 rounded-full overflow-hidden flex">
              {stages.map((s, i) => {
                const v = byStage[s].filter((d) => !d.won).reduce((a, b) => a + b.value, 0)
                return <div key={s} style={{ flex: v || 0.2, background: stageColors[i] }} />
              })}
            </div>
          </div>

          <div className="grid gap-3.5 flex-1 min-h-0" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
            {stages.map((stage, i) => {
              const col = byStage[stage]
              const colValue = col.reduce((a, b) => a + b.value, 0)
              return (
                <div key={stage} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId) moveStage(dragId, stage as StageName); setDragId(null) }} className="flex flex-col min-h-0">
                  <div className="flex items-center justify-between pb-1">
                    <div className="text-[13px] font-semibold text-ink-2">{stage}</div>
                    <span className="text-[12px] text-muted-3">{col.length}</span>
                  </div>
                  <div className="text-[12px] text-muted-2 font-medium mb-2">{money(colValue, { compact: true })}</div>
                  <div className="h-[3px] rounded-full mb-2.5" style={{ background: stageColors[i] }} />
                  <div className="flex flex-col gap-2.5 overflow-y-auto pr-1 -mr-1 pb-2">
                    {col.map((d) => {
                      const focused = d.stage === 'Negotiations Started' && !d.won
                      return (
                        <div
                          key={d.id}
                          draggable
                          onDragStart={() => setDragId(d.id)}
                          onDragEnd={() => setDragId(null)}
                          onClick={() => nav(`/deals/${d.id}`)}
                          className={classNames(
                            'bg-surface rounded-rail p-3.5 cursor-pointer transition-shadow duration-150 border',
                            d.won && 'bg-[#F4FAF8] border-positive-border',
                            !d.won && focused && 'border-accent shadow-board-selected',
                            !d.won && !focused && 'border-border hover:shadow-card',
                            dragId === d.id && 'opacity-50',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-ink-2 truncate">{d.org}</div>
                              <div className="text-[12px] text-muted-2 truncate">{d.name}</div>
                            </div>
                            {!d.won && <ScorePill score={dealScore(d, activities)} size="sm" />}
                          </div>
                          <div className="flex items-center justify-between mt-2.5">
                            <div className="text-[15px] font-bold" style={{ color: d.won ? '#0E7C66' : '#0B1220' }}>{money(d.value, { compact: true })}</div>
                            <Avatar name={d.owner} size={24} />
                          </div>
                          {(d.chips.length > 0 || !d.won) && (
                            <div className="flex flex-wrap gap-1.5 mt-2.5">
                              {!d.won && dealRisk(d, activities).level !== 'ok' && <RiskBadge risk={dealRisk(d, activities)} />}
                              {d.chips.map((c, ci) => (<Chip key={ci} tone={c.tone}>{c.label}</Chip>))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {i === 0 && (
                      <button onClick={() => setShowNew(true)} className="rounded-rail border border-dashed border-input-border text-[13px] text-muted-2 py-3 hover:border-accent hover:text-accent transition-colors flex items-center justify-center gap-1.5">
                        <Plus size={15} /> Add deal
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </main>
      )}

      {view === 'list' && (
        <main className="flex-1 overflow-y-auto p-7">
          <Table
            template="2.2fr 1.4fr 1fr 1.2fr 1fr 0.9fr 0.9fr"
            columns={[
              { key: 'deal', header: 'Deal' },
              { key: 'org', header: 'Organisation' },
              { key: 'value', header: 'Value', align: 'right' },
              { key: 'stage', header: 'Stage' },
              { key: 'close', header: 'Close date' },
              { key: 'owner', header: 'Owner' },
              { key: 'health', header: 'Health' },
            ]}
            footer={<><span>{open.length} open · {money(total)}</span><span className="flex gap-3"><button>Prev</button><button className="text-ink-3 font-medium">Next</button></span></>}
          >
            {active.map((d) => (
              <Row key={d.id} template="2.2fr 1.4fr 1fr 1.2fr 1fr 0.9fr 0.9fr" onClick={() => nav(`/deals/${d.id}`)}>
                <Cell className="font-semibold text-ink-2">{d.name}{d.won && <Chip tone="positive">Won</Chip>}</Cell>
                <Cell muted>{d.org}</Cell>
                <Cell align="right" className="font-semibold text-ink-2">{money(d.value)}</Cell>
                <Cell><Chip tone="accent">{d.stage}</Chip></Cell>
                <Cell muted>{d.closeDate}</Cell>
                <Cell muted>{d.owner}</Cell>
                <Cell><Chip tone={healthTone[d.health]} dot>{d.health}</Chip></Cell>
              </Row>
            ))}
          </Table>
        </main>
      )}

      {view === 'forecast' && (
        <main className="flex-1 overflow-y-auto p-7">
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
            {stages.map((s, i) => {
              const col = byStage[s].filter((d) => !d.won)
              const v = col.reduce((a, b) => a + b.value, 0)
              const w = col.reduce((a, b) => a + b.value * (b.probability / 100), 0)
              return (
                <div key={s} className="bg-surface border border-border rounded-card p-4">
                  <div className="h-[3px] rounded-full mb-3" style={{ background: stageColors[i] }} />
                  <div className="text-[13px] font-semibold text-ink-2">{s}</div>
                  <div className="text-[22px] font-bold text-ink mt-1">{money(v, { compact: true })}</div>
                  <div className="text-[12px] text-muted-2 mt-0.5">{col.length} deals</div>
                  <div className="text-[13px] font-semibold text-accent mt-2">{money(Math.round(w), { compact: true })} weighted</div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 rounded-card bg-deep-panel p-5 flex items-center justify-between">
            <div>
              <div className="text-[12px]" style={{ color: '#93A0B4' }}>Total weighted forecast · this quarter</div>
              <div className="text-[28px] font-bold text-white mt-1">{money(weighted)}</div>
            </div>
            <div className="text-[13px]" style={{ color: '#8FB0FF' }}>Quota $1.1M · {Math.round((weighted / 1100000) * 100)}% covered</div>
          </div>
        </main>
      )}

      {view === 'archive' && (
        <main className="flex-1 overflow-y-auto p-7">
          {lost.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2">
              <Box size={40} className="text-muted-3" />
              <div className="text-[18px] font-semibold text-ink-2">No archived deals</div>
              <div className="text-[13px] text-muted-b">Deals you mark as lost appear here. <button onClick={() => setView('board')} className="text-accent font-medium">View the board</button>.</div>
            </div>
          ) : (
            <Table
              template="2.4fr 1.4fr 1fr 1.4fr"
              columns={[{ key: 'd', header: 'Deal' }, { key: 'o', header: 'Organisation' }, { key: 'v', header: 'Value', align: 'right' }, { key: 'r', header: 'Lost reason' }]}
              footer={<span>{lost.length} lost</span>}
            >
              {lost.map((d) => (
                <Row key={d.id} template="2.4fr 1.4fr 1fr 1.4fr" onClick={() => nav(`/deals/${d.id}`)}>
                  <Cell className="font-semibold text-ink-2">{d.name}</Cell>
                  <Cell muted>{d.org}</Cell>
                  <Cell align="right" muted>{money(d.value)}</Cell>
                  <Cell><Chip tone="warning">{d.lostReason ?? 'Lost'}</Chip></Cell>
                </Row>
              ))}
            </Table>
          )}
        </main>
      )}

      <NewDealModal open={showNew} onClose={() => setShowNew(false)} orgs={orgs} onCreate={(p) => { const d = addDeal(p); setShowNew(false); nav(`/deals/${d.id}`) }} />
    </>
  )
}

function NewDealModal({ open, onClose, orgs, onCreate }: { open: boolean; onClose: () => void; orgs: { name: string }[]; onCreate: (p: { name: string; org: string; value: number; stage: StageName }) => void }) {
  const [name, setName] = useState('')
  const [org, setOrg] = useState('')
  const [value, setValue] = useState('')
  const [stage, setStage] = useState<StageName>('Qualified')
  const valid = name.trim() && org.trim()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New deal"
      subtitle="Add an opportunity to your pipeline"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => valid && onCreate({ name, org, value: Number(value) || 0, stage })}>Create deal</Button>
        </>
      }
    >
      <Field label="Deal name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Substation upgrade — Phase 2" autoFocus /></Field>
      <Field label="Organisation">
        <Input list="org-list" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Company name" />
        <datalist id="org-list">{orgs.map((o) => (<option key={o.name} value={o.name} />))}</datalist>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Value ($)"><Input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" /></Field>
        <Field label="Stage">
          <Select value={stage} onChange={(e) => setStage(e.target.value as StageName)}>
            {stages.map((s) => (<option key={s} value={s}>{s}</option>))}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}
