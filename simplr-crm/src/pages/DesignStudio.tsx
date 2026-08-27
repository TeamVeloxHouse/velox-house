import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button } from '../components/ui'
import { Sun, Sparkle, Building, Check } from '../components/icons'
import { AiComposer } from '../components/AiChat'
import { useActions, useState_ } from '../store/store'
import { designFrom, analyseRoof, analyseRoofLive, gbp, PANEL_DIM, type SolarDesign, type RoofAnalysis, type RoofSegment } from '../lib/solar'

type DMsg = { role: 'user' | 'ai'; text: string; steps?: { label: string; done: boolean }[] }

const IMG_W = 640, IMG_H = 400, ZOOM = 20
const aspectColor = (irr: number) => (irr >= 0.92 ? '#1D4ED8' : irr >= 0.82 ? '#2E5AD8' : '#5B7FE0')

/** Split the design's panels across roof planes, best aspect first (mirrors designFrom). */
function allocate(design: SolarDesign): { seg: RoofSegment; count: number }[] {
  const ordered = [...design.segments].sort((a, b) => b.irradiance - a.irradiance)
  let left = design.panels
  return ordered.map((seg) => {
    const count = Math.min(left, seg.maxPanels)
    left -= count
    return { seg, count }
  }).filter((s) => s.count > 0)
}

/** Pack `count` panels into a w×h rect at (x,y); returns panel <rect>s. */
function packPanels(x: number, y: number, w: number, h: number, count: number, pw: number, ph: number, color: string, keyBase: string) {
  const gap = Math.max(0.6, pw * 0.08)
  const cols = Math.max(1, Math.floor((w + gap) / (pw + gap)))
  const rects = []
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols), c = i % cols
    const px = x + c * (pw + gap), py = y + r * (ph + gap)
    if (py + ph > y + h + ph) break // ran out of vertical room
    rects.push(<rect key={`${keyBase}-${i}`} x={px} y={py} width={pw} height={ph} rx={pw * 0.12} fill={color} stroke="#0b1220" strokeWidth={0.4} opacity={0.92} />)
  }
  return rects
}

export function RoofRender({ design }: { design: SolarDesign }) {
  const [imgOk, setImgOk] = useState(true)
  const alloc = allocate(design)
  const center = design.center
  const hasImagery = !!center && imgOk
  const geoPlaced = !!center && design.segments.some((s) => s.box)

  // meters-per-pixel at this centre/zoom → panel size in logical px
  const mpp = center ? (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / Math.pow(2, ZOOM) : 0.1
  const pw = Math.max(6, PANEL_DIM.w / mpp), ph = Math.max(9, PANEL_DIM.h / mpp)
  const toPx = (pt: { lat: number; lng: number }) => {
    const scale = 256 * Math.pow(2, ZOOM)
    const wx = ((pt.lng + 180) / 360) * scale
    const s = Math.sin((pt.lat * Math.PI) / 180)
    const wy = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale
    const cs = Math.sin((center!.lat * Math.PI) / 180)
    const cwx = ((center!.lng + 180) / 360) * scale
    const cwy = (0.5 - Math.log((1 + cs) / (1 - cs)) / (4 * Math.PI)) * scale
    return { x: IMG_W / 2 + (wx - cwx), y: IMG_H / 2 + (wy - cwy) }
  }

  const panels: JSX.Element[] = []
  if (geoPlaced) {
    // Place panels inside each detected roof-segment box, on the real image.
    for (const { seg, count } of alloc) {
      if (!seg.box) continue
      const a = toPx(seg.box.sw), b = toPx(seg.box.ne)
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y)
      const inset = 3
      panels.push(...packPanels(x0 + inset, y0 + inset, (x1 - x0) - inset * 2, (y1 - y0) - inset * 2, count, pw, ph, aspectColor(seg.irradiance), seg.id))
    }
  } else {
    // Stylised: one tilted plane band per segment, panels packed on each.
    const n = alloc.length || 1
    const bandW = (IMG_W - 80) / n
    alloc.forEach(({ seg, count }, i) => {
      const bx = 40 + i * bandW
      panels.push(<rect key={`bg-${seg.id}`} x={bx + 4} y={70} width={bandW - 12} height={IMG_H - 150} rx={6} fill="#38414f" opacity={0.9} />)
      panels.push(...packPanels(bx + 14, 82, bandW - 32, IMG_H - 176, count, 15, 22, aspectColor(seg.irradiance), seg.id))
    })
  }

  const imgSrc = center ? `/api/roof-image?lat=${center.lat}&lng=${center.lng}&z=${ZOOM}&size=${IMG_W}x${IMG_H}` : ''

  return (
    <div className="rounded-card overflow-hidden relative" style={{ aspectRatio: `${IMG_W}/${IMG_H}`, background: 'linear-gradient(160deg,#43506a,#2b3446)' }}>
      {hasImagery && (
        <img src={imgSrc} alt="Roof satellite view" onError={() => setImgOk(false)} className="absolute inset-0 w-full h-full object-cover" />
      )}
      {!hasImagery && (
        <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 20%, #566178, #333c4d 70%)' }}>
          <div className="absolute left-1/2 top-[54px] -translate-x-1/2 rounded-md" style={{ width: '62%', height: '58%', background: 'linear-gradient(180deg,#4a5568,#3a4250)', boxShadow: '0 20px 40px -18px rgba(0,0,0,.6)' }} />
        </div>
      )}
      <svg viewBox={`0 0 ${IMG_W} ${IMG_H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full" style={{ filter: geoPlaced ? 'drop-shadow(0 2px 3px rgba(0,0,0,.4))' : 'none' }}>
        {panels}
      </svg>
      <div className="absolute top-3 left-3 flex items-center gap-1.5 text-[11px] font-semibold text-white bg-black/45 px-2.5 py-1 rounded-full"><Sun size={13} /> {design.panels} panels · {alloc.length} plane{alloc.length === 1 ? '' : 's'}</div>
      <div className="absolute bottom-3 right-3 text-[11px] font-semibold text-white bg-black/45 px-2.5 py-1 rounded-full">{design.systemKwp} kWp</div>
      <div className="absolute bottom-3 left-3 text-[10px] font-semibold text-white px-2 py-1 rounded-full" style={{ background: hasImagery ? 'rgba(14,124,102,.8)' : 'rgba(0,0,0,.45)' }}>
        {hasImagery ? (geoPlaced ? 'Live · Google imagery' : 'Live imagery') : 'Modelled — add Google Maps key for live imagery'}
      </div>
    </div>
  )
}

export function DesignStudio() {
  const nav = useNavigate()
  const act = useActions()
  const { studioConfig } = useState_()
  const [address, setAddress] = useState('')
  const [committed, setCommitted] = useState('')
  const [analysis, setAnalysis] = useState<RoofAnalysis | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [panels, setPanels] = useState<number | undefined>(undefined)
  const [aiMsgs, setAiMsgs] = useState<DMsg[]>([])
  const aiScroll = useRef<HTMLDivElement>(null)
  useEffect(() => { aiScroll.current?.scrollTo({ top: aiScroll.current.scrollHeight, behavior: 'smooth' }) }, [aiMsgs])

  const design = analysis ? designFrom(analysis, committed, panels, studioConfig) : null

  async function run(addr: string) {
    if (!addr.trim()) return
    setAnalysing(true); setAnalysis(null); setPanels(undefined)
    const a = await analyseRoofLive(addr)
    setCommitted(addr); setAnalysis(a); setAnalysing(false)
  }

  // ---- Design with AI: single address, or batch-design from an uploaded file ----
  const sampleAddrs = ['12 Oakfield Rd, Stockport', '4 Elm Grove, Bolton', '27 Riverside Way, Warrington', '9 Hillcrest Ave, Wigan', '15 Maple Close, Salford', '3 Church Lane, Bury', '31 Victoria St, Rochdale', '8 Windsor Dr, Oldham']
  function extractAddress(t: string): string | null {
    const m = t.match(/(?:for|at|design)\s+(.+)$/i)
    const cand = (m ? m[1] : t).replace(/\bsolar\b|\bdesign\b|\bplease\b/gi, '').trim()
    return /\d/.test(cand) && cand.length > 6 ? cand : null
  }
  function askDesign(text: string) {
    const t = text.trim()
    if (!t) return
    setAiMsgs((m) => [...m, { role: 'user', text: t }])
    const fileMode = /attached file/i.test(t)

    if (fileMode) {
      const n = 6 + Math.floor(Math.random() * 3)
      const addrs = sampleAddrs.slice(0, n)
      const steps = [{ label: `Reading file — ${n} addresses found`, done: false }, ...addrs.map((a) => ({ label: `Designing ${a}`, done: false }))]
      setAiMsgs((m) => [...m, { role: 'ai', text: `Reading your file and designing all ${n} sites…`, steps }])
      let i = 0
      const tick = () => {
        setAiMsgs((m) => { const c = [...m]; const last = c[c.length - 1]; if (last.steps) last.steps[i].done = true; return c })
        if (i > 0) {
          const addr = addrs[i - 1]
          const a = analyseRoof(addr)
          const d = designFrom(a, addr, undefined, studioConfig)
          act.addDeal({ name: `Solar install — ${addr}`, org: addr, value: d.systemCost, stage: 'Demo Scheduled', subtitle: `${d.systemKwp} kWp · ${d.panels} panels`, chips: [{ label: 'Solar', tone: 'accent' }, { label: 'AI batch', tone: 'accent' }], solar: d } as any)
        }
        i += 1
        if (i < steps.length) setTimeout(tick, 550)
        else { setAiMsgs((m) => [...m, { role: 'ai', text: `✅ Done — ${n} proposals created and added to your pipeline.` }]); act.toast(`${n} proposals designed from your file`) }
      }
      setTimeout(tick, 500)
      return
    }

    const addr = extractAddress(t)
    if (addr) {
      setAiMsgs((m) => [...m, { role: 'ai', text: `Designing **${addr}** — the layout, production and price will appear below.` }])
      run(addr)
    } else {
      setAiMsgs((m) => [...m, { role: 'ai', text: `Give me a property address (e.g. “design 14 Brightleaf Way, Manchester”), or attach a CSV of addresses and I’ll design every one and create the proposals.` }])
    }
  }
  function generateProposal() {
    if (!design) return
    const d = act.addDeal({ name: `Solar install — ${design.address}`, org: design.address, value: design.systemCost, stage: 'Demo Scheduled', subtitle: `${design.systemKwp} kWp · ${design.panels} panels`, chips: [{ label: 'Solar', tone: 'accent' }, { label: `${design.billOffsetPct}% offset`, tone: 'positive' }], solar: design })
    nav(`/studio/proposal/${d.id}`)
  }

  return (
    <>
      <TopBar title="Design Studio" crumbs={['Studio', 'Instant solar design']} actions={design ? <Button variant="primary" icon={<Sparkle size={16} />} onClick={generateProposal}>Generate proposal</Button> : undefined} />
      <PageBody>
        {/* Design with TellOvi AI */}
        <div className="rounded-card border border-border-blue bg-[#FBFCFF] overflow-hidden">
          <div className="px-4 py-3 border-b border-border-blue flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-accent-gradient text-white flex items-center justify-center shadow-primary"><Sparkle size={17} /></span>
            <div className="flex-1">
              <div className="text-[13.5px] font-bold text-ink">Design with TellOvi AI</div>
              <div className="text-[12px] text-muted-2">Prompt an address, or attach a list and it designs every site and creates the proposals.</div>
            </div>
          </div>
          {aiMsgs.length > 0 && (
            <div ref={aiScroll} className="max-h-[240px] overflow-y-auto px-4 py-3 flex flex-col gap-3">
              {aiMsgs.map((m, i) => m.role === 'user' ? (
                <div key={i} className="self-end bg-accent-gradient text-white rounded-2xl rounded-tr-md px-3.5 py-2 text-[13px] max-w-[80%] shadow-primary">{m.text}</div>
              ) : (
                <div key={i} className="flex gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-accent-gradient text-white flex items-center justify-center shrink-0"><Sparkle size={13} /></span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="text-[13px] text-ink-3" dangerouslySetInnerHTML={{ __html: m.text.replace(/\*\*(.+?)\*\*/g, '<b class="text-ink font-semibold">$1</b>') }} />
                    {m.steps && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        {m.steps.map((s, si) => (
                          <div key={si} className="flex items-center gap-2 text-[12.5px]">
                            {s.done ? <span className="w-4 h-4 rounded-full bg-positive flex items-center justify-center"><Check size={10} className="text-white" strokeWidth={3} /></span> : <span className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin inline-block" />}
                            <span className={s.done ? 'text-ink-2' : 'text-muted-2'}>{s.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="p-3">
            <AiComposer onSend={askDesign} compact placeholder="e.g. design 14 Brightleaf Way, Manchester — or attach a CSV of addresses" />
            {aiMsgs.length === 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {['Design 14 Brightleaf Way, Manchester', 'Design all the addresses in my list'].map((s) => (
                  <button key={s} onClick={() => askDesign(s.includes('list') ? 'Using the attached file “sites.csv”: design all the addresses' : s)} className="text-[12px] text-accent bg-accent-wash rounded-lg px-2.5 py-1 font-medium hover:bg-[#E4ECFB]">{s}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-card p-2 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2.5 px-3 text-muted-3">
            <Building size={17} />
            <input value={address} onChange={(e) => setAddress(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run(address)} placeholder="…or enter a single property address" className="flex-1 bg-transparent outline-none text-[14px] text-ink-2 placeholder:text-muted-3 py-2" />
          </div>
          <Button variant="primary" icon={<Sun size={16} />} onClick={() => run(address)}>Design roof</Button>
        </div>

        {design && !analysing && (
          <div className="flex items-center gap-2.5 text-[12px]">
            {design.source === 'google' ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-positive bg-positive-wash px-2.5 py-1 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-positive" /> Live · Google Solar API</span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-semibold text-warning bg-warning-wash px-2.5 py-1 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-warning" /> Modelled estimate</span>
            )}
            <span className="text-muted-2">{committed}</span>
          </div>
        )}

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
            <div className="text-[13px] text-muted-b mt-1 max-w-[440px] mx-auto">Type a property address and TellOvi generates a panel layout, production estimate, savings and a live price — ready to turn into a proposal.</div>
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
