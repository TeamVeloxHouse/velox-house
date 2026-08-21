import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Chip } from '../components/ui'
import { Sun, Sparkle, Check, Send, Play, File } from '../components/icons'
import { useSelectors, useActions } from '../store/store'
import { designFrom, gbp, type RoofAnalysis } from '../lib/solar'
import { RoofRender } from './DesignStudio'

const inclusions = [
  'Tier-1 monocrystalline panels · 25-year product warranty',
  'Hybrid inverter with app monitoring',
  'Full design, scaffolding, install & commissioning',
  'DNO application & MCS certification',
  '30-year performance warranty · 0% VAT',
]

function SavingsChart({ annual, cost, payback }: { annual: number; cost: number; payback: number }) {
  const years = 25
  const W = 460, H = 170, pad = 4
  const pts: [number, number][] = []
  let cum = 0
  const series: number[] = []
  for (let y = 0; y <= years; y++) { series.push(cum); cum += Math.round(annual * Math.pow(0.995, y)) }
  const max = series[series.length - 1]
  series.forEach((v, y) => pts.push([pad + (y / years) * (W - pad * 2), H - pad - (v / max) * (H - pad * 2)]))
  const area = `M ${pts[0][0]} ${H - pad} ` + pts.map((p) => `L ${p[0]} ${p[1]}`).join(' ') + ` L ${pts[pts.length - 1][0]} ${H - pad} Z`
  const line = `M ` + pts.map((p) => `${p[0]} ${p[1]}`).join(' L ')
  const costY = H - pad - (Math.min(cost, max) / max) * (H - pad * 2)
  const pbX = pad + (payback / years) * (W - pad * 2)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs><linearGradient id="sav" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0E7C66" stopOpacity="0.28" /><stop offset="1" stopColor="#0E7C66" stopOpacity="0.02" /></linearGradient></defs>
      <path d={area} fill="url(#sav)" />
      <path d={line} fill="none" stroke="#0E7C66" strokeWidth="2" />
      {/* system cost line */}
      <line x1={pad} y1={costY} x2={W - pad} y2={costY} stroke="#C2410C" strokeWidth="1" strokeDasharray="4 3" />
      <text x={W - pad} y={costY - 4} textAnchor="end" fontSize="9" fill="#C2410C" fontWeight="600">System cost {gbp(cost)}</text>
      {/* payback marker */}
      <line x1={pbX} y1={pad} x2={pbX} y2={H - pad} stroke="#1D4ED8" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
      <circle cx={pbX} cy={costY} r="3.5" fill="#1D4ED8" />
      <text x={pbX + 5} y={pad + 12} fontSize="9" fill="#1D4ED8" fontWeight="600">Break-even ≈ yr {Math.round(payback)}</text>
    </svg>
  )
}

export function Proposal() {
  const { id } = useParams()
  const nav = useNavigate()
  const sel = useSelectors()
  const act = useActions()
  const deal = sel.dealById(id)
  const [panels, setPanels] = useState<number | undefined>(undefined)

  if (!deal || !deal.solar) {
    return (<><TopBar title="Proposal" /><PageBody><div className="text-muted-b">No proposal for this deal. <button onClick={() => nav('/reach/design')} className="text-accent font-semibold">Design one →</button></div></PageBody></>)
  }

  const base = deal.solar
  const analysis: RoofAnalysis = { segments: base.segments, usableArea: base.usableArea, specificYield: base.specificYield, maxPanels: base.maxPanels, panelWatts: base.panelWatts, source: base.source }
  const design = designFrom(analysis, base.address, panels ?? base.panels)

  function persist(next: number) {
    setPanels(next)
    const d = designFrom(analysis, base.address, next)
    act.updateDeal(deal!.id, { solar: d, value: d.systemCost, subtitle: `${d.systemKwp} kWp · ${d.panels} panels` })
  }
  function accept() {
    act.markWon(deal!.id, deal!.name)
    act.toast('Proposal accepted — deal won 🎉')
    nav(`/deals/${deal!.id}`)
  }

  return (
    <>
      <TopBar
        title="Proposal"
        crumbs={[deal.org]}
        actions={
          <>
            <Button icon={<Play size={16} />} onClick={() => act.toast('Present mode (demo)', 'accent')}>Present</Button>
            <Button icon={<File size={16} />} onClick={() => act.toast('PDF generated (demo)')}>PDF</Button>
            <Button variant="primary" icon={<Send size={16} />} onClick={() => act.toast(`Sent to ${deal.org} for e-signature`)}>Send for signature</Button>
          </>
        }
      />
      <PageBody>
        {/* hero */}
        <div className="rounded-card p-6 text-white relative overflow-hidden" style={{ background: 'linear-gradient(150deg,#1c3a72,#0c1b38)' }}>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 100% at 90% -10%, rgba(245,166,35,0.22), transparent 55%)' }} />
          <div className="relative flex items-end justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: '#F5B85C' }}><Sun size={14} /> YOUR SOLAR PROPOSAL</div>
              <div className="text-[24px] font-bold mt-1.5">{base.address}</div>
              <div className="text-[13px] mt-1" style={{ color: '#c3ccdb' }}>{design.systemKwp} kWp · {design.panels} panels · {design.annualProduction.toLocaleString()} kWh/yr{base.source === 'google' && ' · Google Solar verified'}</div>
            </div>
            <div className="text-right">
              <div className="text-[12px]" style={{ color: '#93A0B4' }}>Lifetime savings (25 yrs)</div>
              <div className="text-[34px] font-bold" style={{ color: '#8FE0C6' }}>{gbp(design.lifetimeSavings)}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: '1.25fr 1fr' }}>
          <div className="flex flex-col gap-4">
            <RoofRender design={design} />
            <div className="bg-surface border border-border rounded-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[14px] font-semibold text-ink">Tune the system live</div>
                <div className="text-[12px] text-muted-2">{design.panels} of {design.maxPanels} panels</div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => persist(Math.max(4, design.panels - 1))} className="w-9 h-9 rounded-lg border border-border text-ink-3 hover:bg-control text-[18px] leading-none">−</button>
                <input type="range" min={4} max={design.maxPanels} value={design.panels} onChange={(e) => persist(Number(e.target.value))} className="flex-1 accent-[#1D4ED8]" />
                <button onClick={() => persist(Math.min(design.maxPanels, design.panels + 1))} className="w-9 h-9 rounded-lg border border-border text-ink-3 hover:bg-control text-[18px] leading-none">+</button>
                <div className="text-[15px] font-bold text-ink-2 w-20 text-right">{design.systemKwp} kWp</div>
              </div>
            </div>
            <div className="bg-surface border border-border rounded-card p-5">
              <div className="text-[14px] font-semibold text-ink mb-3">What’s included</div>
              <div className="flex flex-col gap-2">
                {inclusions.map((x) => (<div key={x} className="flex items-start gap-2.5 text-[13px] text-ink-2"><Check size={15} className="text-positive shrink-0 mt-0.5" />{x}</div>))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-card p-5 text-white" style={{ background: 'linear-gradient(155deg,#0E7C66,#0a5c4c)' }}>
              <div className="text-[12px]" style={{ color: '#cfeee6' }}>You’ll save about</div>
              <div className="text-[32px] font-bold mt-1">{gbp(design.annualSavings)}<span className="text-[15px] font-medium">/yr</span></div>
              <div className="text-[12.5px] mt-0.5" style={{ color: '#cfeee6' }}>{design.billOffsetPct}% of your electricity bill · pays back in {design.payback} years</div>
            </div>
            <div className="bg-surface border border-border rounded-card p-5">
              <div className="text-[14px] font-semibold text-ink mb-2">Cumulative savings vs cost</div>
              <SavingsChart annual={design.annualSavings} cost={design.systemCost} payback={design.payback} />
            </div>
            <div className="bg-surface border border-border rounded-card p-5">
              <div className="flex items-center justify-between py-1"><span className="text-[13px] text-muted-b">System &amp; installation</span><span className="text-[13px] font-semibold text-ink-2">{gbp(design.systemCost)}</span></div>
              <div className="flex items-center justify-between py-1"><span className="text-[13px] text-muted-b">VAT (0% on domestic solar)</span><span className="text-[13px] font-semibold text-positive">£0</span></div>
              <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-divider"><span className="text-[15px] font-bold text-ink">Total</span><span className="text-[22px] font-bold text-ink">{gbp(design.systemCost)}</span></div>
              <div className="mt-2 rounded-lg bg-accent-wash-3 border border-[#D3E0FA] px-3 py-2 text-[12.5px] text-accent-700 flex items-center gap-2"><Sparkle size={14} /> Or from <b>{gbp(Math.round(design.systemCost / 120))}/mo</b> · finance options land in Phase 3</div>
            </div>
            <div className="bg-surface border-2 border-positive-border rounded-card p-5 text-center">
              <div className="text-[14px] font-semibold text-ink">Ready to go solar?</div>
              <div className="text-[12.5px] text-muted-b mt-0.5 mb-3">Accept to lock in this price and book your survey.</div>
              <Button variant="primary" color="#0E7C66" icon={<Check size={16} />} className="w-full justify-center" onClick={accept}>Accept &amp; sign</Button>
            </div>
          </div>
        </div>
      </PageBody>
    </>
  )
}
