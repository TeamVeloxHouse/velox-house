/* What each part of the system is worth — the home as it is today, then solar, the battery and the tariff switch
 * added one at a time on the same half-hourly simulation. Sits at the top of the Savings tab (and is the whole
 * Savings tab for a battery-only retrofit), so the adviser can price products separately or as a bundle. */
import { useMemo } from 'react'
import type { Design, DesignPlane } from '../store/types'
import { useState_ } from '../store/store'
import { Panel } from './ui'
import { Target } from './icons'
import { attribute, homeOf } from '../lib/homeSystem'
import { tariffById } from '../lib/tariffs'
import { designPrice } from '../lib/designPrice'
import { useSystem, gbp, pct } from './systemUi'

export function SystemSavings({ design, moduleId, effTilt, kwp, panels }: { design: Design; moduleId: string; effTilt: (p: DesignPlane) => number; kwp: number; panels: number }) {
  const { studioConfig } = useState_()
  const { inputs } = useSystem(design, moduleId, effTilt)
  const home = homeOf(design)
  const cur = { imp: tariffById(home.tariffId)!, exp: tariffById(home.exportTariffId)! }
  const a = useMemo(() => attribute(inputs, cur), [inputs]) // eslint-disable-line react-hooks/exhaustive-deps
  const price = designPrice(design, kwp, panels, studioConfig)
  const priceOf: Record<string, number> = { pv: price.pv, battery: price.battery }
  const evBill = inputs.ev ? a.full.evKwh : 0
  const total = a.steps.reduce((s, x) => s + x.saving, 0)
  const max = Math.max(1, ...a.steps.map((s) => Math.abs(s.saving)))
  return (
    <Panel title="What each part is worth" sub={`Half-hourly simulation of this home — first year, ${a.full.demandKwh.toLocaleString()} kWh use${inputs.ev ? ` + ${evBill.toLocaleString()} kWh car` : ''}`} icon={Target}>
      <div className="grid grid-cols-[1.4fr_1fr] gap-6">
        <div className="flex flex-col gap-2">
          <Row label="Electricity bill today" sub={`${cur.imp.name}${inputs.ev ? ', charging the car at home' : ''}`} value={gbp(a.full.net + total)} strong />
          {a.steps.map((s) => (
            <div key={s.key} className="grid grid-cols-[1fr_140px_90px_80px] items-center gap-3">
              <div className="min-w-0"><div className="text-[13px] font-semibold text-ink truncate">{s.label}</div>{priceOf[s.key] ? <div className="text-[11px] text-muted-2">{gbp(priceOf[s.key])} · pays back in ~{s.saving > 0 ? (priceOf[s.key] / s.saving).toFixed(1) : '—'} yrs</div> : s.key === 'tariff' ? <div className="text-[11px] text-muted-2">free — just a switch</div> : null}</div>
              <span className="h-3.5 rounded-[4px] bg-[#EEF1F5] overflow-hidden"><span className="block h-full rounded-[4px]" style={{ width: `${Math.max(3, (Math.abs(s.saving) / max) * 100)}%`, background: s.saving >= 0 ? '#62E4CC' : '#F5A5B8' }} /></span>
              <span className="text-[13px] font-bold text-[#0E7A66] tabular-nums text-right">−{gbp(s.saving)}</span>
              <span className="text-[11px] text-muted-2 text-right">a year</span>
            </div>
          ))}
          <Row label="Bill with the system" sub={`${inputs.imp.name} · export on ${inputs.exp.name}`} value={gbp(a.full.net)} strong teal />
        </div>
        <div className="grid grid-cols-2 gap-2.5 content-start">
          <Mini label="Saving a year" value={gbp(total)} />
          <Mini label="Self-sufficiency" value={pct(a.full.selfSufficiency)} />
          <Mini label="Solar used at home" value={a.full.genKwh ? pct(a.full.selfConsumption) : '—'} />
          <Mini label="Exported" value={`${a.full.exportKwh.toLocaleString()} kWh`} />
          {a.evCostPerMile && <Mini label="Car, per mile" value={`${(a.evCostPerMile.system * 100).toFixed(1)}p`} sub={`petrol ~${(a.evCostPerMile.petrol * 100).toFixed(0)}p`} />}
          {price.ev > 0 && <Mini label="EV charger install" value={gbp(price.ev)} sub="valued per mile, not in the payback" />}
        </div>
      </div>
      <div className="text-[11px] text-muted-2 mt-3 leading-snug">Each line is the extra saving from adding that product on top of the ones above it, on the customer's current tariff; the switch line is moving to the tariff chosen on Home &amp; usage. Standing charges are left out (paid either way). The 20-year figures below use the solar + battery price.</div>
    </Panel>
  )
}
function Row({ label, sub, value, strong, teal }: { label: string; sub?: string; value: string; strong?: boolean; teal?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-[10px] px-3 py-2 ${teal ? 'bg-[#15223B] text-white' : 'bg-[#F4F7FA]'}`}>
      <div className="flex-1 min-w-0"><div className={`text-[13px] ${strong ? 'font-bold' : 'font-semibold'} ${teal ? 'text-white' : 'text-ink'}`}>{label}</div>{sub && <div className={`text-[11px] truncate ${teal ? 'text-white/65' : 'text-muted-2'}`}>{sub}</div>}</div>
      <div className={`text-[16px] font-extrabold tabular-nums ${teal ? 'text-[#62E4CC]' : 'text-ink'}`}>{value}</div>
    </div>
  )
}
function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="rounded-[10px] border border-divider px-3 py-2.5"><div className="text-[11px] text-muted-b">{label}</div><div className="text-[17px] font-extrabold text-ink tabular-nums mt-0.5">{value}</div>{sub && <div className="text-[10.5px] text-muted-2">{sub}</div>}</div>
}
