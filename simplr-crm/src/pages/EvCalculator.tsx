import { useState } from 'react'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Bolt, Sun } from '../components/icons'
import { evComparison, EV_PRESETS, UK, gbp, type EvInputs } from '../lib/energy'

const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`

export function EvCalculator() {
  const [i, setI] = useState<EvInputs>({
    annualMiles: 8000,
    miPerKWh: 3.8,
    homeSharePct: 80,
    homeRate: UK.evOffPeakRate,
    publicRate: UK.publicRapidRate,
    solarSharePct: 0,
    petrolMpg: 45,
    fuelPricePerLitre: UK.petrolPricePerLitre,
  })
  const set = (patch: Partial<EvInputs>) => setI((p) => ({ ...p, ...patch }))
  const r = evComparison(i)

  const saving = r.annualSaving
  const cheaperBy = r.petrolPencePerMile > 0 ? Math.round((1 - r.evPencePerMile / r.petrolPencePerMile) * 100) : 0

  return (
    <>
      <TopBar title="EV charging calculator" crumbs={['Studio', 'Calculators', 'EV charging']} />
      <PageBody>
        <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {/* ── Inputs ─────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            <div className="bg-surface border border-border rounded-card p-5">
              <div className="text-[14px] font-semibold text-ink mb-3">The car & your driving</div>
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Annual mileage" value={i.annualMiles} onChange={(v) => set({ annualMiles: v })} step={500} suffix="mi" />
                <NumField label="Efficiency" value={i.miPerKWh} onChange={(v) => set({ miPerKWh: v })} step={0.1} suffix="mi/kWh" />
              </div>
              <div className="mt-3">
                <FieldLabel>Vehicle type</FieldLabel>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {EV_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => set({ miPerKWh: p.miPerKWh })}
                      className={`text-[12px] px-2.5 py-1.5 rounded-lg border transition-colors ${Math.abs(i.miPerKWh - p.miPerKWh) < 0.05 ? 'border-accent bg-accent-wash-3 text-accent-700 font-semibold' : 'border-border text-ink-3 hover:bg-control'}`}
                    >
                      {p.label.split(' (')[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-card p-5">
              <div className="text-[14px] font-semibold text-ink mb-3">Where & how you charge</div>
              <SliderRow label="Home charging" value={i.homeSharePct} onChange={(v) => set({ homeSharePct: v })} min={0} max={100} suffix={`${i.homeSharePct}% home · ${100 - i.homeSharePct}% public`} />
              <div className="grid grid-cols-2 gap-3 mt-3">
                <NumField label="Home rate" value={i.homeRate} onChange={(v) => set({ homeRate: v })} step={0.01} prefix="£" suffix="/kWh" />
                <NumField label="Public rapid rate" value={i.publicRate} onChange={(v) => set({ publicRate: v })} step={0.01} prefix="£" suffix="/kWh" />
              </div>
              <div className="mt-4 rounded-xl p-3.5" style={{ background: 'linear-gradient(150deg,#FFF6E9,#FFEFD6)', border: '1px solid #F6DDB0' }}>
                <div className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: '#9A5B12' }}><Sun size={15} /> Charge from your own solar</div>
                <SliderRow accent="#E8721A" label="" value={i.solarSharePct ?? 0} onChange={(v) => set({ solarSharePct: v })} min={0} max={100} suffix={`${i.solarSharePct ?? 0}% of home charging from solar`} />
                <div className="text-[11.5px] mt-1" style={{ color: '#9A5B12' }}>Solar-charged miles cost near zero — the strongest reason to pair an EV with a solar + battery system.</div>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-card p-5">
              <div className="text-[14px] font-semibold text-ink mb-3">Compared with your current car</div>
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Fuel economy" value={i.petrolMpg} onChange={(v) => set({ petrolMpg: v })} step={1} suffix="mpg" />
                <NumField label="Fuel price" value={i.fuelPricePerLitre} onChange={(v) => set({ fuelPricePerLitre: v })} step={0.01} prefix="£" suffix="/L" />
              </div>
            </div>
          </div>

          {/* ── Results ────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            <div className="rounded-card p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(155deg,#12341f,#082013)' }}>
              <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 100% at 90% -10%, rgba(52,200,150,0.22), transparent 55%)' }} />
              <div className="relative">
                <div className="flex items-center gap-2 text-[12px]" style={{ color: '#8FE0C6' }}><Bolt size={14} /> Annual saving vs petrol</div>
                <div className="text-[38px] font-bold mt-1 leading-none">{money(saving)}<span className="text-[16px] font-medium" style={{ color: '#8FE0C6' }}>/yr</span></div>
                <div className="text-[12.5px] mt-1.5" style={{ color: '#c3ccdb' }}>
                  {r.evPencePerMile}p/mile in the EV vs {r.petrolPencePerMile}p/mile petrol{cheaperBy > 0 ? ` — ${cheaperBy}% cheaper` : ''}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <MiniStat tint="#8FE0C6" label="EV cost / mile" value={`${r.evPencePerMile}p`} />
                  <MiniStat tint="#FFB4A6" label="Petrol / mile" value={`${r.petrolPencePerMile}p`} />
                </div>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-card p-5">
              <div className="text-[13px] font-semibold text-ink mb-3">The breakdown</div>
              <Row label="EV — annual running cost" value={money(r.evAnnualCost)} />
              <Row label="Petrol — annual running cost" value={money(r.petrolAnnualCost)} />
              <Row label="Blended electricity rate" value={`£${r.blendedRate.toFixed(3)}/kWh`} />
              <Row label="Electricity used / year" value={`${r.annualKwh.toLocaleString()} kWh`} />
              <Row label="CO₂ saved / year" value={`${r.co2SavedTonnes} t`} last />
            </div>

            <div className="rounded-card bg-accent-wash-3 border border-[#D3E0FA] p-4 text-[12.5px] text-accent-700 leading-relaxed">
              Figures use a blended home/public rate and add ~10% for charging losses, so the kWh billed exceeds the kWh into the wheels — the same method the credible UK calculators use. Every rate above is editable per customer.
            </div>
          </div>
        </div>
      </PageBody>
    </>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[12px] font-semibold text-ink-3">{children}</span>
}

function NumField({ label, value, onChange, step = 1, prefix, suffix }: { label: string; value: number; onChange: (v: number) => void; step?: number; prefix?: string; suffix?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-1.5">
        {prefix && <span className="text-[12px] text-muted-2 shrink-0">{prefix}</span>}
        <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-9 px-3 rounded-control border border-input-border bg-white text-[13px] text-ink-2 outline-none focus:border-accent w-full" />
        {suffix && <span className="text-[12px] text-muted-2 shrink-0">{suffix}</span>}
      </div>
    </label>
  )
}

function SliderRow({ label, value, onChange, min, max, suffix, accent = '#13927B' }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; suffix?: string; accent?: string }) {
  return (
    <div className={label ? 'mt-1' : 'mt-2'}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full mt-1.5" style={{ accentColor: accent }} />
      {suffix && <div className="text-[12px] text-muted-2 -mt-0.5">{suffix}</div>}
    </div>
  )
}

function MiniStat({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="rounded-xl bg-white/8 px-3 py-2.5">
      <div className="text-[11px]" style={{ color: '#93A0B4' }}>{label}</div>
      <div className="text-[19px] font-bold mt-0.5" style={{ color: tint }}>{value}</div>
    </div>
  )
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 text-[13px] ${last ? '' : 'border-b border-border'}`}>
      <span className="text-ink-3">{label}</span>
      <span className="font-semibold text-ink-2 tabular-nums">{value}</span>
    </div>
  )
}
