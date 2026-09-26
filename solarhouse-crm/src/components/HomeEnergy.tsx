/* Home & usage — the inputs every step shares: how much electricity the home uses (estimate, bill or real
 * smart-meter data), the tariff they're on (and which would suit the new system best), and the electricity supply
 * the battery and EV charger have to fit on. Asked once, used by Battery, EV, Electrical, Savings and the proposal. */
import { useMemo, useRef, useState } from 'react'
import type { Design, DesignPlane, HomeProfile, HomeSupply, HomeLoads, EarthingType } from '../store/types'
import { useActions } from '../store/store'
import { Panel, Kpi } from './ui'
import { Home, Bolt, Upload, Target, Pie } from './icons'
import { Dropdown } from './Dropdown'
import { importTariffs, exportTariffs, tariffById, tariffSummary } from '../lib/tariffs'
import { homeOf, scopeOf, rankTariffs, evOf, simulate } from '../lib/homeSystem'
import { chargerById } from '../lib/catalogue'
import { parseSmartMeterCsv, n3rgyStatus } from '../lib/smartMeter'
import { OCCUPANCY_LABEL, type Occupancy } from '../lib/mcs'
import { useSystem, ProvChip, Field, NumIn, Seg, gbp, inputCls } from './systemUi'

export function HomeEnergy({ design, moduleId, effTilt }: { design: Design; moduleId: string; effTilt: (p: DesignPlane) => number }) {
  const act = useActions()
  const home = homeOf(design), scope = scopeOf(design)
  const { inputs } = useSystem(design, moduleId, effTilt)
  const setHome = (patch: Partial<HomeProfile>) => act.updateDesign(design.id, { home: { ...home, ...patch } })
  const setSupply = (patch: Partial<HomeSupply>) => setHome({ supply: { ...home.supply, ...patch } })
  const setLoads = (patch: Partial<HomeLoads>) => setHome({ loads: { ...home.loads, ...patch } })
  const use = design.annualConsumptionKwh ?? 3800
  const occ = (design.occupancy ?? 'in_half_day') as Occupancy
  const imp = tariffById(home.tariffId)!, exp = tariffById(home.exportTariffId)!

  const smart = scope.ev && chargerById(evOf(design).chargerId).iog
  const ranked = useMemo(() => rankTariffs(inputs, exp, smart), [inputs, exp, smart])
  const current = useMemo(() => simulate({ gen: inputs.gen, demand: inputs.demand, battery: inputs.battery, ev: inputs.ev, importRates: imp.rates, exportRates: exp.rates }), [inputs, imp, exp])
  const best = ranked[0]
  // today = no solar or battery, on the current tariff — but already charging the car if an EV is in scope, so the
  // comparison is like for like (the car's electricity isn't a cost of the new system)
  const today = useMemo(() => simulate({ gen: inputs.gen.map((d) => d.map(() => 0)), demand: inputs.demand, battery: null, ev: inputs.ev, importRates: imp.rates, exportRates: tariffById('none')!.rates }), [inputs, imp])

  // smart meter
  const fileRef = useRef<HTMLInputElement>(null)
  const [meterMsg, setMeterMsg] = useState<string | null>(null)
  const [n3, setN3] = useState<string | null>(null)
  async function onFile(f: File) {
    try {
      const r = parseSmartMeterCsv(await f.text())
      act.updateDesign(design.id, { annualConsumptionKwh: r.annualKwh, home: { ...home, usageSource: 'smart-meter', usageProfile: r.profile, smartMeter: { source: 'csv', importedAt: Date.now(), days: r.days, from: r.from, to: r.to, annualKwh: r.annualKwh, fileName: f.name } } })
      setMeterMsg(`Loaded ${r.rows.toLocaleString()} readings over ${r.days} days (${r.from} → ${r.to}) · ${r.monthsCovered}/12 months real, the rest filled from the seasonal swing`)
    } catch (e) { setMeterMsg(String((e as Error).message || e)) }
  }

  return (
    <div className="absolute inset-0 overflow-y-auto px-5 py-5">
      <div className="max-w-[1100px] mx-auto flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-3">
          <Kpi variant="navy" icon={Home} label="Home uses" value={`${use.toLocaleString()} kWh`} delta={home.usageSource === 'smart-meter' ? 'from smart-meter data' : home.usageSource === 'bill' ? 'from the bill' : 'estimate'} deltaTone="muted" />
          <Kpi icon={Bolt} label="Bill today" value={gbp(today.net)} delta={`${imp.name}${inputs.ev ? " · incl. charging the car" : ""} · no standing charge`} deltaTone="muted" />
          <Kpi variant="teal" icon={Target} label="With the new system" value={gbp(current.net)} delta={`a year on ${imp.name}`} deltaTone="muted" />
          <Kpi icon={Pie} label="Best tariff for it" value={best ? gbp(best.net) : '—'} delta={best ? (best.imp.id === imp.id ? 'already on the best one' : `${best.imp.name} — saves ${gbp(current.net - best.net)} more`) : ''} deltaTone={best && best.imp.id !== imp.id ? 'positive' : 'muted'} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Panel title="Electricity use" sub="The more real this is, the better the battery sizing" icon={Home}>
            <div className="flex flex-col gap-3.5">
              <Seg value={home.usageSource} onChange={(v) => setHome({ usageSource: v })} options={[{ id: 'estimate', label: 'Estimate' }, { id: 'bill', label: 'From the bill' }, { id: 'smart-meter', label: 'Smart-meter data' }]} />
              {home.usageSource === 'bill' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Monthly bill (electricity only)"><NumIn value={home.monthlyBill ?? 110} suffix="£/mo" onChange={(v) => { const kwh = Math.round(((v - 0.53 * 30.4) * 12) / Math.max(0.1, tariffSummary(imp).avg)); act.updateDesign(design.id, { annualConsumptionKwh: Math.max(500, kwh), home: { ...home, monthlyBill: v } }) }} /></Field>
                  <Field label="Works out at" hint="bill less standing charge, at the tariff's average rate"><div className="h-9 flex items-center text-[14px] font-bold text-ink">{use.toLocaleString()} kWh a year</div></Field>
                </div>
              )}
              {home.usageSource === 'estimate' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Annual use"><NumIn value={use} step={100} suffix="kWh" onChange={(v) => act.updateDesign(design.id, { annualConsumptionKwh: v })} /></Field>
                  <Field label="Typical homes" hint="1–2 bed ~2,000 · 3 bed ~3,000 · 4+ bed ~4,300"><div className="flex gap-1.5">{[2000, 2900, 3800, 4300].map((k) => <button key={k} onClick={() => act.updateDesign(design.id, { annualConsumptionKwh: k })} className={`h-9 px-2.5 rounded-control border text-[12px] font-semibold ${use === k ? 'bg-[#15223B] text-white border-[#15223B]' : 'border-border text-ink-3 hover:bg-control'}`}>{k.toLocaleString()}</button>)}</div></Field>
                </div>
              )}
              {home.usageSource === 'smart-meter' && (
                <div className="flex flex-col gap-2.5">
                  <div className="text-[12.5px] text-muted-b leading-snug">Ask the customer to download their <b>half-hourly usage</b> as a CSV from their supplier's app or website (Octopus: <i>My account → Download your data</i>). Any file with a date/time and kWh column works.</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
                    <button onClick={() => fileRef.current?.click()} className="h-9 px-3.5 rounded-control bg-[#15223B] text-white text-[13px] font-semibold inline-flex items-center gap-2"><Upload size={14} />Upload usage CSV</button>
                    <button onClick={async () => { const s = await n3rgyStatus(); setN3(s.configured ? 'n3rgy is connected — enter the MPAN on the customer record' : 'Direct smart-meter access (n3rgy) is wired in but switched off — it needs an n3rgy account. Use the CSV for now.') }} className="h-9 px-3.5 rounded-control border border-border text-[13px] font-semibold text-ink-3 hover:bg-control">Connect smart meter (n3rgy)</button>
                  </div>
                  {home.smartMeter && <div className="text-[12px] text-ink-2"><b>{home.smartMeter.fileName ?? 'Smart-meter data'}</b> · {home.smartMeter.days} days, {home.smartMeter.from} → {home.smartMeter.to} · {home.smartMeter.annualKwh.toLocaleString()} kWh/yr</div>}
                  {meterMsg && <div className="text-[12px] text-muted-b">{meterMsg}</div>}
                  {n3 && <div className="text-[12px] text-muted-b">{n3}</div>}
                </div>
              )}
              <Field label="When is the home used?" hint={home.usageProfile ? 'Real half-hourly shape loaded — this only matters for estimates' : 'Shapes the day: out all day means little solar is used without a battery'}>
                <Dropdown value={occ} onChange={(e) => act.updateDesign(design.id, { occupancy: e.target.value as Occupancy })} className={inputCls}>
                  {(Object.keys(OCCUPANCY_LABEL) as Occupancy[]).map((o) => <option key={o} value={o}>{OCCUPANCY_LABEL[o]}</option>)}
                </Dropdown>
              </Field>
            </div>
          </Panel>

          <Panel title="Tariff" sub="Example regional rates — edit to the customer's bill when you have it" icon={Bolt}>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Import (what they pay)"><Dropdown value={home.tariffId} onChange={(e) => setHome({ tariffId: e.target.value })} className={inputCls}>{importTariffs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Dropdown></Field>
                <Field label="Export (what they're paid)"><Dropdown value={home.exportTariffId} onChange={(e) => setHome({ exportTariffId: e.target.value })} className={inputCls}>{exportTariffs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Dropdown></Field>
              </div>
              <div className="text-[12px] text-muted-b leading-snug">{imp.blurb}</div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-3 mt-1">Best tariffs for this system</div>
              <div className="flex flex-col divide-y divide-divider border border-divider rounded-[10px] overflow-hidden">
                {ranked.slice(0, 5).map((r, i) => {
                  const on = r.imp.id === home.tariffId && r.exp.id === home.exportTariffId
                  return (
                    <div key={r.imp.id} className={`flex items-center gap-3 px-3 py-2 ${i === 0 ? 'bg-[#E4F7F2]' : 'bg-white'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-ink truncate">{r.imp.name}{r.exp.id !== home.exportTariffId ? <span className="font-medium text-muted-b"> + {r.exp.name}</span> : null}</div>
                        <div className="text-[11px] text-muted-b truncate">{r.imp.supplier} · cheapest {(tariffSummary(r.imp).min * 100).toFixed(1)}p · peak {(tariffSummary(r.imp).max * 100).toFixed(1)}p</div>
                      </div>
                      <div className="text-right"><div className="text-[13.5px] font-bold text-ink tabular-nums">{gbp(r.net)}</div><div className="text-[10.5px] text-muted-2">a year</div></div>
                      {on ? <span className="text-[11px] font-bold text-[#0E7A66] w-[62px] text-center">Current</span> : <button onClick={() => setHome({ tariffId: r.imp.id, exportTariffId: r.exp.id })} className="h-7 w-[62px] rounded-[7px] border border-border text-[11.5px] font-semibold text-ink-3 hover:bg-control">Use</button>}
                    </div>
                  )
                })}
              </div>
              <div className="text-[11px] text-muted-2 leading-snug">Tariffs that need an EV, battery or smart charger only show once they're in the design. Savings on the Savings tab use the tariff chosen here; the step from their current tariff is shown separately.</div>
            </div>
          </Panel>
        </div>

        <Panel title="Electricity supply" sub="Decides whether a battery and an EV charger fit — estimate at the sale, confirmed by the surveyor" icon={Target}
          action={<ProvChip value={home.supply.source} onChange={(v) => setSupply({ source: v })} />}>
          <div className="grid grid-cols-5 gap-3">
            <Field label="Main fuse"><Dropdown value={String(home.supply.fuseA)} onChange={(e) => setSupply({ fuseA: +e.target.value })} className={inputCls}>{[60, 63, 80, 100].map((a) => <option key={a} value={a}>{a} A</option>)}</Dropdown></Field>
            <Field label="Phases"><Dropdown value={String(home.supply.phases)} onChange={(e) => setSupply({ phases: +e.target.value as 1 | 3 })} className={inputCls}><option value="1">Single phase</option><option value="3">Three phase</option></Dropdown></Field>
            <Field label="Earthing" hint="Most UK homes are PME (TN-C-S)"><Dropdown value={home.supply.earthing} onChange={(e) => setSupply({ earthing: e.target.value as EarthingType })} className={inputCls}><option value="TN-C-S">TN-C-S (PME)</option><option value="TN-S">TN-S</option><option value="TT">TT (earth rod)</option></Dropdown></Field>
            <Field label="Spare ways in the CU"><NumIn value={home.supply.spareWays} max={12} onChange={(v) => setSupply({ spareWays: v })} /></Field>
            <Field label="Home is" hint="EV grant eligibility"><Dropdown value={home.tenure} onChange={(e) => setHome({ tenure: e.target.value as HomeProfile['tenure'] })} className={inputCls}><option value="owner">Owner-occupied house</option><option value="flat">Owned flat</option><option value="renter">Rented</option><option value="landlord">Landlord's property</option></Dropdown></Field>
          </div>
          <div className="text-[11.5px] font-bold uppercase tracking-wide text-muted-3 mt-4 mb-2">Big electrical loads (for the maximum-demand check)</div>
          <div className="grid grid-cols-5 gap-3">
            <Field label="Electric shower"><NumIn value={home.loads.showerKw} step={0.5} suffix="kW" onChange={(v) => setLoads({ showerKw: v })} /></Field>
            <Field label="Cooker / hob"><NumIn value={home.loads.cookingKw} step={0.5} suffix="kW" onChange={(v) => setLoads({ cookingKw: v })} /></Field>
            <Field label="Immersion heater"><NumIn value={home.loads.immersionKw} step={0.5} suffix="kW" onChange={(v) => setLoads({ immersionKw: v })} /></Field>
            <Field label="Heat pump"><NumIn value={home.loads.heatPumpKw} step={0.5} suffix="kW" onChange={(v) => setLoads({ heatPumpKw: v })} /></Field>
            <Field label="Other fixed loads"><NumIn value={home.loads.otherKw} step={0.5} suffix="kW" onChange={(v) => setLoads({ otherKw: v })} /></Field>
          </div>
          {!scope.pv && scope.battery && (
            <>
              <div className="text-[11.5px] font-bold uppercase tracking-wide text-muted-3 mt-4 mb-2">Existing solar (battery retrofit)</div>
              <div className="grid grid-cols-5 gap-3">
                <Field label="Array size"><NumIn value={home.existingPv?.kwp ?? 0} step={0.1} suffix="kWp" onChange={(v) => setHome({ existingPv: { azimuthDeg: 180, pitchDeg: 35, ...home.existingPv, kwp: v } })} /></Field>
                <Field label="Facing"><Dropdown value={String(home.existingPv?.azimuthDeg ?? 180)} onChange={(e) => setHome({ existingPv: { kwp: 0, pitchDeg: 35, ...home.existingPv, azimuthDeg: +e.target.value } })} className={inputCls}>{[['South', 180], ['South-east', 135], ['South-west', 225], ['East', 90], ['West', 270], ['East + west', 179]].map(([l, v]) => <option key={l} value={v}>{l}</option>)}</Dropdown></Field>
                <Field label="Roof pitch"><NumIn value={home.existingPv?.pitchDeg ?? 35} max={60} suffix="°" onChange={(v) => setHome({ existingPv: { kwp: 0, azimuthDeg: 180, ...home.existingPv, pitchDeg: v } })} /></Field>
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  )
}
