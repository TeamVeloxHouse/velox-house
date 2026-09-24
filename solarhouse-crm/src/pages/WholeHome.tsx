import { useMemo, useState } from 'react'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Sun, Bolt, Layers, Check, Sparkle } from '../components/icons'
import { simulateHome, evComparison, EV_PRESETS, CHEMISTRY, UK, type Occupancy, type HomeSimInput } from '../lib/energy'

const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`

// The three products the studio designs. Ticking one adds its stage; the shared
// energy model underneath means solar sizes the battery, and the battery + EV
// re-shape each other — they are never priced in isolation.
type Scope = { solar: boolean; battery: boolean; ev: boolean }

const SPECIFIC_YIELD = 950 // kWh per kWp/yr, UK average south-ish roof after shading
const COST = { perKwp: 1350, solarBase: 800, perBatteryKwh: 600, batteryBase: 900, evCharger: 900 }

export function WholeHome() {
  const [scope, setScope] = useState<Scope>({ solar: true, battery: true, ev: true })
  const toggle = (k: keyof Scope) => setScope((s) => ({ ...s, [k]: !s[k] }))

  // Household — always needed, even for a battery-only or EV-only design.
  const [demand, setDemand] = useState(3500)
  const [occupancy, setOccupancy] = useState<Occupancy>('out_all_day')

  // Solar — designed when ticked, or entered as an existing array when not.
  const [kWp, setKWp] = useState(4.4)
  const [existingKWp, setExistingKWp] = useState(4)

  // Battery
  const [batteryKwh, setBatteryKwh] = useState(10)
  const [chem, setChem] = useState<keyof typeof CHEMISTRY>('lifepo4')
  const [gridCharge, setGridCharge] = useState(false)

  // EV
  const [annualMiles, setAnnualMiles] = useState(9000)
  const [miPerKWh, setMiPerKWh] = useState(3.8)
  const [strategy, setStrategy] = useState<'solar' | 'offpeak' | 'dumb'>('solar')
  const [homeSharePct, setHomeSharePct] = useState(90)
  const [petrolMpg, setPetrolMpg] = useState(45)

  // Tariff
  const [importRate, setImportRate] = useState(UK.importRate)
  const [exportRate, setExportRate] = useState(UK.exportRate)
  const [offPeakRate, setOffPeakRate] = useState(UK.evOffPeakRate)

  const hasSolar = scope.solar || existingKWp > 0
  const usedKWp = scope.solar ? kWp : existingKWp
  const annualGeneration = hasSolar ? Math.round(usedKWp * SPECIFIC_YIELD) : 0
  const timeOfUse = scope.ev || gridCharge

  const tariff = { importRate, exportRate, offPeakRate, timeOfUse }

  const sim = useMemo(() => {
    const input: HomeSimInput = {
      annualGeneration,
      annualDemand: demand,
      occupancy,
      battery: scope.battery ? { usableKwh: batteryKwh, roundTrip: CHEMISTRY[chem].roundTrip, allowGridCharge: gridCharge } : undefined,
      ev: scope.ev ? { annualMiles, miPerKWh, strategy, homeSharePct } : undefined,
      tariff,
    }
    return simulateHome(input)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annualGeneration, demand, occupancy, scope.battery, scope.ev, batteryKwh, chem, gridCharge, annualMiles, miPerKWh, strategy, homeSharePct, importRate, exportRate, offPeakRate, timeOfUse])

  // Baseline = today: base demand at flat import, no solar/battery, petrol car.
  const baseline = useMemo(() => simulateHome({ annualGeneration: 0, annualDemand: demand, occupancy }), [demand, occupancy])
  const ev = scope.ev ? evComparison({ annualMiles, miPerKWh, homeSharePct, homeRate: offPeakRate, publicRate: UK.publicRapidRate, solarSharePct: sim.evRenewablePct, petrolMpg, fuelPricePerLitre: UK.petrolPricePerLitre }) : null

  const petrolNow = ev?.petrolAnnualCost ?? 0
  const totalSaving = Math.max(0, baseline.netBill + petrolNow - sim.netBill)

  const systemCost =
    (scope.solar ? usedKWp * COST.perKwp + COST.solarBase : 0) +
    (scope.battery ? batteryKwh * COST.perBatteryKwh + COST.batteryBase : 0) +
    (scope.ev ? COST.evCharger : 0)
  const payback = totalSaving > 0 ? systemCost / totalSaving : Infinity

  const co2 = ((baseline.gridImport - sim.gridImport) * UK.gridCo2PerKwh) / 1000 + (ev?.co2SavedTonnes ?? 0)

  // Battery sizing sweep — shows the customer the payback knee (why we picked the size).
  const sweep = useMemo(() => {
    if (!scope.battery) return []
    return [0, 3, 5, 8, 10, 13, 16].map((kwh) => {
      const s = simulateHome({ annualGeneration, annualDemand: demand, occupancy, battery: kwh ? { usableKwh: kwh, roundTrip: CHEMISTRY[chem].roundTrip, allowGridCharge: gridCharge } : undefined, ev: scope.ev ? { annualMiles, miPerKWh, strategy, homeSharePct } : undefined, tariff })
      return { kwh, bill: s.netBill }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.battery, scope.ev, annualGeneration, demand, occupancy, chem, gridCharge, annualMiles, miPerKWh, strategy, homeSharePct, importRate, exportRate, offPeakRate, timeOfUse])
  const sweepMax = Math.max(...sweep.map((x) => x.bill), 1)
  const sweepMin = Math.min(...sweep.map((x) => x.bill), 0)

  const nothingPicked = !scope.solar && !scope.battery && !scope.ev

  return (
    <>
      <TopBar title="Whole-home design" crumbs={['Design', 'Whole-home']} />
      <PageBody>
        {/* Scope picker */}
        <div className="rounded-card p-6" style={{ background: 'linear-gradient(135deg,#EAF6F2,#F5F0FF 70%)', border: '1px solid #E3E8F5' }}>
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg,#1FAE94,#159C86)' }}><Sparkle size={22} /></span>
            <div className="flex-1">
              <div className="text-[17px] font-bold text-ink">What are we designing today?</div>
              <div className="text-[13px] text-muted-b mt-0.5">Tick the products in play. They're modelled together on one energy system — so the battery is sized against the solar, and the EV re-shapes both. Untick a product you already have and enter it below.</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <ScopeTile on={scope.solar} onClick={() => toggle('solar')} icon={<Sun size={20} />} label="Solar" tint="#E8721A" sub="Generate" />
            <ScopeTile on={scope.battery} onClick={() => toggle('battery')} icon={<Layers size={20} />} label="Battery" tint="#159C86" sub="Store & shift" />
            <ScopeTile on={scope.ev} onClick={() => toggle('ev')} icon={<Bolt size={20} />} label="EV charging" tint="#0E9F6E" sub="Drive on sunshine" />
          </div>
        </div>

        {nothingPicked ? (
          <div className="rounded-card border border-border bg-surface p-8 text-center text-[13px] text-muted-2 mt-4">Tick at least one product above to start designing.</div>
        ) : (
          <div className="grid gap-4 items-start mt-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {/* ── Inputs ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-4">
              {/* Household */}
              <Card title="The household" tint="#1FAE94">
                <div className="grid grid-cols-2 gap-3">
                  <NumField label="Annual electricity use" value={demand} onChange={setDemand} step={250} suffix="kWh" />
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel>Who's home in the day?</FieldLabel>
                    <select value={occupancy} onChange={(e) => setOccupancy(e.target.value as Occupancy)} className="h-9 px-2.5 rounded-control border border-input-border bg-white text-[13px] text-ink-2 outline-none focus:border-accent">
                      <option value="out_all_day">Out all day</option>
                      <option value="in_half_day">In part of the day</option>
                      <option value="home_all_day">Home all day</option>
                    </select>
                  </div>
                </div>
              </Card>

              {/* Solar */}
              {scope.solar ? (
                <Card title="Solar array" tint="#E8721A" icon={<Sun size={16} />}>
                  <SliderRow accent="#E8721A" label="System size" value={Math.round(kWp * 10)} onChange={(v) => setKWp(v / 10)} min={10} max={120} suffix={`${kWp.toFixed(1)} kWp · ~${annualGeneration.toLocaleString()} kWh/yr · ~${Math.round(kWp / 0.44)} panels`} />
                  <div className="text-[11.5px] text-muted-2 mt-1">Design the exact roof layout in the full Design Studio; this sizes the system for the energy model.</div>
                </Card>
              ) : (
                <Card title="Existing solar" tint="#E8721A" icon={<Sun size={16} />}>
                  <NumField label="Installed system size" value={existingKWp} onChange={setExistingKWp} step={0.5} suffix="kWp" />
                  <div className="text-[11.5px] text-muted-2 mt-2">Not designing solar today — we still model what your array generates (~{annualGeneration.toLocaleString()} kWh/yr) so the battery and EV maths stay honest.</div>
                </Card>
              )}

              {/* Battery */}
              {scope.battery && (
                <Card title="Battery storage" tint="#159C86" icon={<Layers size={16} />}>
                  <SliderRow accent="#159C86" label="Usable capacity" value={batteryKwh} onChange={setBatteryKwh} min={0} max={30} suffix={`${batteryKwh} kWh usable · ~${sim.batteryCycles} cycles/yr`} />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(Object.keys(CHEMISTRY) as (keyof typeof CHEMISTRY)[]).map((c) => (
                      <button key={c} onClick={() => setChem(c)} className={`text-[12px] px-2.5 py-1.5 rounded-lg border transition-colors ${chem === c ? 'border-accent bg-accent-wash-3 text-accent-700 font-semibold' : 'border-border text-ink-3 hover:bg-control'}`}>
                        {c === 'lifepo4' ? 'LiFePO₄' : c === 'nmc' ? 'NMC' : 'Lead-acid'}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 mt-3 text-[12.5px] text-ink-3 cursor-pointer">
                    <input type="checkbox" checked={gridCharge} onChange={(e) => setGridCharge(e.target.checked)} className="accent-[#159C86]" />
                    Charge from cheap off-peak grid too (Octopus Flux / Go — arbitrage)
                  </label>
                </Card>
              )}

              {/* EV */}
              {scope.ev && (
                <Card title="EV charging" tint="#0E9F6E" icon={<Bolt size={16} />}>
                  <div className="grid grid-cols-2 gap-3">
                    <NumField label="Annual mileage" value={annualMiles} onChange={setAnnualMiles} step={500} suffix="mi" />
                    <NumField label="Efficiency" value={miPerKWh} onChange={setMiPerKWh} step={0.1} suffix="mi/kWh" />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {EV_PRESETS.map((p) => (
                      <button key={p.label} onClick={() => setMiPerKWh(p.miPerKWh)} className={`text-[12px] px-2.5 py-1.5 rounded-lg border transition-colors ${Math.abs(miPerKWh - p.miPerKWh) < 0.05 ? 'border-accent bg-accent-wash-3 text-accent-700 font-semibold' : 'border-border text-ink-3 hover:bg-control'}`}>{p.label.split(' (')[0]}</button>
                    ))}
                  </div>
                  <div className="mt-3">
                    <FieldLabel>Charging strategy</FieldLabel>
                    <div className="flex gap-1.5 mt-1.5">
                      {([['solar', 'Solar-soak'], ['offpeak', 'Off-peak'], ['dumb', 'On plug-in']] as const).map(([k, lbl]) => (
                        <button key={k} onClick={() => setStrategy(k)} className={`flex-1 text-[12px] px-2 py-1.5 rounded-lg border transition-colors ${strategy === k ? 'border-accent bg-accent-wash-3 text-accent-700 font-semibold' : 'border-border text-ink-3 hover:bg-control'}`}>{lbl}</button>
                      ))}
                    </div>
                  </div>
                  <SliderRow accent="#0E9F6E" label="Charging done at home" value={homeSharePct} onChange={setHomeSharePct} min={0} max={100} suffix={`${homeSharePct}% home · ${100 - homeSharePct}% public`} />
                  <NumField label="Current petrol car economy" value={petrolMpg} onChange={setPetrolMpg} step={1} suffix="mpg" />
                </Card>
              )}

              {/* Tariff */}
              <Card title="Energy tariff" tint="#64748B">
                <div className="grid grid-cols-3 gap-3">
                  <NumField label="Import" value={importRate} onChange={setImportRate} step={0.01} prefix="£" />
                  <NumField label="Export (SEG)" value={exportRate} onChange={setExportRate} step={0.01} prefix="£" />
                  <NumField label="Off-peak" value={offPeakRate} onChange={setOffPeakRate} step={0.005} prefix="£" />
                </div>
                {timeOfUse && <div className="text-[11.5px] text-muted-2 mt-2">On a time-of-use tariff — off-peak rate applies overnight (23:30–05:30).</div>}
              </Card>
            </div>

            {/* ── Integrated results ─────────────────────────────── */}
            <div className="flex flex-col gap-4 sticky top-4">
              <div className="rounded-card p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(155deg,#12341f,#082013)' }}>
                <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 100% at 90% -10%, rgba(52,200,150,0.22), transparent 55%)' }} />
                <div className="relative">
                  <div className="flex items-center gap-2 text-[12px]" style={{ color: '#8FE0C6' }}><Sparkle size={14} /> Total annual saving</div>
                  <div className="text-[38px] font-bold mt-1 leading-none">{money(totalSaving)}<span className="text-[16px] font-medium" style={{ color: '#8FE0C6' }}>/yr</span></div>
                  <div className="text-[12.5px] mt-1.5" style={{ color: '#c3ccdb' }}>
                    {money(systemCost)} system{Number.isFinite(payback) ? ` · ${payback.toFixed(1)}-year payback` : ''} · {co2.toFixed(1)}t CO₂ saved/yr
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <MiniStat tint="#8FE0C6" label="New electricity bill" value={`${money(sim.netBill)}/yr`} />
                    <MiniStat tint="#FFD9A6" label="Energy independence" value={`${sim.selfSufficiencyPct}%`} />
                    {scope.ev && <MiniStat tint="#A6E3FF" label="Driving from your roof" value={`${sim.evRenewablePct}%`} />}
                    {hasSolar && <MiniStat tint="#C6F0D8" label="Solar self-used" value={`${sim.selfConsumptionPct}%`} />}
                  </div>
                </div>
              </div>

              {/* Battery size sweep */}
              {scope.battery && sweep.length > 0 && (
                <div className="bg-surface border border-border rounded-card p-5">
                  <div className="text-[13px] font-semibold text-ink mb-1">Battery size vs annual bill</div>
                  <div className="text-[11.5px] text-muted-2 mb-3">Where the line flattens is the sweet spot — bigger stops paying back.</div>
                  <div className="flex items-end gap-2 h-[120px]">
                    {sweep.map((x) => {
                      const h = 100 - ((x.bill - sweepMin) / (sweepMax - sweepMin || 1)) * 82
                      const sel = x.kwh === batteryKwh
                      return (
                        <button key={x.kwh} onClick={() => setBatteryKwh(x.kwh)} className="flex-1 flex flex-col items-center justify-end gap-1 group" style={{ height: '100%' }}>
                          <span className="text-[10px] font-semibold tabular-nums" style={{ color: sel ? '#159C86' : '#94A3B8' }}>{money(x.bill)}</span>
                          <div className="w-full rounded-t-md transition-all" style={{ height: `${Math.max(6, h)}%`, background: sel ? 'linear-gradient(180deg,#57C9B4,#159C86)' : '#E2E1F3' }} />
                          <span className="text-[10px] tabular-nums" style={{ color: sel ? '#159C86' : '#94A3B8' }}>{x.kwh}k</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Breakdown */}
              <div className="bg-surface border border-border rounded-card p-5">
                <div className="text-[13px] font-semibold text-ink mb-3">The system & the numbers</div>
                {scope.solar && <Row label={`Solar — ${kWp.toFixed(1)} kWp`} value={money(usedKWp * COST.perKwp + COST.solarBase)} />}
                {scope.battery && <Row label={`Battery — ${batteryKwh} kWh usable`} value={money(batteryKwh * COST.perBatteryKwh + COST.batteryBase)} />}
                {scope.ev && <Row label="EV charger (7kW, installed)" value={money(COST.evCharger)} />}
                <Row label="Electricity bill — today" value={money(baseline.netBill)} />
                <Row label="Electricity bill — with system" value={money(sim.netBill)} />
                {hasSolar && <Row label="Export income (SEG)" value={`${money(sim.exportIncome)}/yr`} />}
                {scope.ev && ev && <Row label="Petrol saved (vs current car)" value={`${money(ev.petrolAnnualCost)}/yr`} />}
                {scope.battery && <Row label="Battery throughput" value={`${sim.batteryThroughput.toLocaleString()} kWh/yr`} />}
                <Row label="Grid import / export" value={`${sim.gridImport.toLocaleString()} / ${sim.gridExport.toLocaleString()} kWh`} last />
              </div>

              <div className="rounded-card bg-accent-wash-3 border border-[#D3E0FA] p-4 text-[12.5px] text-accent-700 leading-relaxed">
                Modelled half-hourly across a representative day each month, so self-consumption, solar-soak EV charging and battery timing are simulated — not guessed from a single ratio. 0% VAT on domestic solar + battery is applied. Every figure above is editable per customer.
              </div>
            </div>
          </div>
        )}
      </PageBody>
    </>
  )
}

function ScopeTile({ on, onClick, icon, label, sub, tint }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string; sub: string; tint: string }) {
  return (
    <button onClick={onClick} className={`relative rounded-2xl p-4 text-left transition-all border-2 ${on ? 'bg-white shadow-sm' : 'bg-white/40 border-transparent hover:bg-white/70'}`} style={{ borderColor: on ? tint : undefined }}>
      <div className="flex items-center justify-between">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: on ? tint : '#C3CAD8' }}>{icon}</span>
        {on && <span className="w-5 h-5 rounded-full flex items-center justify-center text-white" style={{ background: tint }}><Check size={13} /></span>}
      </div>
      <div className="text-[15px] font-bold text-ink mt-2.5">{label}</div>
      <div className="text-[11.5px] text-muted-2">{sub}</div>
    </button>
  )
}

function Card({ title, tint, icon, children }: { title: string; tint: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-card p-5">
      <div className="flex items-center gap-2 mb-3">
        {icon && <span className="w-6 h-6 rounded-lg flex items-center justify-center text-white" style={{ background: tint }}>{icon}</span>}
        <div className="text-[14px] font-semibold text-ink">{title}</div>
      </div>
      {children}
    </div>
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
