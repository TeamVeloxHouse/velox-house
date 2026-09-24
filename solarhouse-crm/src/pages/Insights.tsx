import { useMemo, useState } from 'react'
import { TopBar } from '../components/TopBar'
import { HBars, DataTable } from '../components/charts'
import { Sparkle, Send, Pie, Bars, Clock, MapPin, Sun, Users, Megaphone, Grid } from '../components/icons'
import { useState_ } from '../store/store'
import { money, classNames } from '../lib/format'
import { buildDataset, fallbackInsight, askOviInsight, type Insight, type InsightBlock } from '../lib/insightsData'

/* Insights — fits the screen, no page scroll. Left: ask Ovi, your questions, and the built-in
 * analyses. Right: one canvas showing the selected insight (stats on top; chart and table side by
 * side, each scrolling inside itself only if it has to). */

const EXAMPLES = [
  'Which lead sources give us the best return?',
  'How is each showroom performing?',
  'What are customers buying — batteries, EV, sizes?',
  'Where is the sales process slowest?',
  'Which advisers convert best?',
  'Which postcode areas should we target?',
]
type Item = { id: string; label: string; icon: typeof Pie; q?: string; ins: Insight | null; live?: boolean; working?: boolean }
const fmtUnit = (unit: string) => (n: number) => unit === 'money' ? money(n, { compact: true }) : unit === 'percent' ? `${n}%` : unit === 'days' ? `${n}d` : String(n)

function Canvas({ it }: { it: Item }) {
  if (it.working || !it.ins) return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-[13px] text-ink-3">
      {['Reading enquiries, deals and installs', 'Working out the numbers', 'Building the chart and table'].map((s, k) => <div key={k} className="flex items-center gap-2.5"><span className="w-4 h-4 rounded-full border-2 border-[#15223B] border-t-transparent animate-spin" />{s}…</div>)}
    </div>
  )
  const ins = it.ins
  const stats = ins.blocks.filter((b): b is Extract<InsightBlock, { type: 'stats' }> => b.type === 'stats')
  const visuals = ins.blocks.filter((b) => b.type === 'bars' || b.type === 'table')
  const texts = ins.blocks.filter((b): b is Extract<InsightBlock, { type: 'text' }> => b.type === 'text')
  return (
    <div className="h-full min-h-0 flex flex-col gap-4">
      <div className="shrink-0">
        <div className="flex items-center gap-2">
          <div className="text-[18px] font-extrabold text-ink tracking-[-0.01em]">{ins.title}</div>
          {it.q && <span className="ml-auto text-[11px] font-semibold rounded-full px-2 py-0.5 bg-[#F1F3F7] text-muted-b">{it.live ? 'Ovi · live model' : 'Ovi · built-in analysis'}</span>}
        </div>
        <p className="text-[13.5px] text-ink-3 mt-1 leading-relaxed max-w-[1000px]">{ins.summary}</p>
        {texts.map((t, i) => <p key={i} className="text-[13px] text-ink-3 mt-1">{t.text}</p>)}
      </div>
      {stats.map((b, i) => (
        <div key={i} className="shrink-0 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(4, b.items.length)}, minmax(0,1fr))` }}>
          {b.items.slice(0, 4).map((s, k) => <div key={k} className={classNames('rounded-[12px] px-4 py-3', k === 0 ? 'bg-[#15223B] text-white' : 'bg-[#F7F9FB] border border-[#E6EAF0]')}><div className={classNames('text-[12px] font-semibold', k === 0 ? 'text-white/70' : 'text-muted-b')}>{s.label}</div><div className={classNames('font-extrabold mt-1 tabular-nums leading-tight', String(s.value).length > 12 ? 'text-[15px]' : 'text-[22px]', k === 0 ? 'text-white' : 'text-ink')}>{String(s.value)}</div></div>)}
        </div>
      ))}
      <div className="flex-1 min-h-0 grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(2, visuals.length))}, minmax(0,1fr))` }}>
        {visuals.slice(0, 2).map((b, i) => (
          <div key={i} className="min-h-0 flex flex-col rounded-[12px] border border-[#E6EAF0] bg-white">
            <div className="shrink-0 px-4 pt-3 pb-2 eyebrow text-muted-3">{(b as { title?: string }).title ?? (b.type === 'table' ? 'The numbers' : 'Chart')}</div>
            <div className="flex-1 min-h-0 overflow-auto px-4 pb-4">
              {b.type === 'bars'
                ? <HBars data={(b.items ?? []).map((x) => ({ label: x.label, value: Number(x.value) || 0 }))} fmt={fmtUnit(b.unit ?? 'count')} />
                : b.type === 'table' ? <DataTable cols={(b.columns ?? []).map((c, k) => ({ label: c, align: k === 0 ? 'left' as const : 'right' as const }))} rows={(b.rows ?? []).map((r) => r.map((c, k) => (k === 0 ? <b key={k}>{String(c)}</b> : String(c))))} /> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Insights() {
  const { deals } = useState_()
  const ds = useMemo(() => buildDataset(deals), [deals])
  const builtIns: Item[] = useMemo(() => [
    { id: 'b-overview', label: 'Sales at a glance', icon: Grid, ins: fallbackInsight('overview', ds) },
    { id: 'b-source', label: 'Lead sources', icon: Megaphone, ins: fallbackInsight('source', ds) },
    { id: 'b-speed', label: 'Speed through the funnel', icon: Clock, ins: fallbackInsight('slow', ds) },
    { id: 'b-showroom', label: 'Showrooms', icon: Sun, ins: fallbackInsight('showroom', ds) },
    { id: 'b-adviser', label: 'Advisers', icon: Users, ins: fallbackInsight('adviser', ds) },
    { id: 'b-product', label: 'What customers buy', icon: Bars, ins: fallbackInsight('battery', ds) },
    { id: 'b-area', label: 'Postcode areas', icon: MapPin, ins: fallbackInsight('postcode area', ds) },
  ], [ds])
  const [asked, setAsked] = useState<Item[]>([])
  const [sel, setSel] = useState('b-overview')
  const [q, setQ] = useState('')
  const current = [...asked, ...builtIns].find((x) => x.id === sel) ?? builtIns[0]

  async function ask(question: string) {
    const text = question.trim(); if (!text) return
    const id = `q${Date.now()}`
    setQ(''); setSel(id)
    setAsked((a) => [{ id, label: text, icon: Sparkle, q: text, ins: null, working: true }, ...a])
    const live = await askOviInsight(text, ds)
    const ins = live ?? fallbackInsight(text, ds)
    setAsked((a) => a.map((x) => (x.id === id ? { ...x, ins, live: !!live, working: false } : x)))
  }

  const NavItem = ({ it }: { it: Item }) => (
    <button onClick={() => setSel(it.id)} className={classNames('w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-left text-[13px] transition-colors', sel === it.id ? 'bg-[#62E4CC] text-[#15223B] font-bold' : 'text-white/80 hover:bg-white/10 hover:text-white')}>
      <it.icon size={14} className={sel === it.id ? '' : 'text-[#62E4CC]'} />
      <span className="flex-1 truncate">{it.label}</span>
      {it.working && <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />}
    </button>
  )

  return (
    <>
      <TopBar title="Insights" crumbs={['Sales']} identity={{ icon: Pie, accent: '#15223B' }} />
      <main className="flex-1 min-h-0 flex gap-5 px-7 py-5">
        {/* left: ask + history + built-ins */}
        <aside className="w-[330px] shrink-0 min-h-0 flex flex-col rounded-card overflow-hidden shadow-[0_10px_28px_-12px_rgba(21,34,59,0.45)]" style={{ background: 'linear-gradient(160deg, #1B2B48 0%, #15223B 70%)' }}>
          <div className="shrink-0 p-4">
            <div className="flex items-center gap-2.5"><span className="w-8 h-8 rounded-[10px] bg-white/10 text-[#62E4CC] flex items-center justify-center"><Sparkle size={16} /></span><div><div className="text-[15px] font-bold text-white">Ask Ovi</div><div className="text-[11.5px] text-white/60">Answers with charts & tables from live data</div></div></div>
            <form onSubmit={(e) => { e.preventDefault(); void ask(q) }} className="mt-3 rounded-[12px] bg-white flex items-end gap-1.5 p-1.5">
              <textarea value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(q) } }} rows={2} placeholder="Ask anything about your sales…" className="flex-1 min-w-0 resize-none bg-transparent outline-none text-[13px] text-ink-2 placeholder:text-muted-3 px-2 py-1" />
              <button type="submit" disabled={!q.trim()} className="h-8 w-8 rounded-[8px] bg-[#62E4CC] text-[#15223B] flex items-center justify-center disabled:opacity-40 shrink-0"><Send size={14} /></button>
            </form>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {EXAMPLES.slice(0, 4).map((e) => <button key={e} onClick={() => void ask(e)} className="h-7 px-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white/85 text-[11.5px] transition-colors text-left truncate max-w-full">{e}</button>)}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 flex flex-col gap-3">
            {asked.length > 0 && <div><div className="px-3 pb-1 eyebrow text-white/45">Your questions</div>{asked.map((it) => <NavItem key={it.id} it={it} />)}</div>}
            <div><div className="px-3 pb-1 eyebrow text-white/45">Built-in insights</div>{builtIns.map((it) => <NavItem key={it.id} it={it} />)}</div>
          </div>
        </aside>
        {/* right: the canvas */}
        <section className="flex-1 min-w-0 min-h-0 rounded-card bg-white border border-[#E1E6EC] shadow-card p-5">
          <Canvas it={current} />
        </section>
      </main>
    </>
  )
}
