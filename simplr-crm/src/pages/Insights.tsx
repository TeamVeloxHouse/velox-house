import { useState } from 'react'
import { TopBar } from '../components/TopBar'
import { Button } from '../components/ui'
import { Modal, Select, Field } from '../components/overlays'
import { Plus, Sparkle, Grid } from '../components/icons'
import { useActions, useState_ } from '../store/store'
import type { Deal, DashboardWidget, WidgetMetric, WidgetGroup, WidgetChart } from '../store/types'
import { money } from '../lib/format'

const PALETTE = ['#1D4ED8', '#3A67E4', '#5B85F0', '#8FB0FF', '#0E7C66', '#7C3AED', '#C79A3A', '#B01B4F']
const METRIC_LABEL: Record<WidgetMetric, string> = { open: 'Open value', weighted: 'Weighted value', won: 'Won value', count: 'Deal count' }
const GROUP_LABEL: Record<WidgetGroup, string> = { stage: 'Stage', owner: 'Owner', health: 'Health' }

type Datum = { label: string; val: number; color: string }
function computeWidget(deals: Deal[], w: DashboardWidget): Datum[] {
  const open = deals.filter((d) => !d.lost)
  const key = (d: Deal) => (w.groupBy === 'stage' ? d.stage : w.groupBy === 'owner' ? d.owner : d.health)
  const buckets = [...new Set(open.map(key))]
  return buckets.map((b, i) => {
    const rows = open.filter((d) => key(d) === b)
    const val =
      w.metric === 'count' ? rows.length :
      w.metric === 'won' ? rows.filter((d) => d.won).reduce((s, d) => s + d.value, 0) :
      w.metric === 'weighted' ? Math.round(rows.reduce((s, d) => s + d.value * (d.probability / 100), 0)) :
      rows.reduce((s, d) => s + d.value, 0)
    return { label: String(b), val, color: PALETTE[i % PALETTE.length] }
  }).filter((d) => d.val > 0 || w.metric === 'count')
}
const fmtVal = (v: number, metric: WidgetMetric) => (metric === 'count' ? String(v) : money(v, { compact: true }))

export function Insights() {
  const { deals, dashboardWidgets } = useState_()
  const act = useActions()
  const [builder, setBuilder] = useState(false)
  return (
    <>
      <TopBar
        title="Insights"
        crumbs={['Your dashboard']}
        actions={<><Button variant="primary" icon={<Plus size={16} />} onClick={() => setBuilder(true)}>Add widget</Button></>}
      />
      <main className="flex-1 overflow-y-auto p-7">
        {dashboardWidgets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-16">
            <span className="w-14 h-14 rounded-full bg-control text-muted-2 flex items-center justify-center"><Grid size={26} /></span>
            <div className="text-[18px] font-semibold text-ink-2">Build your dashboard</div>
            <div className="text-[13px] text-muted-b max-w-[42ch]">Add widgets computed live from your pipeline — value by stage, weighted by owner, deal counts, and more.</div>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setBuilder(true)}>Add your first widget</Button>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {dashboardWidgets.map((w) => (
              <WidgetCard key={w.id} w={w} data={computeWidget(deals, w)} onRemove={() => act.removeWidget(w.id)} />
            ))}
            <button onClick={() => setBuilder(true)} className="rounded-card border border-dashed border-input-border min-h-[260px] flex flex-col items-center justify-center gap-2 text-muted-2 hover:border-accent hover:text-accent transition-colors">
              <Plus size={22} /> <span className="text-[13px] font-semibold">Add widget</span>
            </button>
          </div>
        )}
      </main>
      <WidgetBuilder open={builder} onClose={() => setBuilder(false)} />
    </>
  )
}

function WidgetCard({ w, data, onRemove }: { w: DashboardWidget; data: Datum[]; onRemove: () => void }) {
  const total = data.reduce((s, d) => s + d.val, 0)
  const max = Math.max(1, ...data.map((d) => d.val))
  return (
    <div className="bg-surface border border-border rounded-card p-5 flex flex-col group relative">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[14px] font-semibold text-ink">{w.title}</div>
          <div className="text-[11.5px] text-muted-2 mt-0.5">{METRIC_LABEL[w.metric]} · by {GROUP_LABEL[w.groupBy].toLowerCase()}</div>
        </div>
        <button onClick={onRemove} title="Remove widget" className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center text-muted-2 hover:text-negative hover:bg-negative-wash text-[16px] leading-none">×</button>
      </div>
      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[12.5px] text-muted-3 min-h-[140px]">No data yet.</div>
      ) : w.chart === 'bar' ? (
        <div className="flex items-end gap-3 h-[170px]">
          {data.map((d) => (
            <div key={d.label} className="flex-1 flex flex-col items-center gap-2 justify-end min-w-0">
              <div className="text-[11px] font-semibold text-ink-2 tabular-nums">{fmtVal(d.val, w.metric)}</div>
              <div className="w-full rounded-t" style={{ height: `${(d.val / max) * 120}px`, background: d.color, minHeight: 3 }} />
              <div className="text-[10.5px] text-muted-2 text-center leading-tight truncate w-full" title={d.label}>{d.label}</div>
            </div>
          ))}
        </div>
      ) : w.chart === 'donut' ? (
        <div className="flex items-center gap-5">
          <Donut data={data} total={total} />
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            {data.map((d) => (
              <div key={d.label} className="flex items-center gap-2 text-[12px]"><span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.color }} /><span className="text-ink-3 flex-1 truncate">{d.label}</span><span className="font-semibold text-ink-2 tabular-nums">{fmtVal(d.val, w.metric)}</span></div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          {data.map((d) => (
            <div key={d.label} className="flex items-center justify-between py-1.5 border-b border-divider last:border-0 text-[13px]"><span className="flex items-center gap-2 min-w-0"><span className="w-2 h-2 rounded-sm shrink-0" style={{ background: d.color }} /><span className="truncate">{d.label}</span></span><span className="font-semibold text-ink-2 tabular-nums">{fmtVal(d.val, w.metric)}</span></div>
          ))}
          <div className="flex items-center justify-between pt-2 mt-1 text-[13px] font-bold text-ink"><span>Total</span><span className="tabular-nums">{fmtVal(total, w.metric)}</span></div>
        </div>
      )}
    </div>
  )
}

const METRIC_OPTS: [string, WidgetMetric][] = [['Open value', 'open'], ['Weighted value', 'weighted'], ['Won value', 'won'], ['Deal count', 'count']]
const GROUP_OPTS: [string, WidgetGroup][] = [['Stage', 'stage'], ['Owner', 'owner'], ['Health', 'health']]
const CHART_OPTS: [string, WidgetChart][] = [['Bar', 'bar'], ['Donut', 'donut'], ['Table', 'table']]

function WidgetBuilder({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { deals } = useState_()
  const act = useActions()
  const [metric, setMetric] = useState<WidgetMetric>('open')
  const [groupBy, setGroupBy] = useState<WidgetGroup>('stage')
  const [chart, setChart] = useState<WidgetChart>('bar')
  const title = `${METRIC_LABEL[metric]} by ${GROUP_LABEL[groupBy].toLowerCase()}`
  const preview: DashboardWidget = { id: 'preview', title, metric, groupBy, chart }

  return (
    <Modal open={open} onClose={onClose} title="Add a widget" subtitle="Live from your pipeline — pick a metric, dimension and chart" width={640}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { act.addWidget({ title, metric, groupBy, chart }); onClose() }}>Add to dashboard</Button></>}>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Metric"><Select value={metric} onChange={(e) => setMetric(e.target.value as WidgetMetric)}>{METRIC_OPTS.map(([l, v]) => (<option key={v} value={v}>{l}</option>))}</Select></Field>
        <Field label="Group by"><Select value={groupBy} onChange={(e) => setGroupBy(e.target.value as WidgetGroup)}>{GROUP_OPTS.map(([l, v]) => (<option key={v} value={v}>{l}</option>))}</Select></Field>
        <Field label="Chart"><Select value={chart} onChange={(e) => setChart(e.target.value as WidgetChart)}>{CHART_OPTS.map(([l, v]) => (<option key={v} value={v}>{l}</option>))}</Select></Field>
      </div>
      <div className="rounded-card border border-border bg-surface-tint p-1">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-accent-700 px-3 pt-2"><Sparkle size={13} /> Live preview</div>
        <div className="p-2"><WidgetCard w={preview} data={computeWidget(deals, preview)} onRemove={() => {}} /></div>
      </div>
    </Modal>
  )
}

function Donut({ data, total }: { data: Datum[]; total: number }) {
  let acc = 0
  const r = 42, c = 2 * Math.PI * r
  return (
    <svg width="110" height="110" viewBox="0 0 110 110" className="shrink-0">
      <circle cx="55" cy="55" r={r} fill="none" stroke="#EEF0F4" strokeWidth="16" />
      {data.map((d) => {
        const frac = total > 0 ? d.val / total : 0
        const dash = frac * c
        const el = <circle key={d.label} cx="55" cy="55" r={r} fill="none" stroke={d.color} strokeWidth="16" strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-acc * c} transform="rotate(-90 55 55)" />
        acc += frac
        return el
      })}
    </svg>
  )
}
