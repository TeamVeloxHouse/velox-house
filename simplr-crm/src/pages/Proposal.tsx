import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Button, Chip } from '../components/ui'
import { Sun, Sparkle, Check, Send, Play, File as FileIcon, ChevronDown, Camera, Upload, Bolt, Lock, Star } from '../components/icons'
import { useSelectors, useActions, useState_ } from '../store/store'
import { designFrom, gbp, monthlyPayment, type RoofAnalysis, type SolarDesign } from '../lib/solar'
import { generateMockup } from '../lib/mockup'
import { RoofRender } from './DesignStudio'
import { classNames } from '../lib/format'

const inclusions = [
  'Tier-1 monocrystalline panels · 25-year product warranty',
  'Hybrid inverter with app monitoring',
  'Full design, scaffolding, install & commissioning',
  'DNO application & MCS certification',
  '30-year performance warranty · 0% VAT',
]

const motivations = [
  {
    icon: <Bolt size={18} />, title: 'Stop renting your electricity', stat: '+64% since 2021',
    blurb: 'Grid prices have climbed relentlessly and show no sign of stopping.',
    more: 'The average UK household now pays significantly more for electricity than five years ago, and price caps have moved upward far more often than down. Every panel on your roof is a fixed-price kWh you never have to buy again — the system pays the same whether the market goes up 5% or 50% next winter.',
  },
  {
    icon: <Lock size={18} />, title: 'Energy independence', stat: 'Generate your own',
    blurb: 'Less exposure to suppliers, price shocks, and grid outages.',
    more: "With a hybrid inverter and (optionally) a battery, your home can keep running on power you made yourself — during the day from the sun, and increasingly through the evening from storage. It's not full off-grid living, but it materially reduces how much of your life depends on someone else's pricing decisions.",
  },
  {
    icon: <Star size={18} />, title: 'Adds to your home\'s value', stat: 'Buyers notice it',
    blurb: 'Solar + a strong EPC rating is increasingly a selling point, not a curiosity.',
    more: 'As energy costs stay front-of-mind for buyers, a home with solar already installed — with a track record of low bills — is a tangible, provable asset in a sale, not just a nice-to-have. It also nudges your EPC rating up, which is starting to matter for mortgage terms too.',
  },
  {
    icon: <Sun size={18} />, title: 'Lower carbon footprint', stat: `${'~'}1.3 t CO₂/yr per home avg.`,
    blurb: 'A meaningful, measurable cut with no change to how you live.',
    more: 'Displacing grid electricity (still substantially fossil-generated at peak times) with your own solar is one of the few home upgrades that pays you back financially and reduces your footprint at the same time — no behaviour change required.',
  },
]

const techSpecs: { group: string; rows: [string, string][] }[] = [
  { group: 'Panels', rows: [
    ['Type', 'Tier-1 monocrystalline PERC, half-cut cell'],
    ['Efficiency', '21.5–22.8%'],
    ['Product warranty', '25 years'],
    ['Performance warranty', '30 years · ≥87% output at year 30'],
    ['Wind / snow rating', 'Certified to UK building-standard loads'],
  ] },
  { group: 'Inverter', rows: [
    ['Type', 'Hybrid, battery-ready'],
    ['Monitoring', 'Live generation + consumption in-app'],
    ['Warranty', '10 years, extendable to 20'],
    ['Export limiting', 'DNO-compliant, configured at commissioning'],
  ] },
  { group: 'Installation & certification', rows: [
    ['Standard', 'MCS-certified installation and design'],
    ['Grid approval', 'DNO application handled for you (G98/G99)'],
    ['Scaffolding', 'Included, fully insured'],
    ['Typical timeline', '1–2 days on-roof, 4–8 weeks end-to-end incl. DNO'],
  ] },
]

const faqs: [string, string][] = [
  ['What if it\'s cloudy or winter?', 'Panels still generate on overcast days — output drops but doesn\'t stop. The annual production figure in this proposal already accounts for the UK\'s real weather across a full year, not a sunny-day best case.'],
  ['Does this affect my roof warranty?', 'Our installers are MCS-certified and the mounting method is designed not to void standard roof warranties. Where a manufacturer requires it, we\'ll flag it during survey before any work starts.'],
  ['What happens if I move house?', 'Solar is a genuine asset transfer — most buyers see it as a selling point, and the system (plus remaining warranty) simply transfers with the property.'],
  ['What maintenance does it need?', 'Very little. An annual visual check and occasional panel clean is normally enough — no moving parts to wear out. Monitoring alerts you automatically if output ever looks off.'],
  ['Can I add a battery later?', 'Yes — the inverter quoted here is battery-ready, so storage can be added on as a later upgrade without replacing the core system.'],
]

const salesNotes: Record<string, string> = {
  cover: 'Open with confidence — this is what their home will actually look like with panels on.',
  why: 'Let them tell you what matters most (bills, independence, resale, green) — then lean into that motivation for the rest of the call.',
  home: 'If they push back on panel count, use the live slider — show the size/saving trade-off in real time rather than arguing the number.',
  savings: 'Ask for last month\'s bill here if they have it to hand — a real number beats an estimate and moves faster to yes.',
  included: 'Objections about "what if it breaks" land here — point straight at the 25/30-year warranties.',
  investment: 'Anchor on the monthly figure, not the headline total, if finance is on the table.',
  faq: 'Cloudy-day and moving-house are the two most common objections — you\'ve already pre-empted them here.',
  accept: 'Go quiet after this button. Let them sign.',
}

const sections: { id: string; label: string }[] = [
  { id: 'cover', label: 'Overview' },
  { id: 'why', label: 'Why solar' },
  { id: 'home', label: 'Your home & design' },
  { id: 'savings', label: 'Savings & payback' },
  { id: 'included', label: "What's included" },
  { id: 'investment', label: 'Investment & finance' },
  { id: 'faq', label: 'Questions' },
  { id: 'accept', label: 'Accept' },
]

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

function Disclosure({ title, right, defaultOpen, children }: { title: ReactNode; right?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-control transition-colors">
        <span className="text-[13.5px] font-semibold text-ink-2">{title}</span>
        <div className="flex items-center gap-2 shrink-0">
          {right}
          <ChevronDown size={15} className={classNames('text-muted-3 transition-transform', open && 'rotate-180')} />
        </div>
      </button>
      {open && <div className="px-4 pb-4 pt-0.5 text-[13px] text-muted-b leading-relaxed">{children}</div>}
    </div>
  )
}

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
      <line x1={pad} y1={costY} x2={W - pad} y2={costY} stroke="#C2410C" strokeWidth="1" strokeDasharray="4 3" />
      <text x={W - pad} y={costY - 4} textAnchor="end" fontSize="9" fill="#C2410C" fontWeight="600">System cost {gbp(cost)}</text>
      <line x1={pbX} y1={pad} x2={pbX} y2={H - pad} stroke="#13927B" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
      <circle cx={pbX} cy={costY} r="3.5" fill="#13927B" />
      <text x={pbX + 5} y={pad + 12} fontSize="9" fill="#13927B" fontWeight="600">Break-even ≈ yr {Math.round(payback)}</text>
    </svg>
  )
}

export function Proposal() {
  const { id } = useParams()
  const nav = useNavigate()
  const sel = useSelectors()
  const act = useActions()
  const { studioConfig } = useState_()
  const deal = sel.dealById(id)
  const [panels, setPanels] = useState<number | undefined>(undefined)
  const [activeId, setActiveId] = useState('cover')
  const [mockupStage, setMockupStage] = useState<'idle' | 'pin' | 'photo' | 'render' | 'done'>('idle')
  const [billInput, setBillInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const headingRef = useRef(0)

  const base = deal?.solar
  const analysis: RoofAnalysis | null = base ? { segments: base.segments, usableArea: base.usableArea, specificYield: base.specificYield, maxPanels: base.maxPanels, panelWatts: base.panelWatts, source: base.source } : null
  const design: SolarDesign | null = analysis ? designFrom(analysis, base!.address, panels ?? base!.panels, studioConfig) : null

  async function runMockup(force?: boolean) {
    if (!deal || !design) return
    if (!force && deal.mockupImage) return
    setMockupStage('pin'); await sleep(550)
    setMockupStage('photo'); await sleep(450)
    const { dataUrl, source } = await generateMockup(design, force ? headingRef.current : undefined)
    headingRef.current = (headingRef.current + 90) % 360
    setMockupStage('render'); await sleep(350)
    act.updateDeal(deal.id, { mockupImage: dataUrl, mockupSource: source })
    setMockupStage('done')
  }

  useEffect(() => {
    if (deal && design && !deal.mockupImage && mockupStage === 'idle') void runMockup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal?.id])

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) setActiveId(visible[0].target.id)
    }, { root, rootMargin: '-15% 0px -70% 0px', threshold: 0 })
    sections.forEach((s) => { const el = sectionRefs.current[s.id]; if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, [deal?.id])

  if (!deal || !base || !design) {
    return (<><TopBar title="Proposal" /><div className="flex-1 flex items-center justify-center text-muted-b">No proposal for this deal. {deal && <button onClick={() => nav(`/studio/design?deal=${deal.id}&addr=${encodeURIComponent(deal.org || deal.name)}`)} className="text-accent font-semibold ml-1">Design one →</button>}</div></>)
  }

  function persist(next: number) {
    setPanels(next)
    const d = designFrom(analysis!, base!.address, next, studioConfig)
    act.updateDeal(deal!.id, { solar: d, value: d.systemCost, subtitle: `${d.systemKwp} kWp · ${d.panels} panels` })
  }
  function accept() {
    act.markWon(deal!.id, deal!.name)
    act.toast('Proposal accepted — deal won 🎉')
    nav(`/deals/${deal!.id}`)
  }
  function saveBill() {
    const n = Number(billInput.replace(/[^\d.]/g, ''))
    if (!n) return
    act.updateDeal(deal!.id, { energyBill: { annualCost: n, addedAt: Date.now() } })
    act.toast('Bill saved — savings estimate updated')
  }
  function onBillFile(f: File | undefined) {
    if (!f) return
    act.updateDeal(deal!.id, { energyBill: { ...(deal!.energyBill || { addedAt: Date.now() }), fileName: f.name, addedAt: Date.now() } })
    act.toast(`${f.name} attached to this proposal`)
  }

  function goTo(id: string) {
    const el = sectionRefs.current[id]
    if (el && scrollRef.current) scrollRef.current.scrollTo({ top: el.offsetTop - 24, behavior: 'smooth' })
  }

  const realBillSaving = deal.energyBill?.annualCost ? Math.round(deal.energyBill.annualCost * (design.billOffsetPct / 100)) : null
  const mockupBusy = mockupStage !== 'idle' && mockupStage !== 'done'
  const stageLabel = { pin: 'Dropping a pin on your address…', photo: 'Capturing the front of your home…', render: 'Placing panels on your roof…' }[mockupStage as 'pin' | 'photo' | 'render']

  return (
    <>
      <TopBar
        title="Proposal"
        crumbs={[deal.org]}
        actions={
          <>
            <Button icon={<Play size={16} />} onClick={() => act.toast('Present mode (demo)', 'accent')}>Present</Button>
            <Button icon={<FileIcon size={16} />} onClick={() => act.toast('PDF generated (demo)')}>PDF</Button>
            <Button variant="primary" icon={<Send size={16} />} onClick={() => act.toast(`Sent to ${deal.org} for e-signature`)}>Send for signature</Button>
          </>
        }
      />
      <div className="flex-1 flex min-h-0">
        {/* Sales sidebar — table of contents + live coaching notes, not shown to the customer view */}
        <aside className="w-[248px] shrink-0 border-r border-border bg-canvas flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-divider">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-3">Prepared for</div>
            <div className="text-[14px] font-bold text-ink mt-0.5 truncate">{deal.org}</div>
            <div className="text-[12px] text-muted-2 truncate">{base.address}</div>
          </div>
          <nav className="p-2.5 flex flex-col gap-0.5">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => goTo(s.id)}
                className={classNames(
                  'text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-colors',
                  activeId === s.id ? 'bg-accent-wash text-accent font-semibold' : 'text-muted-b hover:bg-control hover:text-ink-2'
                )}
              >
                {s.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto p-3.5 m-2.5 rounded-lg bg-surface border border-border">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-accent uppercase tracking-wide"><Sparkle size={13} /> Sales note</div>
            <div className="text-[12.5px] text-muted-b leading-snug mt-1.5">{salesNotes[activeId]}</div>
          </div>
        </aside>

        {/* Scrollable proposal — the "interactive PDF" */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-[820px] mx-auto px-8 py-10 flex flex-col gap-16">

            {/* COVER */}
            <section id="cover" ref={(el) => { sectionRefs.current.cover = el }} className="scroll-mt-6">
              <div className="rounded-card overflow-hidden relative text-white" style={{ background: 'linear-gradient(150deg,#15223B,#0A3B33)', minHeight: 420 }}>
                {deal.mockupImage && (
                  <img src={deal.mockupImage} alt="Solar mockup of the property" className="absolute inset-0 w-full h-full object-cover opacity-90" />
                )}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,15,30,0.15) 0%, rgba(8,12,24,0.55) 60%, rgba(8,12,24,0.85) 100%)' }} />
                {mockupBusy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#0b1424]/70">
                    <div className="flex flex-col items-center gap-3 text-center px-6">
                      <div className="w-8 h-8 rounded-full border-2 border-white/25 border-t-white animate-spin" />
                      <div className="text-[13px] font-medium text-white/90">{stageLabel}</div>
                    </div>
                  </div>
                )}
                <div className="relative flex flex-col justify-end h-full min-h-[420px] p-7">
                  <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: '#F5B85C' }}><Sun size={14} /> YOUR SOLAR PROPOSAL</div>
                  <div className="text-[28px] font-bold mt-1.5 max-w-[70%]">{base.address}</div>
                  <div className="text-[13px] mt-1" style={{ color: '#c3ccdb' }}>{design.systemKwp} kWp · {design.panels} panels · {design.annualProduction.toLocaleString()} kWh/yr{base.source === 'google' && ' · Google Solar verified'}</div>
                  <div className="flex items-end justify-between mt-5 flex-wrap gap-4">
                    <div className="flex gap-6">
                      <div><div className="text-[11px]" style={{ color: '#93A0B4' }}>You'll save</div><div className="text-[22px] font-bold" style={{ color: '#8FE0C6' }}>{gbp(design.annualSavings)}/yr</div></div>
                      <div><div className="text-[11px]" style={{ color: '#93A0B4' }}>Lifetime (25yr)</div><div className="text-[22px] font-bold" style={{ color: '#8FE0C6' }}>{gbp(design.lifetimeSavings)}</div></div>
                    </div>
                    <button onClick={() => runMockup(true)} disabled={mockupBusy} className="text-[12px] font-semibold text-white/80 hover:text-white flex items-center gap-1.5 disabled:opacity-40">
                      <Camera size={14} /> {deal.mockupImage ? 'Try another angle' : 'Generate mockup'}
                    </button>
                  </div>
                </div>
              </div>
              {deal.mockupSource && (
                <div className="text-[11px] text-muted-3 mt-2">
                  {deal.mockupSource === 'streetview' ? 'Real street-level photo of this address, with a stylised preview of panel placement.' : "No street imagery was available for this address — showing an illustrated preview instead."}
                </div>
              )}
            </section>

            {/* WHY SOLAR */}
            <section id="why" ref={(el) => { sectionRefs.current.why = el }} className="scroll-mt-6 flex flex-col gap-4">
              <div>
                <div className="text-[12px] font-semibold text-accent uppercase tracking-wide">Why solar</div>
                <div className="text-[22px] font-bold text-ink mt-1">What this means for you</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {motivations.map((m) => (
                  <div key={m.title} className="bg-surface border border-border rounded-card p-4 flex flex-col gap-1.5">
                    <div className="w-8 h-8 rounded-lg bg-accent-wash text-accent flex items-center justify-center">{m.icon}</div>
                    <div className="text-[13.5px] font-semibold text-ink mt-1">{m.title}</div>
                    <div className="text-[11.5px] font-bold text-accent">{m.stat}</div>
                    <div className="text-[12.5px] text-muted-b leading-snug">{m.blurb}</div>
                    <details className="mt-1 group">
                      <summary className="text-[11.5px] font-semibold text-accent cursor-pointer list-none flex items-center gap-1 select-none">Learn more <ChevronDown size={12} className="group-open:rotate-180 transition-transform" /></summary>
                      <div className="text-[12px] text-muted-b leading-relaxed mt-1.5">{m.more}</div>
                    </details>
                  </div>
                ))}
              </div>
            </section>

            {/* HOME & DESIGN */}
            <section id="home" ref={(el) => { sectionRefs.current.home = el }} className="scroll-mt-6 flex flex-col gap-4">
              <div>
                <div className="text-[12px] font-semibold text-accent uppercase tracking-wide">Your home</div>
                <div className="text-[22px] font-bold text-ink mt-1">The system, on your roof</div>
              </div>
              <RoofRender design={design} />
              <div className="bg-surface border border-border rounded-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[14px] font-semibold text-ink">Tune the system live</div>
                  <div className="text-[12px] text-muted-2">{design.panels} of {design.maxPanels} panels</div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => persist(Math.max(4, design.panels - 1))} className="w-9 h-9 rounded-lg border border-border text-ink-3 hover:bg-control text-[18px] leading-none">−</button>
                  <input type="range" min={4} max={design.maxPanels} value={design.panels} onChange={(e) => persist(Number(e.target.value))} className="flex-1 accent-[#13927B]" />
                  <button onClick={() => persist(Math.min(design.maxPanels, design.panels + 1))} className="w-9 h-9 rounded-lg border border-border text-ink-3 hover:bg-control text-[18px] leading-none">+</button>
                  <div className="text-[15px] font-bold text-ink-2 w-20 text-right">{design.systemKwp} kWp</div>
                </div>
              </div>
              <Disclosure title="How we designed this">
                <div className="flex flex-col gap-1.5">
                  <div>Source: <b>{base.source === 'google' ? 'Google Solar API (measured from satellite + LIDAR)' : 'Modelled from roof segments you drew'}</b></div>
                  <div>{design.segments.length} roof {design.segments.length === 1 ? 'plane' : 'planes'} analysed for pitch, orientation and shading.</div>
                  {design.region && <div>Regional irradiance dataset: {design.region}</div>}
                  <div>Production estimated under MCS MIS 3002 methodology (kWp × specific yield × orientation/shade factor).</div>
                </div>
              </Disclosure>
            </section>

            {/* SAVINGS */}
            <section id="savings" ref={(el) => { sectionRefs.current.savings = el }} className="scroll-mt-6 flex flex-col gap-4">
              <div>
                <div className="text-[12px] font-semibold text-accent uppercase tracking-wide">Savings & payback</div>
                <div className="text-[22px] font-bold text-ink mt-1">What you'll save</div>
              </div>
              <div className="rounded-card p-5 text-white" style={{ background: 'linear-gradient(155deg,#0E7C66,#0a5c4c)' }}>
                <div className="text-[12px]" style={{ color: '#cfeee6' }}>You'll save about</div>
                <div className="text-[32px] font-bold mt-1">{gbp(design.annualSavings)}<span className="text-[15px] font-medium">/yr</span></div>
                <div className="text-[12.5px] mt-0.5" style={{ color: '#cfeee6' }}>{design.billOffsetPct}% of your electricity bill · pays back in {design.payback} years</div>
              </div>
              <div className="bg-surface border border-border rounded-card p-5">
                <div className="text-[14px] font-semibold text-ink mb-2">Cumulative savings vs cost</div>
                <SavingsChart annual={design.annualSavings} cost={design.systemCost} payback={design.payback} />
              </div>

              {/* Energy bill workflow */}
              <div className="bg-surface border border-border rounded-card p-5">
                <div className="text-[14px] font-semibold text-ink mb-1">Get your exact figure</div>
                <div className="text-[12.5px] text-muted-b mb-3">Tell us what you actually pay and we'll base your saving on that, not a model.</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 bg-control rounded-lg px-2.5 h-9 border border-border">
                    <span className="text-[13px] text-muted-2">£</span>
                    <input value={billInput} onChange={(e) => setBillInput(e.target.value)} placeholder="e.g. 1450" className="bg-transparent outline-none text-[13px] w-24 text-ink" />
                    <span className="text-[12px] text-muted-3">/yr</span>
                  </div>
                  <Button onClick={saveBill}>Save</Button>
                  <label className="h-9 px-3.5 rounded-control border border-border text-[13px] text-muted-b flex items-center gap-2 cursor-pointer hover:bg-control">
                    <Upload size={14} /> Attach bill (optional)
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => onBillFile(e.target.files?.[0])} />
                  </label>
                  {deal.energyBill?.fileName && <Chip tone="positive">{deal.energyBill.fileName}</Chip>}
                </div>
                {realBillSaving !== null && (
                  <div className="mt-3 text-[13px] text-ink-2 bg-accent-wash rounded-lg px-3 py-2.5">
                    Based on your <b>{gbp(deal.energyBill!.annualCost!)}/yr</b> bill, you're on track to save about <b>{gbp(realBillSaving)}/yr</b> — that's a real figure, not the modelled estimate above.
                  </div>
                )}
              </div>
              <Disclosure title="How we calculate this">
                <div className="flex flex-col gap-1.5">
                  <div>Self-consumption modelled per MCS MGD 003 against a {design.occupancy || 'typical'} occupancy profile{design.annualDemand ? ` (~${design.annualDemand.toLocaleString()} kWh/yr demand)` : ''}.</div>
                  <div>Import rate ~28p/kWh, export (SEG) ~15p/kWh — your supplier's actual tariff may vary this.</div>
                  <div>25-year projection assumes ~0.5%/yr panel degradation, no allowance for future tariff inflation (which would improve the figure further).</div>
                </div>
              </Disclosure>
            </section>

            {/* WHAT'S INCLUDED */}
            <section id="included" ref={(el) => { sectionRefs.current.included = el }} className="scroll-mt-6 flex flex-col gap-4">
              <div>
                <div className="text-[12px] font-semibold text-accent uppercase tracking-wide">Whatʼs included</div>
                <div className="text-[22px] font-bold text-ink mt-1">Everything, handled</div>
              </div>
              <div className="bg-surface border border-border rounded-card p-5">
                <div className="flex flex-col gap-2">
                  {inclusions.map((x) => (<div key={x} className="flex items-start gap-2.5 text-[13px] text-ink-2"><Check size={15} className="text-positive shrink-0 mt-0.5" />{x}</div>))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="text-[13px] font-semibold text-muted-2 px-1">Full technical specification</div>
                {techSpecs.map((g) => (
                  <Disclosure key={g.group} title={g.group}>
                    <div className="flex flex-col gap-1.5">
                      {g.rows.map(([k, v]) => (
                        <div key={k} className="flex items-start justify-between gap-4 py-1 border-b border-divider last:border-0">
                          <span className="text-muted-2">{k}</span><span className="text-ink-2 font-medium text-right">{v}</span>
                        </div>
                      ))}
                    </div>
                  </Disclosure>
                ))}
              </div>
            </section>

            {/* INVESTMENT */}
            <section id="investment" ref={(el) => { sectionRefs.current.investment = el }} className="scroll-mt-6 flex flex-col gap-4">
              <div>
                <div className="text-[12px] font-semibold text-accent uppercase tracking-wide">Investment</div>
                <div className="text-[22px] font-bold text-ink mt-1">The numbers</div>
              </div>
              <div className="bg-surface border border-border rounded-card p-5">
                <div className="flex items-center justify-between py-1"><span className="text-[13px] text-muted-b">System &amp; installation</span><span className="text-[13px] font-semibold text-ink-2">{gbp(design.systemCost)}</span></div>
                <div className="flex items-center justify-between py-1"><span className="text-[13px] text-muted-b">VAT (0% on domestic solar)</span><span className="text-[13px] font-semibold text-positive">£0</span></div>
                <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-divider"><span className="text-[15px] font-bold text-ink">Total</span><span className="text-[22px] font-bold text-ink">{gbp(design.systemCost)}</span></div>
              </div>
              {studioConfig.finance.length > 0 && (
                <div className="bg-surface border border-border rounded-card p-5">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="text-[14px] font-semibold text-ink">Spread the cost</div>
                    <button onClick={() => nav('/studio/pricing')} className="text-[12px] text-accent font-semibold">Your finance ↗</button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {studioConfig.finance.map((f) => {
                      const m = monthlyPayment(design.systemCost, f.apr, f.termMonths, f.depositPct)
                      return (
                        <div key={f.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-semibold text-ink-2">{f.name} <span className="text-muted-3 font-normal">· {f.provider}</span></div>
                            <div className="text-[11.5px] text-muted-2">{f.apr}% APR · {f.termMonths / 12} yrs{f.depositPct ? ` · ${f.depositPct}% deposit` : ' · no deposit'}</div>
                          </div>
                          <div className="text-right shrink-0"><div className="text-[17px] font-bold text-ink">{gbp(m)}</div><div className="text-[11px] text-muted-3">/mo</div></div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="text-[11px] text-muted-3 mt-2 leading-snug">Illustration only. Finance is provided and configured by the installer; subject to status. (UK: finance display may require FCA authorisation.)</div>
                </div>
              )}
            </section>

            {/* FAQ */}
            <section id="faq" ref={(el) => { sectionRefs.current.faq = el }} className="scroll-mt-6 flex flex-col gap-4">
              <div>
                <div className="text-[12px] font-semibold text-accent uppercase tracking-wide">Common questions</div>
                <div className="text-[22px] font-bold text-ink mt-1">Before you decide</div>
              </div>
              <div className="flex flex-col gap-2">
                {faqs.map(([q, a]) => (<Disclosure key={q} title={q}>{a}</Disclosure>))}
              </div>
            </section>

            {/* ACCEPT */}
            <section id="accept" ref={(el) => { sectionRefs.current.accept = el }} className="scroll-mt-6">
              <div className="bg-surface border-2 border-positive-border rounded-card p-7 text-center">
                <div className="text-[16px] font-semibold text-ink">Ready to go solar?</div>
                <div className="text-[13px] text-muted-b mt-1 mb-4">Accept to lock in this price and book your survey.</div>
                <Button variant="primary" color="#0E7C66" icon={<Check size={16} />} className="w-full justify-center max-w-xs mx-auto" onClick={accept}>Accept &amp; sign</Button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
