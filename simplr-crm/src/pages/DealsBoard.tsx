import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Button, Avatar, Chip, type ChipTone } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Modal, Field, Input, Select } from '../components/overlays'
import { Plus, Bars, Filter, Search, Grid, Pie, Box } from '../components/icons'
import { ScorePill, RiskBadge } from '../components/ai-widgets'
import { dealScore, dealRisk } from '../lib/intelligence'
import { type Health, type StageName } from '../data/mock'
import { useState_, useActions, useSelectors } from '../store/store'
import type { Deal, PipelineStage } from '../store/types'
import { money, classNames } from '../lib/format'

const healthTone: Record<Health, ChipTone> = { Healthy: 'positive', 'At risk': 'warning', Stalled: 'negative', 'No next step': 'warning' }
const healthDot: Record<Health, string> = { Healthy: 'bg-positive', 'At risk': 'bg-warning', Stalled: 'bg-negative', 'No next step': 'bg-warning' }

export function DealsBoard() {
  const nav = useNavigate()
  const { deals, orgs, activities, pipelines, activePipelineId } = useState_()
  const { moveStage, addDeal, addPerson, setActivePipeline } = useActions()
  const sel = useSelectors()
  const pipeline = sel.activePipeline()
  const pstages = pipeline.stages
  const defaultPipeId = pipelines[0]?.id
  const [view, setView] = useState<'board' | 'list' | 'forecast' | 'archive'>('board')
  const [dragId, setDragId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newStage, setNewStage] = useState<StageName>(pstages[0]?.name ?? '')
  const [q, setQ] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [fOwner, setFOwner] = useState('All')
  const [fHealth, setFHealth] = useState('All')
  const [fMin, setFMin] = useState('')
  const [quick, setQuick] = useState<'none' | 'mine' | 'risk' | 'high'>('none')

  const owners = useMemo(() => [...new Set(deals.map((d) => d.owner))], [deals])
  const filterCount = (fOwner !== 'All' ? 1 : 0) + (fHealth !== 'All' ? 1 : 0) + (fMin ? 1 : 0) + (quick !== 'none' ? 1 : 0)
  const clearFilters = () => { setFOwner('All'); setFHealth('All'); setFMin(''); setQuick('none'); setQ('') }

  const match = (d: Deal) => {
    if (q && !(`${d.name} ${d.org}`).toLowerCase().includes(q.toLowerCase())) return false
    if (fOwner !== 'All' && d.owner !== fOwner) return false
    if (fHealth !== 'All' && d.health !== fHealth) return false
    if (fMin && d.value < Number(fMin)) return false
    if (quick === 'mine' && d.owner !== 'Jordan Miles') return false
    if (quick === 'risk' && d.health === 'Healthy') return false
    if (quick === 'high' && d.value < 100000) return false
    return true
  }

  const inPipe = (d: Deal) => (d.pipelineId ?? defaultPipeId) === pipeline.id
  const active = deals.filter((d) => !d.lost && inPipe(d) && match(d))
  const byStage = useMemo(() => {
    const map: Record<string, Deal[]> = {}
    pstages.forEach((s) => (map[s.name] = []))
    active.forEach((d) => { (map[d.stage] ??= []).push(d) })
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, q, fOwner, fHealth, fMin, quick, pipeline.id])

  const open = active.filter((d) => !d.won)
  const total = open.reduce((s, d) => s + d.value, 0)
  const weighted = Math.round(open.reduce((s, d) => s + d.value * (d.probability / 100), 0))
  const lost = deals.filter((d) => d.lost && inPipe(d))
  const openNewIn = (stage: StageName) => { setNewStage(stage); setShowNew(true) }

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
            <Button icon={<Filter size={16} />} onClick={() => setShowFilter((v) => !v)}>Filter{filterCount > 0 ? ` · ${filterCount}` : ''}</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => openNewIn(pstages[0]?.name ?? '')}>New deal</Button>
          </>
        }
      />

      <div className="h-[52px] shrink-0 bg-surface border-b border-border flex items-center gap-3 px-7">
        {/* pipeline switcher */}
        <div className="flex items-center gap-1.5">
          <select value={activePipelineId} onChange={(e) => setActivePipeline(e.target.value)} className="h-9 pl-3 pr-7 rounded-control border border-border bg-surface text-[13px] font-semibold text-ink-2 outline-none focus:border-accent cursor-pointer">
            {pipelines.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
          <button onClick={() => nav('/settings?tab=pipelines')} title="Manage pipelines" className="h-9 w-9 rounded-control border border-border text-muted-b hover:text-ink-3 hover:bg-control flex items-center justify-center"><Plus size={16} /></button>
        </div>
        <div className="w-px h-6 bg-divider" />
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
        <div className="h-9 w-[260px] rounded-control border border-border bg-surface flex items-center gap-2 px-3">
          <Search size={15} className="text-muted-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search deals & companies" className="bg-transparent outline-none flex-1 text-[13px] text-ink-2 placeholder:text-muted-3" />
        </div>
        {/* quick filter chips */}
        <div className="flex items-center gap-1.5">
          {([['mine', 'My deals'], ['risk', 'At risk'], ['high', '£100k+']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setQuick((cur) => (cur === id ? 'none' : id))} className={classNames('h-8 px-2.5 rounded-lg text-[12.5px] font-medium border transition-colors', quick === id ? 'bg-accent text-white border-accent' : 'border-border text-muted-b hover:bg-control')}>{label}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-[13px]">
          {filterCount > 0 && <button onClick={clearFilters} className="text-[12.5px] text-accent font-medium">Clear</button>}
          <span className="text-muted-2"><span className="font-semibold text-ink-2">{open.length}</span> deals · <span className="font-semibold text-ink-2">{money(total, { compact: true })}</span></span>
        </div>
      </div>

      {showFilter && (
        <div className="shrink-0 bg-surface-tint border-b border-border flex items-center gap-4 px-7 py-2.5">
          <label className="flex items-center gap-2 text-[12.5px] text-ink-3"><span className="text-muted-2">Owner</span>
            <select value={fOwner} onChange={(e) => setFOwner(e.target.value)} className="h-8 px-2 rounded-control border border-input-border bg-white text-[13px] outline-none focus:border-accent"><option>All</option>{owners.map((o) => <option key={o}>{o}</option>)}</select>
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-ink-3"><span className="text-muted-2">Health</span>
            <select value={fHealth} onChange={(e) => setFHealth(e.target.value)} className="h-8 px-2 rounded-control border border-input-border bg-white text-[13px] outline-none focus:border-accent"><option>All</option><option>Healthy</option><option>At risk</option><option>Stalled</option><option>No next step</option></select>
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-ink-3"><span className="text-muted-2">Min value £</span>
            <input type="number" value={fMin} onChange={(e) => setFMin(e.target.value)} placeholder="0" className="h-8 w-28 px-2 rounded-control border border-input-border bg-white text-[13px] outline-none focus:border-accent" />
          </label>
          <span className="ml-auto text-[12.5px] text-muted-2">{active.filter((d) => !d.won).length} match</span>
        </div>
      )}

      {view === 'board' && (
        <main className="flex-1 overflow-hidden p-7 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="text-[13px] text-muted-b">Weighted <span className="font-semibold text-ink-2">{money(weighted)}</span> of {money(total)} open</div>
            <div className="flex-1 max-w-[440px] h-2 rounded-full overflow-hidden flex">
              {pstages.map((s) => {
                const v = (byStage[s.name] ?? []).filter((d) => !d.won).reduce((a, b) => a + b.value, 0)
                return <div key={s.id} style={{ flex: v || 0.2, background: s.color }} />
              })}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-x-auto -mx-1 px-1">
            <div className="grid gap-3.5 h-full" style={{ gridTemplateColumns: `repeat(${pstages.length}, minmax(248px, 1fr))` }}>
              {pstages.map((ps, i) => {
                const stage = ps.name
                const col = byStage[stage] ?? []
                const colValue = col.reduce((a, b) => a + b.value, 0)
                const isDropTarget = dragId && deals.find((d) => d.id === dragId)?.stage !== stage
                const focusStage = i === pstages.length - 1
                return (
                  <div
                    key={ps.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (dragId) moveStage(dragId, stage as StageName); setDragId(null) }}
                    className={classNames('flex flex-col min-h-0 rounded-xl px-1.5 transition-colors', isDropTarget ? 'bg-accent-wash' : '')}
                  >
                    <div className="flex items-center justify-between pt-1.5">
                      <div className="text-[13px] font-semibold text-ink-2">{stage}</div>
                      <span className="text-[11px] font-medium text-muted-3 bg-control rounded-full px-1.5 py-0.5">{col.length}</span>
                    </div>
                    <div className="text-[12px] text-muted-2 font-medium mb-2">{money(colValue, { compact: true })}</div>
                    <div className="h-[3px] rounded-full mb-2.5" style={{ background: ps.color }} />
                    <div className="flex flex-col gap-2.5 overflow-y-auto pr-1 -mr-1 pb-2 flex-1">
                      {col.length === 0 && (
                        <div className="text-[12px] text-muted-3 text-center py-6 rounded-lg border border-dashed border-input-border">No deals</div>
                      )}
                      {col.map((d) => {
                        const focused = focusStage && !d.won
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
                            <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-2">
                              <span className={classNames('w-1.5 h-1.5 rounded-full', healthDot[d.health])} />
                              <span>Close {d.closeDate}</span>
                              <span className="ml-auto tabular-nums">{d.probability}%</span>
                            </div>
                            {(d.chips.length > 0 || (!d.won && dealRisk(d, activities).level !== 'ok')) && (
                              <div className="flex flex-wrap gap-1.5 mt-2.5">
                                {!d.won && dealRisk(d, activities).level !== 'ok' && <RiskBadge risk={dealRisk(d, activities)} />}
                                {d.chips.map((c, ci) => (<Chip key={ci} tone={c.tone}>{c.label}</Chip>))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      <button onClick={() => openNewIn(stage as StageName)} className="rounded-rail border border-dashed border-input-border text-[12.5px] text-muted-2 py-2 hover:border-accent hover:text-accent transition-colors flex items-center justify-center gap-1.5">
                        <Plus size={14} /> Add deal
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
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
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${pstages.length},1fr)` }}>
            {pstages.map((ps) => {
              const col = (byStage[ps.name] ?? []).filter((d) => !d.won)
              const v = col.reduce((a, b) => a + b.value, 0)
              const w = col.reduce((a, b) => a + b.value * (b.probability / 100), 0)
              return (
                <div key={ps.id} className="bg-surface border border-border rounded-card p-4">
                  <div className="h-[3px] rounded-full mb-3" style={{ background: ps.color }} />
                  <div className="text-[13px] font-semibold text-ink-2">{ps.name}</div>
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
            <div className="text-[13px]" style={{ color: '#8FB0FF' }}>Quota £1.1M · {Math.round((weighted / 1100000) * 100)}% covered</div>
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

      <NewDealModal open={showNew} initialStage={newStage} pstages={pstages} onClose={() => setShowNew(false)} orgs={orgs} onCreate={(p) => {
        let personIds: string[] | undefined
        if (p.contact?.trim()) { const person = addPerson({ name: p.contact.trim(), role: p.contactRole, org: p.org }); personIds = [person.id] }
        const d = addDeal({ name: p.name, org: p.org, value: p.value, stage: p.stage, probability: p.probability, closeDate: p.closeDate || 'This quarter', subtitle: p.source ? `Source: ${p.source}` : '', personIds })
        setShowNew(false); nav(`/deals/${d.id}`)
      }} />
    </>
  )
}

const CONFIDENCE_OPTIONS = [10, 20, 30, 50, 65, 80, 90]
const DEAL_SOURCES = ['', 'Inbound', 'Referral', 'Outbound', 'Partner', 'Event', 'Existing customer']

type NewDealPayload = { name: string; org: string; value: number; stage: StageName; probability: number; closeDate: string; source: string; contact: string; contactRole: string }

function NewDealModal({ open, initialStage, pstages, onClose, orgs, onCreate }: { open: boolean; initialStage: StageName; pstages: PipelineStage[]; onClose: () => void; orgs: { name: string }[]; onCreate: (p: NewDealPayload) => void }) {
  const probOf = (s: StageName) => pstages.find((x) => x.name === s)?.probability ?? 30
  const [name, setName] = useState('')
  const [org, setOrg] = useState('')
  const [value, setValue] = useState('')
  const [stage, setStage] = useState<StageName>(initialStage)
  const [prob, setProb] = useState(probOf(initialStage))
  const [touchedProb, setTouchedProb] = useState(false)
  const [close, setClose] = useState('')
  const [source, setSource] = useState('')
  const [contact, setContact] = useState('')
  const [contactRole, setContactRole] = useState('')
  useEffect(() => { if (open) { setStage(initialStage); setProb(probOf(initialStage)); setTouchedProb(false) } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, initialStage])
  // when the stage changes and the user hasn't overridden confidence, follow the stage default
  function pickStage(s: StageName) { setStage(s); if (!touchedProb) setProb(probOf(s)) }
  const valid = name.trim() && org.trim()
  const weighted = Math.round((Number(value) || 0) * (prob / 100))
  const reset = () => { setName(''); setOrg(''); setValue(''); setClose(''); setSource(''); setContact(''); setContactRole('') }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New deal"
      subtitle="Add an opportunity — the richer the detail, the sharper your forecast"
      width={560}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => { if (valid) { onCreate({ name, org, value: Number(value) || 0, stage, probability: prob, closeDate: close, source, contact, contactRole }); reset() } }}>Create deal</Button>
        </>
      }
    >
      <Field label="Deal name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Substation upgrade — Phase 2" autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Organisation">
          <Input list="org-list" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Company name" />
          <datalist id="org-list">{orgs.map((o) => (<option key={o.name} value={o.name} />))}</datalist>
        </Field>
        <Field label="Source"><Select value={source} onChange={(e) => setSource(e.target.value)}>{DEAL_SOURCES.map((s) => (<option key={s} value={s}>{s || '— optional —'}</option>))}</Select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Primary contact"><Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Full name (optional)" /></Field>
        <Field label="Contact role"><Input value={contactRole} onChange={(e) => setContactRole(e.target.value)} placeholder="e.g. Head of Estates" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Value (£)"><Input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" /></Field>
        <Field label="Expected close"><Input value={close} onChange={(e) => setClose(e.target.value)} placeholder="e.g. This quarter / Mar 2026" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Stage">
          <Select value={stage} onChange={(e) => pickStage(e.target.value as StageName)}>
            {pstages.map((s) => (<option key={s.id} value={s.name}>{s.name}</option>))}
          </Select>
        </Field>
        <Field label="Confidence to win">
          <Select value={prob} onChange={(e) => { setProb(Number(e.target.value)); setTouchedProb(true) }}>
            {CONFIDENCE_OPTIONS.map((p) => (<option key={p} value={p}>{p}%</option>))}
          </Select>
        </Field>
      </div>
      <div className="rounded-control bg-surface-tint border border-border px-3 py-2.5 flex items-center gap-2 text-[12.5px] text-muted-b">
        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
        Deals at <span className="font-semibold text-ink-3">{stage}</span> typically close around <span className="font-semibold text-ink-3">{probOf(stage)}%</span>.
        {Number(value) > 0 && <span className="ml-auto text-ink-3 font-semibold">Weighted {money(weighted, { compact: true })}</span>}
      </div>
    </Modal>
  )
}
