/* Battery step — pick the product and size, choose how it runs, see what it's worth, and check it can go where
 * the customer wants it (PAS 63100) and what grid application the combined inverters need (G98/G99). */
import { useMemo } from 'react'
import type { Design, DesignPlane, BatteryDesign, BatteryLocation } from '../store/types'
import { useActions, useState_ } from '../store/store'
import { Panel, Kpi } from './ui'
import { Layers, Target, Bolt, Pie, Home, Check } from './icons'
import { BATTERIES, batteryById, usableKwhOf } from '../lib/catalogue'
import { batteryOf, batteryCurve, simulate, scopeOf } from '../lib/homeSystem'
import { batteryCompliance, LOCATIONS } from '../lib/batteryCompliance'
import { designPrice } from '../lib/designPrice'
import { useSystem, ProvChip, Seg, DayChart, DayLegend, gbp, pct } from './systemUi'

const MODES: { id: BatteryDesign['mode']; label: string; blurb: string }[] = [
  { id: 'self', label: 'Store solar', blurb: 'Soaks up spare daytime solar and runs the house in the evening. Works on any tariff.' },
  { id: 'tou', label: 'Cheap-rate top-up', blurb: 'Also fills from the grid in the cheap overnight hours — only the part the sun won’t fill tomorrow. Needs a time-of-use tariff.' },
  { id: 'arbitrage', label: 'Sell at the peak', blurb: 'As above, plus exports stored energy in the evening peak when the export price beats the cheap rate (Octopus Flux).' },
]

export function BatteryDesigner({ design, moduleId, effTilt }: { design: Design; moduleId: string; effTilt: (p: DesignPlane) => number }) {
  const act = useActions()
  const { studioConfig } = useState_()
  const bd = batteryOf(design), p = batteryById(bd.productId), scope = scopeOf(design)
  const { inputs } = useSystem(design, moduleId, effTilt)
  const set = (patch: Partial<BatteryDesign>) => {
    const next = { ...bd, ...patch }
    const prod = batteryById(next.productId)
    next.units = Math.max(prod.minUnits, Math.min(prod.maxUnits, next.units))
    act.updateDesign(design.id, { batteryDesign: next, batteryKwh: usableKwhOf(prod, next.units) }) // batteryKwh keeps the older tabs in step
  }
  const curve = useMemo(() => batteryCurve(inputs, bd.productId, bd.mode), [inputs, bd.productId, bd.mode])
  const cur = curve.rows.find((r) => r.units === bd.units) ?? curve.rows[0]
  const withBatt = useMemo(() => simulate({ gen: inputs.gen, demand: inputs.demand, battery: inputs.battery, ev: inputs.ev, importRates: inputs.imp.rates, exportRates: inputs.exp.rates }), [inputs])
  const comp = batteryCompliance(design)
  const price = designPrice(design, 0, 0, studioConfig).battery
  const usable = usableKwhOf(p, bd.units)
  const touWarn = bd.mode !== 'self' && Math.min(...inputs.imp.rates) > Math.max(...inputs.imp.rates) * 0.8
  const maxSave = Math.max(1, ...curve.rows.map((r) => r.saving))

  return (
    <div className="absolute inset-0 overflow-y-auto px-5 py-5">
      <div className="max-w-[1100px] mx-auto flex flex-col gap-4">
        <div className="grid grid-cols-5 gap-3">
          <Kpi variant="navy" icon={Layers} label="Battery" value={`${usable} kWh`} delta={`${bd.units} × ${p.brand} ${p.unitKwh} kWh · ${p.powerKw} kW`} deltaTone="muted" />
          <Kpi variant="teal" icon={Target} label="Adds a year" value={gbp(cur?.saving ?? 0)} delta={`on ${inputs.imp.name}`} deltaTone="muted" />
          <Kpi icon={Bolt} label="Battery price" value={gbp(price)} delta={cur && Number.isFinite(cur.payback) ? `pays back in ~${(price / Math.max(1, cur.saving)).toFixed(1)} yrs` : 'no saving on this tariff'} deltaTone="muted" />
          <Kpi icon={Home} label="Self-sufficiency" value={pct(withBatt.selfSufficiency)} delta={`was ${pct(curve.noBattery.selfSufficiency)} without it`} deltaTone="positive" />
          <Kpi icon={Pie} label="Cycles a year" value={String(withBatt.batteryCycles)} delta={`${p.cycles.toLocaleString()} warranted — ~${Math.round(p.cycles / Math.max(1, withBatt.batteryCycles))} yrs`} deltaTone="muted" />
        </div>

        <Panel title="Product" sub="Stock list — typical datasheet figures and example trade prices" icon={Layers}>
          <div className="grid grid-cols-4 gap-2.5">
            {BATTERIES.map((b) => {
              const on = b.id === bd.productId
              return (
                <button key={b.id} onClick={() => set({ productId: b.id, units: Math.max(b.minUnits, Math.min(b.maxUnits, Math.round(usable / (b.unitKwh * b.usablePct)) || b.minUnits)) })}
                  className={`text-left rounded-[12px] border px-3 py-2.5 transition-colors ${on ? 'border-[#15223B] bg-[#15223B] text-white' : 'border-border bg-white hover:border-[#62E4CC]'}`}>
                  <div className={`text-[11px] font-bold uppercase tracking-wide ${on ? 'text-[#62E4CC]' : 'text-muted-3'}`}>{b.brand}</div>
                  <div className={`text-[13px] font-bold leading-tight mt-0.5 ${on ? 'text-white' : 'text-ink'}`}>{b.name}</div>
                  <div className={`text-[11px] mt-1.5 leading-snug ${on ? 'text-white/75' : 'text-muted-b'}`}>{b.unitKwh} kWh {b.maxUnits > 1 ? `× ${b.minUnits}–${b.maxUnits}` : 'unit'} · {b.powerKw} kW · {b.coupling === 'dc' ? 'DC hybrid' : 'AC-coupled'}{b.backup !== 'none' ? ` · ${b.backup === 'eps' ? 'EPS' : 'whole-home backup'}` : ''}</div>
                </button>
              )
            })}
          </div>
          {p.note && <div className="text-[11.5px] text-muted-b mt-2.5">{p.brand} {p.name}: {p.note}. Runs on {p.inverter}.</div>}
          {!scope.pv && p.coupling === 'dc' && <div className="text-[11.5px] mt-2 font-semibold text-[#92400E]">Retrofit onto existing solar: a DC hybrid replaces the current inverter (or add it alongside). An AC-coupled battery (e.g. GivEnergy All in One) is the simpler retrofit.</div>}
        </Panel>

        <div className="grid grid-cols-[1.15fr_1fr] gap-4">
          <Panel title="Size" sub={`Annual saving at each size — ${p.brand} ${p.unitKwh} kWh steps`} icon={Target}
            action={curve.recommended.units !== bd.units ? <button onClick={() => set({ units: curve.recommended.units })} className="h-8 px-3 rounded-control bg-[#15223B] text-white text-[12px] font-semibold whitespace-nowrap">Use {curve.recommended.kwh} kWh (best value)</button> : <span className="text-[11.5px] font-bold text-[#0E7A66] whitespace-nowrap">✓ Best-value size</span>}>
            <div className="flex flex-col gap-1.5">
              {curve.rows.map((r) => {
                const on = r.units === bd.units, rec = r.units === curve.recommended.units
                return (
                  <button key={r.units} onClick={() => set({ units: r.units })} className={`grid grid-cols-[64px_1fr_78px_70px] items-center gap-2.5 text-left rounded-[8px] px-2 py-1 ${on ? 'bg-[#E4F7F2]' : 'hover:bg-control'}`}>
                    <span className="text-[12.5px] font-bold text-ink tabular-nums">{r.kwh} kWh</span>
                    <span className="h-4 rounded-[4px] bg-[#EEF1F5] overflow-hidden"><span className="block h-full rounded-[4px]" style={{ width: `${Math.max(2, (r.saving / maxSave) * 100)}%`, background: on ? '#15223B' : '#62E4CC' }} /></span>
                    <span className="text-[12.5px] font-semibold text-ink tabular-nums text-right">{gbp(r.saving)}/yr</span>
                    <span className="text-[11px] text-muted-b tabular-nums text-right">{Number.isFinite(r.payback) ? `${r.payback.toFixed(1)} yr trade` : '—'}{rec ? ' ★' : ''}</span>
                  </button>
                )
              })}
            </div>
            <div className="text-[11px] text-muted-2 mt-2.5 leading-snug">★ = best value: past it, each extra module adds under ~40% of the average saving per module. Payback here is on trade cost; the Savings tab uses the customer price.</div>
          </Panel>

          <Panel title="How it runs" sub="The strategy is set on the inverter at commissioning" icon={Bolt}>
            <Seg value={bd.mode} onChange={(v) => set({ mode: v })} options={MODES.map((m) => ({ id: m.id, label: m.label }))} />
            <div className="text-[12.5px] text-ink-2 mt-3 leading-snug">{MODES.find((m) => m.id === bd.mode)!.blurb}</div>
            {touWarn && <div className="text-[12px] font-semibold text-[#92400E] mt-2">They're on {inputs.imp.name}, which has no cheap window — this strategy only pays with a time-of-use tariff. Pick one on the Home &amp; usage tab.</div>}
            <div className="text-[11.5px] font-bold uppercase tracking-wide text-muted-3 mt-4 mb-1.5">Backup</div>
            <Seg value={bd.backup} onChange={(v) => set({ backup: v })} options={[{ id: 'none', label: 'None' }, { id: 'eps', label: 'EPS socket' }, { id: 'whole-home', label: 'Whole home' }]} />
            <div className="text-[11.5px] text-muted-b mt-2 leading-snug">{bd.backup === 'none' ? 'The battery shuts down with the grid (standard).' : bd.backup === 'eps' ? `An emergency socket keeps working in a power cut${p.backup === 'none' ? ` — ${p.brand} ${p.name} doesn’t offer it` : ''}.` : p.backup === 'whole-home' ? 'The whole house runs through a gateway/changeover in a power cut — earthing for island mode is designed on survey.' : `${p.brand} ${p.name} only offers an EPS socket — choose GivEnergy or Tesla for whole-home backup.`}</div>
          </Panel>
        </div>

        <Panel title="A typical day" sub={`What the battery does in June and December — ${inputs.imp.name}${bd.mode !== 'self' ? ', grid top-up shaded' : ''}`} icon={Pie} action={<DayLegend battery />}>
          <div className="grid grid-cols-2 gap-6">
            <DayChart day={withBatt.days.summer} capKwh={usable} title="June" />
            <DayChart day={withBatt.days.winter} capKwh={usable} title="December" />
          </div>
        </Panel>

        <div className="grid grid-cols-2 gap-4">
          <Panel title="Where it goes" sub="PAS 63100:2024 — fire safety of home batteries" icon={Home} action={<ProvChip value={bd.locationSource ?? 'estimate'} onChange={(v) => set({ locationSource: v })} />}>
            <div className="grid grid-cols-2 gap-1.5">
              {LOCATIONS.map((l) => {
                const on = l.id === bd.location
                return (
                  <button key={l.id} onClick={() => set({ location: l.id as BatteryLocation, checks: {} })} disabled={l.allowed === false}
                    className={`text-left rounded-[9px] border px-2.5 py-2 text-[12.5px] ${on ? 'border-[#15223B] bg-[#15223B] text-white font-bold' : l.allowed === false ? 'border-dashed border-border text-muted-2 line-through cursor-not-allowed' : 'border-border text-ink-2 hover:border-[#62E4CC]'}`}>{l.label}</button>
                )
              })}
            </div>
            <div className={`text-[12px] mt-3 leading-snug ${comp.siting.ok ? 'text-[#0E7A66] font-semibold' : 'text-ink-2'}`}>{comp.siting.text}</div>
            {comp.checks.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-2.5">
                {comp.checks.map((c) => {
                  const on = !!bd.checks?.[c.id]
                  return (
                    <button key={c.id} onClick={() => set({ checks: { ...(bd.checks ?? {}), [c.id]: !on } })} className="flex items-center gap-2 text-left text-[12.5px] text-ink-2">
                      <span className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 ${on ? 'bg-[#15223B] border-[#15223B] text-[#62E4CC]' : 'border-input-border bg-white'}`}>{on && <Check size={11} />}</span>{c.label}
                    </button>
                  )
                })}
              </div>
            )}
          </Panel>

          <Panel title="Grid connection" sub="Inverter capacity per phase — PV and battery together" icon={Bolt}>
            <div className="flex items-baseline gap-2">
              <span className={`text-[22px] font-extrabold tabular-nums ${comp.route.code === 'G98' ? 'text-[#0E7A66]' : 'text-ink'}`}>{comp.route.code}</span>
              <span className="text-[13px] text-muted-b">{comp.totalKw} kW total</span>
            </div>
            <div className="text-[12.5px] text-ink-2 mt-1.5 leading-snug">{comp.route.text}</div>
            <ul className="mt-2.5 text-[12px] text-muted-b list-disc pl-4">{comp.parts.map((x) => <li key={x}>{x}</li>)}</ul>
            {comp.route.code === 'G99' && <div className="text-[12px] text-ink-2 mt-2.5 leading-snug">To stay on G98: choose the 3.6 kW inverter option, or fit a G100 export limiter (set on the Electrical tab) and apply as G99/G100 — usually quicker to approve.</div>}
            {comp.hybridReplaces && scope.pv && <div className="text-[11.5px] text-muted-2 mt-2.5">DC-coupled: {p.inverter} replaces the PV inverter — the Electrical tab's string design should use its MPPT limits.</div>}
          </Panel>
        </div>
      </div>
    </div>
  )
}
