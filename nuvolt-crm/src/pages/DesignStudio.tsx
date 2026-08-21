import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button } from '../components/ui'
import { Sun, Sparkle, Building } from '../components/icons'
import { useActions } from '../store/store'
import { designFor, gbp, type SolarDesign } from '../lib/solar'

function RoofRender({ design }: { design: SolarDesign }) {
  const cols = 8
  const rows = Math.ceil(design.panels / cols)
  const maxRows = Math.ceil(design.maxPanels / cols)
  const pw = 30, ph = 20, gap = 3
  const gridW = cols * (pw + gap)
  const gridH = maxRows * (ph + gap)
  const cells = []
  for (let r = 0; r < maxRows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c
      if (idx >= design.maxPanels) continue
      const filled = idx < design.panels
      cells.push(
        <rect key={idx} x={c * (pw + gap)} y={r * (ph + gap)} width={pw} height={ph} rx={2}
          fill={filled ? '#1D4ED8' : 'none'} stroke={filled ? '#3B6BF5' : '#C3CBD8'} strokeWidth={filled ? 0.5 : 1}
          strokeDasharray={filled ? undefined : '3 2'} opacity={filled ? 1 : 0.5} />,
      )
    }
  }
  return (
    <div className="rounded-card overflow-hidden relative" style={{ aspectRatio: '16/10', background: 'linear-gradient(180deg,#dbe9ff,#eef5ff)' }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <svg viewBox={`-20 -20 ${gridW + 40} ${gridH + 60}`} className="w-[86%]" style={{ filter: 'drop-shadow(0 12px 20px rgba(11,18,32,0.25))' }}>
          <g transform="skewX(-16) translate(0 6)">
            <rect x={-12} y={-12} width={gridW + 24} height={gridH + 24} rx={6} fill="#3a4657" />
            <rect x={-12} y={-12} width={gridW + 24} height={gridH + 24} rx={6} fill="url(#roofsheen)" />
            {cells}
          </g>
          <defs>
            <linearGradient id="roofsheen" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.14" /><stop offset="1" stopColor="#000000" stopOpacity="0.12" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="absolute top-3 left-3 flex items-center gap-1.5 text-[11px] font-semibold text-white bg-black/35 px-2.5 py-1 rounded-full"><Sun size={13} /> {design.panels} panels · {rows} rows</div>
      <div className="absolute bottom-3 right-3 text-[11px] font-semibold text-white bg-black/35 px-2.5 py-1 rounded-full">{design.systemKwp} kWp</div>
    </div>
  )
}

export function DesignStudio() {
  const nav = useNavigate()
  const act = useActions()
  const [address, setAddress] = useState('')
  const [committed, setCommitted] = useState('')
  const [analysing, setAnalysing] = useState(false)
  const [panels, setPanels] = useState<number | undefined>(undefined)

  const design = committed ? designFor(committed, panels) : null

  function run(addr: string) {
    if (!addr.trim()) return
    setAnalysing(true); setCommitted(''); setPanels(undefined)
    setTimeout(() => { setCommitted(addr); setAnalysing(false) }, 1300)
  }
  function generateProposal() {
    if (!design) return
    const d = act.addDeal({ name: `Solar install — ${design.address}`, org: design.address, value: design.systemCost, stage: 'Demo Scheduled', subtitle: `${design.systemKwp} kWp · ${design.panels} panels`, chips: [{ label: 'Solar', tone: 'accent' }, { label: `${design.billOffsetPct}% offset`, tone: 'positive' }] })
    nav(`/deals/${d.id}`)
  }

  return (
    <>
      <TopBar title="Design Studio" crumbs={['Reach', 'Instant solar design']} actions={design ? <Button variant="primary" icon={<Sparkle size={16} />} onClick={generateProposal}>Generate proposal</Button> : undefined} />
      <PageBody>
        <div className="bg-surface border border-border rounded-card p-2 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2.5 px-3 text-muted-3">
            <Building size={17} />
            <input value={address} onChange={(e) => setAddress(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run(address)} placeholder="Enter a property address — e.g. 14 Brightleaf Way, Manchester" className="flex-1 bg-transparent outline-none text-[14px] text-ink-2 placeholder:text-muted-3 py-2" />
          </div>
          <Button variant="primary" icon={<Sun size={16} />} onClick={() => run(address)}>Design roof</Button>
        </div>

        {analysing && (
          <div className="bg-surface border border-border rounded-card p-10 flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-[3px] border-accent border-t-transparent animate-spin" />
            <div className="text-[14px] font-semibold text-ink-2">Analysing the roof…</div>
            <div className="text-[12.5px] text-muted-b">Reading aerial imagery, detecting roof planes, modelling shading &amp; production.</div>
          </div>
        )}

        {!analysing && !design && (
          <div className="bg-surface border border-border rounded-card p-10 text-center">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center" style={{ background: '#FDF2E2', color: '#A85B00' }}><Sun size={24} /></div>
            <div className="text-[16px] font-bold text-ink mt-3">Address in, solar design out</div>
            <div className="text-[13px] text-muted-b mt-1 max-w-[440px] mx-auto">Type a property address and Simplr generates a panel layout, production estimate, savings and a live price — ready to turn into a proposal.</div>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {['14 Brightleaf Way, Manchester', '8 Meridian Road, Leeds', 'Unit 4, Harbour Estate, Hull'].map((s) => (
                <button key={s} onClick={() => { setAddress(s); run(s) }} className="text-[12.5px] text-accent bg-accent-wash rounded-lg px-3 py-1.5 font-medium hover:bg-[#E4ECFB]">{s}</button>
              ))}
            </div>
          </div>
        )}

        {design && !analysing && (
          <div className="grid gap-4" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
            <div className="flex flex-col gap-4">
              <RoofRender design={design} />
              <div className="bg-surface border border-border rounded-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[14px] font-semibold text-ink">System size</div>
                  <div className="text-[12px] text-muted-2">{design.panels} of {design.maxPanels} usable panels</div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setPanels(Math.max(4, design.panels - 1))} className="w-9 h-9 rounded-lg border border-border text-ink-3 hover:bg-control text-[18px] leading-none">−</button>
                  <input type="range" min={4} max={design.maxPanels} value={design.panels} onChange={(e) => setPanels(Number(e.target.value))} className="flex-1 accent-[#1D4ED8]" />
                  <button onClick={() => setPanels(Math.min(design.maxPanels, design.panels + 1))} className="w-9 h-9 rounded-lg border border-border text-ink-3 hover:bg-control text-[18px] leading-none">+</button>
                  <div className="text-[15px] font-bold text-ink-2 w-20 text-right">{design.systemKwp} kWp</div>
                </div>
              </div>
              <div className="bg-surface border border-border rounded-card p-4">
                <div className="text-[13px] font-semibold text-ink mb-2.5">Roof planes detected</div>
                <div className="flex flex-col gap-2">
                  {design.segments.map((s) => (
                    <div key={s.id} className="flex items-center gap-2.5 text-[13px]">
                      <span className="w-6 h-6 rounded-md bg-accent-wash text-accent flex items-center justify-center shrink-0"><Sun size={13} /></span>
                      <span className="text-ink-2 flex-1">{s.label}</span>
                      <span className="text-muted-2">{s.pitch}° pitch · {s.maxPanels} panels · {Math.round(s.irradiance * 100)}% sun</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-card p-5 text-white" style={{ background: 'linear-gradient(155deg,#1c3a72,#0c1b38)' }}>
                <div className="text-[12px]" style={{ color: '#93A0B4' }}>Estimated annual savings</div>
                <div className="text-[34px] font-bold mt-1">{gbp(design.annualSavings)}<span className="text-[16px] font-medium" style={{ color: '#8FB0FF' }}>/yr</span></div>
                <div className="text-[12.5px] mt-1" style={{ color: '#8FB0FF' }}>{design.billOffsetPct}% of a typical electricity bill offset</div>
                <div className="h-2 rounded-full bg-white/15 overflow-hidden mt-3"><div className="h-full rounded-full" style={{ width: `${design.billOffsetPct}%`, background: 'linear-gradient(90deg,#F5A623,#E8721A)' }} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="System size" value={`${design.systemKwp} kWp`} sub={`${design.panels} × ${design.panelWatts}W`} />
                <Stat label="Annual production" value={`${design.annualProduction.toLocaleString()} kWh`} sub={`${design.specificYield} kWh/kWp`} />
                <Stat label="Payback" value={`${design.payback} yrs`} sub="At current rates" />
                <Stat label="CO₂ saved" value={`${design.co2PerYear} t/yr`} sub="Per year" />
              </div>
              <div className="bg-surface border border-border rounded-card p-5">
                <div className="text-[14px] font-semibold text-ink mb-3">Price</div>
                <div className="flex items-center justify-between py-1.5"><span className="text-[13px] text-muted-b">System &amp; installation</span><span className="text-[13px] font-semibold text-ink-2">{gbp(design.systemCost)}</span></div>
                <div className="flex items-center justify-between py-1.5"><span className="text-[13px] text-muted-b">VAT (0% on domestic solar)</span><span className="text-[13px] font-semibold text-positive">£0</span></div>
                <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-divider">
                  <span className="text-[14px] font-bold text-ink">Total</span>
                  <span className="text-[20px] font-bold text-ink">{gbp(design.systemCost)}</span>
                </div>
                <div className="text-[12px] text-muted-2 mt-1.5">or from {gbp(Math.round(design.systemCost / 120))}/mo over 10 yrs · <span className="text-accent font-medium">finance in Phase 3</span></div>
              </div>
              <div className="text-[12px] text-muted-3 leading-relaxed">Estimates from a modelled roof. Wire the Google Solar API + PVWatts for measured, install-grade accuracy.</div>
            </div>
          </div>
        )}
      </PageBody>
    </>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (<div className="bg-surface border border-border rounded-card p-4"><div className="text-[12px] text-muted-2">{label}</div><div className="text-[19px] font-bold text-ink mt-0.5">{value}</div><div className="text-[11.5px] text-muted-3 mt-0.5">{sub}</div></div>)
}
