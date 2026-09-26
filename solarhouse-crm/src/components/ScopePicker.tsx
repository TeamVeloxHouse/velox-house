/* "What are we designing?" — the first question on every design. Any mix of solar, battery and EV charger;
 * only the steps the scope needs appear, and they all share one system. Also sets the stage: an Estimate (sales
 * pre-design from satellite and typical values) or Surveyed (checked on site) — the same design moves through both. */
import { useState } from 'react'
import type { Design, DesignScope } from '../store/types'
import { useActions } from '../store/store'
import { Sun, Layers, Bolt, Check, Home } from './icons'
import { scopeOf, DEFAULT_BATTERY, DEFAULT_EV, DEFAULT_HOME, batteryOf } from '../lib/homeSystem'
import { batteryById, usableKwhOf } from '../lib/catalogue'

const TILES: { key: keyof DesignScope; title: string; blurb: string; icon: typeof Sun }[] = [
  { key: 'pv', title: 'Solar panels', blurb: 'Roof panes, layout, strings and yield', icon: Sun },
  { key: 'battery', title: 'Battery', blurb: 'Size, strategy, siting and grid route — new or retrofit', icon: Layers },
  { key: 'ev', title: 'EV charger', blurb: 'Charger, supply check, cable and earthing', icon: Bolt },
]

export function ScopePicker({ design, onDone, onClose }: { design: Design; onDone: (scope: DesignScope) => void; onClose?: () => void }) {
  const act = useActions()
  const [scope, setScope] = useState<DesignScope>(design.scope ?? { pv: true, battery: false, ev: false })
  const [stage, setStage] = useState<'estimate' | 'surveyed'>(design.stage ?? 'estimate')
  const any = scope.pv || scope.battery || scope.ev
  function confirm() {
    if (!any) return
    const bd = scope.battery ? (design.batteryDesign ?? DEFAULT_BATTERY) : design.batteryDesign
    const usable = scope.battery ? usableKwhOf(batteryById(batteryOf({ ...design, batteryDesign: bd }).productId), (bd ?? DEFAULT_BATTERY).units) : 0
    act.updateDesign(design.id, {
      scope, stage, batteryDesign: bd, batteryKwh: usable,
      evDesign: scope.ev ? (design.evDesign ?? DEFAULT_EV) : design.evDesign,
      home: design.home ?? DEFAULT_HOME,
    })
    onDone(scope)
  }
  const was = scopeOf(design)
  return (
    <div className="absolute inset-0 z-[700] flex items-center justify-center bg-[#0B1424]/40 backdrop-blur-[2px] p-6">
      <div className="w-full max-w-[720px] rounded-[18px] bg-white shadow-modal border border-border overflow-hidden">
        <div className="px-7 pt-6 pb-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#0E7A66]">{design.name}</div>
          <div className="text-[22px] font-extrabold text-ink tracking-[-0.02em] mt-1">What are we designing?</div>
          <div className="text-[13px] text-muted-b mt-1">Pick everything the customer is considering — each one adds its own step, and they all share one system and one price.</div>
        </div>
        <div className="px-7 grid grid-cols-3 gap-3">
          {TILES.map((t) => {
            const on = scope[t.key]
            return (
              <button key={t.key} onClick={() => setScope({ ...scope, [t.key]: !on })} className={`relative text-left rounded-[14px] border-2 p-4 transition-colors ${on ? 'border-[#15223B] bg-[#15223B]' : 'border-border bg-white hover:border-[#62E4CC]'}`}>
                <span className={`absolute top-3 right-3 w-5 h-5 rounded-[6px] flex items-center justify-center ${on ? 'bg-[#62E4CC] text-[#15223B]' : 'border border-input-border'}`}>{on && <Check size={12} />}</span>
                <span className={`w-10 h-10 rounded-[11px] flex items-center justify-center ${on ? 'bg-white/10 text-[#62E4CC]' : 'bg-[#E4F7F2] text-[#0E7A66]'}`}><t.icon size={20} /></span>
                <div className={`text-[15px] font-bold mt-3 ${on ? 'text-white' : 'text-ink'}`}>{t.title}</div>
                <div className={`text-[12px] mt-1 leading-snug ${on ? 'text-white/70' : 'text-muted-b'}`}>{t.blurb}</div>
              </button>
            )
          })}
        </div>
        <div className="px-7 mt-3 flex items-center gap-2 text-[12px] text-muted-2"><Home size={13} />Heat pumps are next on the roadmap.{!scope.pv && scope.battery ? ' Battery without solar = a retrofit — you’ll enter the existing array on Home & usage.' : ''}</div>
        <div className="px-7 mt-5">
          <div className="text-[11.5px] font-bold uppercase tracking-wide text-muted-3 mb-2">Stage</div>
          <div className="grid grid-cols-2 gap-3">
            {([['estimate', 'Estimate', 'Sales pre-design from satellite, the bill and typical values — enough for a proposal.'], ['surveyed', 'Surveyed', 'Checked on site: supply, battery location, roof pitch. Re-open this design after the survey — nothing is re-drawn.']] as const).map(([id, t, b]) => (
              <button key={id} onClick={() => setStage(id)} className={`text-left rounded-[12px] border px-4 py-3 ${stage === id ? 'border-[#15223B] bg-[#F4F7FA]' : 'border-border hover:border-[#62E4CC]'}`}>
                <div className="flex items-center gap-2 text-[13.5px] font-bold text-ink"><span className={`w-3.5 h-3.5 rounded-full border-2 ${stage === id ? 'border-[#15223B] bg-[#62E4CC]' : 'border-input-border'}`} />{t}</div>
                <div className="text-[12px] text-muted-b mt-1 leading-snug">{b}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="px-7 py-5 mt-5 border-t border-divider flex items-center justify-between gap-3 bg-[#F8FAFC]">
          <div className="text-[12px] text-muted-b">{design.scope ? `Currently: ${[was.pv && 'solar', was.battery && 'battery', was.ev && 'EV charger'].filter(Boolean).join(' + ')}` : 'You can change this any time from the header.'}</div>
          <div className="flex items-center gap-2">
            {onClose && design.scope && <button onClick={onClose} className="h-10 px-4 rounded-control border border-border text-[13px] font-semibold text-ink-3 hover:bg-control">Cancel</button>}
            <button onClick={confirm} disabled={!any} className={`h-10 px-5 rounded-control text-[13px] font-semibold whitespace-nowrap ${any ? 'bg-[#15223B] text-white' : 'bg-control text-muted-2 cursor-not-allowed'}`}>Start designing</button>
          </div>
        </div>
      </div>
    </div>
  )
}
