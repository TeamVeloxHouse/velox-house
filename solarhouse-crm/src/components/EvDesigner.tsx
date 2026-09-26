/* EV charger step — the car, the charger, and whether it fits on the house's supply: maximum demand against the
 * main fuse, earthing (PME open-PEN), cable size and volt drop, protection, the consumer unit, DNO and grant.
 * Mostly numbers and checks, with one verdict at the top the adviser can say out loud. */
import { useMemo } from 'react'
import type { Design, DesignPlane, EvDesign } from '../store/types'
import { useActions, useState_ } from '../store/store'
import { Panel, Kpi } from './ui'
import { Bolt, Target, Home, Pie, Check, Wrench } from './icons'
import { Dropdown } from './Dropdown'
import { CHARGERS, VEHICLES } from '../lib/catalogue'
import { evOf, homeOf, attribute } from '../lib/homeSystem'
import { tariffById } from '../lib/tariffs'
import { evInstall, evInstallCost } from '../lib/evInstall'
import { designPrice } from '../lib/designPrice'
import { useSystem, ProvChip, Field, NumIn, Seg, gbp, inputCls } from './systemUi'

const VERDICT = {
  fits: { title: 'Fits on the supply', tone: '#0E7A66', bg: '#E4F7F2' },
  'load-management': { title: 'Fits with load management', tone: '#92400E', bg: '#FEF3C7' },
  upgrade: { title: 'Supply upgrade needed', tone: '#B01B4F', bg: '#FDE8EE' },
} as const

export function EvDesigner({ design, moduleId, effTilt }: { design: Design; moduleId: string; effTilt: (p: DesignPlane) => number }) {
  const act = useActions()
  const { studioConfig } = useState_()
  const ev = evOf(design), home = homeOf(design)
  const set = (patch: Partial<EvDesign>) => act.updateDesign(design.id, { evDesign: { ...ev, ...patch } })
  const x = evInstall(design)
  const { inputs } = useSystem(design, moduleId, effTilt)
  const cur = { imp: tariffById(home.tariffId)!, exp: tariffById(home.exportTariffId)! }
  const attr = useMemo(() => attribute(inputs, cur), [inputs]) // eslint-disable-line react-hooks/exhaustive-deps
  const cpm = attr.evCostPerMile
  const price = designPrice(design, 0, 0, studioConfig).ev
  const v = VERDICT[x.verdict]
  const homeKwh = Math.round(((ev.annualMiles / x.car.miPerKwh) * 1.1 * ev.homeSharePct) / 100)
  const solarShare = attr.full.evKwh > 0 ? (attr.full.evFromSolar + attr.full.evFromBattery) / attr.full.evKwh : 0

  return (
    <div className="absolute inset-0 overflow-y-auto px-5 py-5">
      <div className="max-w-[1100px] mx-auto flex flex-col gap-4">
        <div className="rounded-[14px] border px-5 py-4 flex items-center gap-4" style={{ background: v.bg, borderColor: v.bg }}>
          <span className="w-11 h-11 rounded-[12px] bg-[#15223B] text-[#62E4CC] flex items-center justify-center shrink-0"><Bolt size={20} /></span>
          <div className="flex-1 min-w-0">
            <div className="text-[17px] font-extrabold" style={{ color: v.tone }}>{v.title}</div>
            <div className="text-[12.5px] text-ink-2 mt-0.5">{x.checks[0].value} — {x.checks[0].note}</div>
          </div>
          <div className="text-right shrink-0"><div className="text-[11px] text-muted-b">{home.supply.source === 'survey' ? 'Supply confirmed on survey' : 'Supply is an estimate'}</div><div className="mt-1"><ProvChip value={home.supply.source} onChange={(s) => act.updateDesign(design.id, { home: { ...home, supply: { ...home.supply, source: s } } })} /></div></div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Kpi variant="navy" icon={Bolt} label="Charger" value={`${x.chargeKw} kW`} delta={`${x.charger.brand} ${x.charger.name} · ${x.evA} A`} deltaTone="muted" />
          <Kpi variant="teal" icon={Target} label="Cost per mile at home" value={cpm ? `${(cpm.system * 100).toFixed(1)}p` : '—'} delta={cpm ? `vs ${(cpm.grid * 100).toFixed(1)}p grid-only · ${(cpm.petrol * 100).toFixed(1)}p petrol` : ''} deltaTone="muted" />
          <Kpi icon={Home} label="Car's home energy" value={`${homeKwh.toLocaleString()} kWh`} delta={`${Math.round(solarShare * 100)}% from the roof or battery`} deltaTone="positive" />
          <Kpi icon={Pie} label="Install price" value={gbp(price)} delta={x.grant.eligible ? 'before the OZEV grant (up to £500)' : 'no grant for owner-occupied houses'} deltaTone="muted" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Panel title="The car" sub="How much it will charge at home" icon={Target}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Car"><Dropdown value={ev.vehicleId} onChange={(e) => set({ vehicleId: e.target.value })} className={inputCls}>{VEHICLES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Dropdown></Field>
              <Field label="Miles a year"><NumIn value={ev.annualMiles} step={500} suffix="mi" onChange={(n) => set({ annualMiles: n })} /></Field>
              <Field label="Charged at home" hint="the rest is public/work charging"><NumIn value={ev.homeSharePct} max={100} step={5} suffix="%" onChange={(n) => set({ homeSharePct: n })} /></Field>
              <Field label="Car" hint="battery · efficiency · max AC"><div className="h-9 flex items-center text-[12.5px] text-ink-2">{x.car.batteryKwh} kWh · {x.car.miPerKwh} mi/kWh · {x.car.acKw} kW</div></Field>
            </div>
            <div className="text-[11.5px] font-bold uppercase tracking-wide text-muted-3 mt-4 mb-1.5">When it charges</div>
            <Seg value={ev.strategy} onChange={(s) => set({ strategy: s })} options={[{ id: 'solar', label: 'Solar first' }, { id: 'offpeak', label: 'Cheap overnight' }, { id: 'dumb', label: 'When plugged in' }]} />
            <div className="text-[11.5px] text-muted-b mt-2 leading-snug">{ev.strategy === 'solar' ? `Soaks up spare solar in the day, then tops up in the cheap window${x.charger.solarDivert ? '' : ` — ${x.charger.brand} ${x.charger.name} has no solar-only mode, so pick a zappi or Hypervolt for this`}.` : ev.strategy === 'offpeak' ? 'Charges only in the tariff\'s cheap hours — the default for smart chargers.' : 'Charges from ~6pm when plugged in — the most expensive way.'}</div>
          </Panel>

          <Panel title="Charger" sub="Stock list — example trade prices" icon={Bolt}>
            <div className="flex flex-col gap-1.5">
              {CHARGERS.map((c) => {
                const on = c.id === ev.chargerId
                const tags = [c.solarDivert && 'solar mode', c.iog && 'Intelligent Octopus', c.penBuiltIn ? 'built-in PEN' : 'needs earth rod on PME', c.tethered]
                return (
                  <button key={c.id} onClick={() => set({ chargerId: c.id })} className={`text-left rounded-[10px] border px-3 py-2 flex items-center gap-3 ${on ? 'border-[#15223B] bg-[#15223B]' : 'border-border bg-white hover:border-[#62E4CC]'}`}>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[13px] font-bold ${on ? 'text-white' : 'text-ink'}`}>{c.brand} {c.name}</div>
                      <div className={`text-[11px] truncate ${on ? 'text-white/70' : 'text-muted-b'}`}>{tags.filter(Boolean).join(' · ')}</div>
                    </div>
                    <span className={`text-[12px] font-semibold tabular-nums ${on ? 'text-[#62E4CC]' : 'text-ink-3'}`}>£{c.unitCost}</span>
                  </button>
                )
              })}
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-[1fr_1.1fr] gap-4">
          <Panel title="Maximum demand" sub={`Against the ${x.fuse} A main fuse — typical diversity, the car at 100%`} icon={Home}>
            <div className="flex flex-col">
              {x.lines.map((l) => (
                <div key={l.label} className="flex items-center gap-3 py-1.5 border-b border-divider last:border-0">
                  <div className="flex-1 min-w-0"><div className="text-[12.5px] font-semibold text-ink">{l.label}</div><div className="text-[11px] text-muted-2">{l.note}</div></div>
                  <div className="text-[13px] font-bold text-ink tabular-nums">{l.amps} A</div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <div className="h-3 rounded-full bg-[#EEF1F5] overflow-hidden flex">
                <span style={{ width: `${Math.min(100, (x.houseA / Math.max(x.fuse, x.totalA)) * 100)}%`, background: '#9AA7B6' }} />
                <span style={{ width: `${Math.min(100, (x.evA / Math.max(x.fuse, x.totalA)) * 100)}%`, background: '#15223B' }} />
              </div>
              <div className="flex justify-between text-[11px] text-muted-b mt-1.5"><span>House {x.houseA} A + car {x.evA} A = <b className="text-ink">{x.totalA} A</b></span><span>Fuse {x.fuse} A</span></div>
            </div>
          </Panel>

          <Panel title="Install design" sub="Checked against BS 7671 / IET EV Code of Practice — the electrician confirms on site" icon={Wrench} action={<ProvChip value={ev.source} onChange={(s) => set({ source: s })} />}>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <Field label="Charger on"><Dropdown value={ev.chargerLocation} onChange={(e) => set({ chargerLocation: e.target.value as EvDesign['chargerLocation'] })} className={inputCls}><option value="house-wall">Outside house wall</option><option value="garage">Inside the garage</option><option value="post">Post on the drive</option></Dropdown></Field>
              <Field label="Cable run"><NumIn value={ev.cableRunM} max={80} suffix="m" onChange={(n) => set({ cableRunM: n })} /></Field>
              <Field label="Route"><Dropdown value={ev.install} onChange={(e) => set({ install: e.target.value as EvDesign['install'] })} className={inputCls}><option value="clipped">Clipped to walls</option><option value="conduit">In conduit / trunking</option><option value="buried">Buried (duct)</option></Dropdown></Field>
            </div>
            <div className="flex flex-col gap-2">
              {x.checks.slice(1).map((c) => (
                <div key={c.label} className="flex items-start gap-2.5">
                  <span className={`mt-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${c.ok ? 'bg-[#15223B] text-[#62E4CC]' : c.warn ? 'bg-[#FEF3C7] text-[#92400E]' : 'bg-[#FDE8EE] text-[#B01B4F]'}`}>{c.ok ? <Check size={11} /> : '!'}</span>
                  <div className="min-w-0"><div className="text-[12.5px] font-bold text-ink">{c.label} <span className="font-medium text-ink-2">· {c.value}</span></div><div className="text-[11.5px] text-muted-b leading-snug">{c.note}</div></div>
                </div>
              ))}
            </div>
            <div className={`text-[12px] mt-3 leading-snug ${x.grant.eligible ? 'text-[#0E7A66] font-semibold' : 'text-muted-b'}`}>{x.grant.text}</div>
            <div className="text-[11px] text-muted-2 mt-2">Install cost (trade): {gbp(evInstallCost(x, ev.cableRunM))} — charger, cable, protection{x.needsRod ? ', earth rod' : ''}{x.needsSubboard ? ', sub-board' : ''} and labour.</div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
