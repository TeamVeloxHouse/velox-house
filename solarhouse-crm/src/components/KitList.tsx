import { designPrice } from '../lib/designPrice'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Kpi, Panel } from './ui'
import { Box, Dollar, File, Layers as Truck, Wrench } from './icons'
import { useActions, useState_ } from '../store/store'
import type { Delivery, Design } from '../store/types'
import { buildBom, bomTotals, bomCsv, lineTotal, type BomCategory } from '../lib/bom'
import { systemPrice } from '../lib/finance'
import { moduleById } from '../lib/panels'

/* Kit list tab — the bill of materials for this design, what it costs against the quote, and one click to put
 * it on the customer's delivery record as orders grouped by supplier. */

const gbp = (n: number) => `£${Math.round(n).toLocaleString()}`
const CATS: BomCategory[] = ['Solar modules', 'Inverter & battery', 'EV charger', 'Mounting', 'DC electrical', 'AC electrical', 'Site & access']
const DAY_RATE = 220 // £ per installer-day, example figure

export function KitList({ design, moduleId, kwp }: { design: Design; moduleId: string; kwp: number }) {
  const act = useActions()
  const nav = useNavigate()
  const { deals, studioConfig } = useState_()
  const lines = useMemo(() => buildBom(design, moduleId), [design, moduleId])
  const [include, setInclude] = useState<Set<string>>(() => new Set(lines.filter((l) => l.optional).map((l) => l.id)))
  const { total, bySupplier, used } = bomTotals(lines, include)
  const panels = design.planes.reduce((s, p) => s + (p.panels?.length ?? 0), 0)
  const price = design.priceOverride ?? designPrice(design, kwp, panels, studioConfig).total
  const installDays = kwp > 6 ? 2 : 1, labour = installDays * 2 * DAY_RATE
  const margin = price - total - labour
  const deal = deals.find((d) => d.id === design.dealId)

  if (!panels) return <div className="absolute inset-0 flex items-center justify-center text-[13px] text-muted-b">Place panels first — the kit list is worked out from the layout.</div>

  const download = () => {
    const blob = new Blob([bomCsv(used)], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `kit-list-${design.name.replace(/[^\w]+/g, '-').toLowerCase()}.csv`; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
  const sendToDelivery = () => {
    if (!deal?.journey) return
    const j = deal.journey
    const kit = used.map((l) => ({ item: l.item, qty: l.qty, detail: `${l.detail} · ${l.unit}` }))
    const orders = [...bySupplier].map(([supplier, g]) => ({ supplier, items: g.items.map((l) => `${l.qty}${l.unit === 'pcs' ? '×' : ` ${l.unit}`} ${l.item}`).join(', '), status: 'to-order' as const, value: Math.round(g.value) }))
    const base: Delivery = j.delivery ?? {
      kit: [], orders: [], scaffold: { company: '', status: 'not-booked' }, installDays,
      checklist: ['Scaffold inspected & signed off', 'Array installed & fixings photographed', 'Inverter & battery mounted', 'DC & AC tested (IR, polarity, Zs)', 'Monitoring online', 'Customer walkthrough done', 'Site left clean'].map((label) => ({ label, done: false })),
      commissioning: {}, payments: [], snags: [],
    }
    // keep orders already placed; replace only the ones still waiting to be ordered
    const placed = base.orders.filter((o) => o.status !== 'to-order')
    act.updateDeal(deal.id, { journey: { ...j, delivery: { ...base, kit, orders: [...placed, ...orders], installDays: base.installDays || installDays } } })
    act.toast(`Kit list sent to ${deal.name}'s delivery · ${orders.length} orders to place`)
  }

  return (
    <div className="absolute inset-0 overflow-y-auto px-5 py-5">
      <div className="max-w-[1150px] mx-auto flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-3">
          <Kpi variant="navy" icon={Box} label="Kit cost" value={gbp(total)} delta={`${used.length} lines · ${bySupplier.size} suppliers`} />
          <Kpi icon={Wrench} label="Labour (estimate)" value={gbp(labour)} delta={`${installDays} day${installDays > 1 ? 's' : ''} × 2 installers at ${gbp(DAY_RATE)}`} deltaTone="muted" />
          <Kpi icon={Dollar} label="Quoted price" value={gbp(price)} delta={design.priceOverride ? 'set on the Savings tab' : 'from Studio pricing'} deltaTone="muted" />
          <Kpi variant={margin > 0 ? 'teal' : 'plain'} icon={Dollar} label="Gross margin" value={gbp(margin)} meter={Math.max(0, Math.min(100, (margin / Math.max(1, price)) * 100))} delta={`${Math.round((margin / Math.max(1, price)) * 100)}% of the price`} deltaTone={margin > 0 ? 'positive' : 'negative'} />
        </div>

        <Panel title="Kit list" sub={`${panels} × ${moduleById(design.planes.find((p) => p.panels?.length)?.moduleId ?? moduleId).brand} modules · mounting from the real panel rows · electrical from the Electrical tab. Example trade prices — swap in your wholesaler's list.`} icon={Box}
          action={<div className="flex gap-2">
            <button onClick={download} className="h-8 px-3 rounded-[8px] border border-[#DEE3EA] text-[12px] font-semibold text-ink-3 hover:bg-control inline-flex items-center gap-1.5"><File size={13} />CSV</button>
            <button onClick={sendToDelivery} disabled={!deal?.journey} title={deal?.journey ? '' : 'Link this design to a customer deal first'} className="h-8 px-3 rounded-[8px] bg-[#15223B] text-white text-[12px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"><Truck size={13} className="text-[#62E4CC]" />Send to delivery</button>
          </div>}>
          <div className="rounded-[10px] border border-[#E6EAF0] overflow-hidden">
            <div className="grid grid-cols-[28px_1.6fr_2fr_70px_90px_100px_1.1fr] gap-2 px-3 py-2 bg-[#F1F4F7] text-[10.5px] font-bold uppercase tracking-wide text-muted-b">
              <span /><span>Item</span><span>Detail</span><span className="text-right">Qty</span><span className="text-right">Unit £</span><span className="text-right">Line £</span><span>Supplier</span>
            </div>
            {CATS.map((cat) => {
              const ls = lines.filter((l) => l.category === cat)
              if (!ls.length) return null
              const sub = ls.filter((l) => !l.optional || include.has(l.id)).reduce((s, l) => s + lineTotal(l), 0)
              return (
                <div key={cat}>
                  <div className="flex items-center px-3 py-1.5 bg-[#FAFBFC] border-t border-[#EEF1F5] text-[11.5px] font-bold text-ink-2"><span>{cat}</span><span className="ml-auto tabular-nums">{gbp(sub)}</span></div>
                  {ls.map((l) => {
                    const on = !l.optional || include.has(l.id)
                    return (
                      <div key={l.id} className={`grid grid-cols-[28px_1.6fr_2fr_70px_90px_100px_1.1fr] gap-2 px-3 py-2 border-t border-[#F1F3F6] text-[12.5px] items-center ${on ? '' : 'opacity-45'}`}>
                        {l.optional ? <input type="checkbox" checked={on} onChange={() => { const n = new Set(include); if (on) n.delete(l.id); else n.add(l.id); setInclude(n) }} className="accent-[#0E7A66]" title="Optional extra" /> : <span />}
                        <b className="text-ink">{l.item}{l.optional && <span className="ml-1.5 text-[10px] font-semibold text-muted-b uppercase">optional</span>}</b>
                        <span className="text-muted-b">{l.detail}</span>
                        <span className="text-right tabular-nums font-semibold text-ink">{l.qty.toLocaleString()} <span className="text-muted-3 font-normal">{l.unit}</span></span>
                        <span className="text-right tabular-nums text-ink-3">{l.unitCost.toFixed(2)}</span>
                        <span className="text-right tabular-nums font-semibold text-ink">{lineTotal(l).toFixed(2)}</span>
                        <span className="text-ink-3 truncate">{l.supplier}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
            <div className="flex items-center px-3 py-2.5 bg-[#15223B] text-white text-[13px] font-bold"><span>Total kit</span><span className="ml-auto tabular-nums">{gbp(total)}</span></div>
          </div>
        </Panel>

        <Panel title="Orders by supplier" sub={deal ? `Send to delivery puts these on ${deal.name}'s record as orders to place — orders already placed are kept` : 'Link this design to a deal to send the orders to delivery'} icon={Truck}
          action={deal ? <button onClick={() => nav(`/deals/${deal.id}?tab=delivery`)} className="text-[12px] font-semibold text-accent">Open delivery →</button> : undefined}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...bySupplier].map(([s, g]) => (
              <div key={s} className="rounded-[10px] border border-[#E6EAF0] p-3">
                <div className="text-[12.5px] font-bold text-ink">{s}</div>
                <div className="text-[20px] font-bold text-ink tabular-nums mt-0.5">{gbp(g.value)}</div>
                <div className="text-[11.5px] text-muted-b">{g.items.length} line{g.items.length > 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}
