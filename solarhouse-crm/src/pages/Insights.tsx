import { useMemo, useState } from 'react'
import { TopBar } from '../components/TopBar'
import { Kpi, Panel } from '../components/ui'
import { HBars, DataTable } from '../components/charts'
import { Sparkle, Send, Pie, Bars, Clock, MapPin, Sun, Users, Target, Megaphone, Bolt } from '../components/icons'
import { useState_ } from '../store/store'
import { money, classNames } from '../lib/format'
import { buildDataset, fallbackInsight, askOviInsight, type Insight, type InsightBlock, type Row } from '../lib/insightsData'

/* Insights — Ovi answers questions with charts and tables built from live CRM data, above a set of
 * built-in analyses. Ovi uses the real model when it's connected and a deterministic engine otherwise. */

const EXAMPLES = [
  'Which lead sources give us the best return?',
  'How is each showroom performing?',
  'What are customers buying — batteries, EV chargers, system sizes?',
  'Where is the sales process slowest?',
  'Which advisers convert best?',
  'Which postcode areas should we target?',
]
const fmtUnit = (unit: string) => (n: number) => unit === 'money' ? money(n, { compact: true }) : unit === 'percent' ? `${n}%` : unit === 'days' ? `${n}d` : String(n)
const fmtK = (n: number) => money(n, { compact: true })

function InsightView({ ins }: { ins: Insight }) {
  return (
    <div className="flex flex-col gap-4">
      <div><div className="text-[16px] font-bold text-ink">{ins.title}</div><p className="text-[13.5px] text-ink-3 mt-1 leading-relaxed max-w-[900px]">{ins.summary}</p></div>
      {ins.blocks.map((b, i) => <Block key={i} b={b} />)}
    </div>
  )
}
function Block({ b }: { b: InsightBlock }) {
  if (b.type === 'text') return <p className="text-[13.5px] text-ink-3">{b.text}</p>
  if (b.type === 'stats') return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {(b.items ?? []).map((s, i) => <div key={i} className="rounded-[12px] bg-[#F7F9FB] border border-[#E6EAF0] px-4 py-3"><div className="text-[12px] font-semibold text-muted-b">{s.label}</div><div className={classNames("font-extrabold text-ink mt-1 tabular-nums leading-tight", String(s.value).length > 12 ? "text-[15px]" : "text-[22px]")}>{String(s.value)}</div></div>)}
    </div>
  )
  if (b.type === 'bars') return (
    <div>{b.title && <div className="eyebrow text-muted-3 mb-2">{b.title}</div>}<HBars data={(b.items ?? []).map((x) => ({ label: x.label, value: Number(x.value) || 0 }))} fmt={fmtUnit(b.unit ?? 'count')} /></div>
  )
  if (b.type === 'table') return (
    <div>{b.title && <div className="eyebrow text-muted-3 mb-2">{b.title}</div>}
      <DataTable cols={(b.columns ?? []).map((c, i) => ({ label: c, align: i === 0 ? 'left' as const : 'right' as const }))} rows={(b.rows ?? []).map((r) => r.map((c, i) => (i === 0 ? <b key={i}>{String(c)}</b> : String(c))))} />
    </div>
  )
  return null
}

export function Insights() {
  const { deals } = useState_()
  const ds = useMemo(() => buildDataset(deals), [deals])
  const [q, setQ] = useState('')
  const [asked, setAsked] = useState<{ q: string; ins: Insight | null; live: boolean; working: boolean }[]>([])

  async function ask(question: string) {
    const text = question.trim(); if (!text) return
    setQ('')
    setAsked((a) => [{ q: text, ins: null, live: false, working: true }, ...a])
    const live = await askOviInsight(text, ds)
    const ins = live ?? fallbackInsight(text, ds)
    setAsked((a) => a.map((x, i) => (i === 0 ? { q: text, ins, live: !!live, working: false } : x)))
  }

  const t = ds.totals
  const table = (rows: Row[], label: string) => (
    <DataTable cols={[{ label, w: 'minmax(120px,1.5fr)' }, { label: 'Enquiries', align: 'right' }, { label: 'Open', align: 'right' }, { label: 'Signed', align: 'right' }, { label: 'Win rate', align: 'right' }, { label: 'Signed £', align: 'right' }]}
      rows={rows.map((r) => [<b key="k">{r.key}</b>, r.enquiries, r.open, r.signed, `${r.conv}%`, fmtK(r.value)])} />
  )

  return (
    <>
      <TopBar title="Insights" crumbs={['Sales']} identity={{ icon: Pie, accent: '#15223B' }} />
      <main className="flex-1 overflow-y-auto">
        <div className="px-7 py-6 flex flex-col gap-5 max-w-[1500px]">
          {/* Ask Ovi */}
          <section className="rounded-card overflow-hidden shadow-[0_10px_28px_-12px_rgba(21,34,59,0.45)]" style={{ background: 'linear-gradient(150deg, #1B2B48 0%, #15223B 70%)' }}>
            <div className="px-6 pt-5 pb-5">
              <div className="flex items-center gap-2.5"><span className="w-8 h-8 rounded-[10px] bg-white/10 text-[#62E4CC] flex items-center justify-center"><Sparkle size={16} /></span><div><div className="text-[16px] font-bold text-white">Ask Ovi for an insight</div><div className="text-[12.5px] text-white/65">Ovi reads your live CRM data and answers with charts and tables</div></div></div>
              <form onSubmit={(e) => { e.preventDefault(); void ask(q) }} className="mt-4 h-12 rounded-[12px] bg-white flex items-center gap-2 pl-4 pr-1.5">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Which lead sources give us the best return this quarter?" className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-ink-2 placeholder:text-muted-3" />
                <button type="submit" disabled={!q.trim()} className="h-9 px-4 rounded-[9px] bg-[#62E4CC] text-[#15223B] text-[13px] font-bold flex items-center gap-1.5 disabled:opacity-40"><Send size={14} />Ask</button>
              </form>
              <div className="flex flex-wrap gap-2 mt-3">
                {EXAMPLES.map((e) => <button key={e} onClick={() => void ask(e)} className="h-8 px-3 rounded-full bg-white/10 hover:bg-white/20 text-white/90 text-[12px] font-medium transition-colors">{e}</button>)}
              </div>
            </div>
          </section>

          {asked.map((a, i) => (
            <section key={asked.length - i} className="rounded-card bg-white border border-[#E1E6EC] shadow-card overflow-hidden">
              <div className="px-5 py-3 border-b border-[#EEF1F5] flex items-center gap-2.5 bg-[#FAFBFC]">
                <span className="w-7 h-7 rounded-full bg-[#15223B] text-[#62E4CC] flex items-center justify-center"><Sparkle size={13} /></span>
                <span className="text-[13px] font-semibold text-ink-2 flex-1 truncate">“{a.q}”</span>
                {!a.working && <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-[#F1F3F7] text-muted-b">{a.live ? 'Answered by Ovi (live model)' : 'Answered by Ovi (built-in analysis)'}</span>}
                <button onClick={() => setAsked((x) => x.filter((_, j) => j !== i))} className="text-muted-3 hover:text-ink text-[13px] w-6 h-6">✕</button>
              </div>
              <div className="p-5">
                {a.working ? (
                  <div className="flex flex-col gap-2 text-[13px] text-ink-3">
                    {['Reading enquiries, deals and installs', 'Working out the numbers', 'Building the chart and table'].map((s, k) => <div key={k} className="flex items-center gap-2.5"><span className="w-4 h-4 rounded-full border-2 border-[#15223B] border-t-transparent animate-spin" />{s}…</div>)}
                  </div>
                ) : a.ins && <InsightView ins={a.ins} />}
              </div>
            </section>
          ))}

          {/* built-in insights */}
          <div className="grid grid-cols-4 gap-4">
            <Kpi variant="navy" icon={Target} label="Win rate (decided deals)" value={`${t.winRate}%`} delta={`${t.signed} signed · ${t.lost} lost · ${t.open} open`} />
            <Kpi icon={Bolt} label="Average system" value={fmtK(t.avgValue)} delta={`${t.avgKwp} kWp on average`} deltaTone="muted" />
            <Kpi icon={Sun} label="Battery attach" value={`${t.batteryAttach}%`} meter={t.batteryAttach} delta="of signed homes add a battery" deltaTone="muted" />
            <Kpi variant="teal" icon={Sparkle} label="EV charger attach" value={`${t.evAttach}%`} delta="of signed homes add an EV charger" />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <Panel title="Lead sources — volume vs return" sub="Win rate and signed value by where the enquiry came from" icon={Megaphone} pad={false}>
              <div className="p-4 flex flex-col gap-4">
                <HBars data={ds.bySource.map((r) => ({ label: r.key, value: r.value, tip: `${r.enquiries} enquiries · ${r.conv}% win rate` }))} fmt={fmtK} />
                {table(ds.bySource, 'Source')}
              </div>
            </Panel>
            <Panel title="Speed through the funnel" sub="Median days between each step — where deals wait longest" icon={Clock}>
              <HBars data={ds.speed.map((r) => ({ label: r.key, value: r.days }))} fmt={(n) => `${n} days`} color="#15223B" />
              <div className="mt-4 rounded-[12px] bg-[#F7F9FB] border border-[#E6EAF0] px-4 py-3 text-[12.5px] text-ink-3">
                <b className="text-ink">Biggest wait:</b> {[...ds.speed].sort((a, b) => b.days - a.days)[0]?.key.toLowerCase()} — {[...ds.speed].sort((a, b) => b.days - a.days)[0]?.days} days median.
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <Panel title="Showrooms" sub="Enquiries handled, win rate and signed value" icon={Sun} pad={false}><div className="p-4">{table(ds.byShowroom, 'Showroom')}</div></Panel>
            <Panel title="Advisers" sub="Who converts — and where coaching would help" icon={Users} pad={false}><div className="p-4">{table(ds.byAdviser, 'Adviser')}</div></Panel>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <Panel title="System sizes signed" sub="Count and value by kWp band" icon={Bars}>
              <HBars data={ds.bySize.map((r) => ({ label: r.key, value: r.value, sub: `${r.signed}` }))} fmt={fmtK} />
            </Panel>
            <Panel title="Top postcode areas" sub="Enquiries by district — where to put leaflets and ads" icon={MapPin} pad={false}>
              <div className="p-4">{table(ds.byArea.slice(0, 8), 'Area')}</div>
            </Panel>
          </div>
          <div className={classNames('text-[11.5px] text-muted-3')}>All figures are computed live from every enquiry's journey in the CRM.</div>
        </div>
      </main>
    </>
  )
}
