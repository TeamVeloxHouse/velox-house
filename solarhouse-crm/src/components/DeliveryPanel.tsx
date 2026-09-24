import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Bolt, Sun, Wrench, File, Dollar, Box, Calendar, Plus, Home, Clock } from './icons'
import { useActions, useState_ } from '../store/store'
import { money, classNames } from '../lib/format'
import type { Deal, Delivery } from '../store/types'
import { INSTALL_STAGES, installStage, installAt, outstanding } from '../lib/installs'

/* The Delivery tab of a customer record — everything ops needs between contract and handover,
 * on the same record Sales uses. Every control writes back to the deal, so it's live. */

const fmt = (t?: number) => (t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const ORDER_TONE = { 'to-order': ['To order', '#B45309', '#FDF3E3'], ordered: ['On order', '#0A64AD', '#E7F0FA'], delivered: ['Delivered', '#0E7C66', '#E9F5F1'] } as const
const PAY_TONE = { paid: ['Paid', '#0E7C66', '#E9F5F1'], due: ['Due', '#B45309', '#FDF3E3'], overdue: ['Overdue', '#B01B4F', '#FDECEF'], 'not-due': ['Not yet due', '#7A8494', '#F1F3F7'] } as const

export function DeliveryPanel({ d }: { d: Deal }) {
  const act = useActions()
  const nav = useNavigate()
  const { portals } = useState_()
  const j = d.journey!, del = j.delivery!
  const st = installStage(d), at = installAt(d)
  const dno = j.steps.find((s) => s.key === 'dno'), hand = j.steps.find((s) => s.key === 'handover'), ins = j.steps.find((s) => s.key === 'install')
  const portal = portals.find((p) => p.dealId === d.id)
  const [snag, setSnag] = useState('')
  const save = (patch: Partial<Delivery>, msg?: string) => { act.updateDeal(d.id, { journey: { ...j, delivery: { ...del, ...patch } } }); if (msg) act.toast(msg) }
  const paid = del.payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const owed = outstanding(d)
  const stageIdx = INSTALL_STAGES.indexOf(st)

  return (
    <div className="flex flex-col gap-4">
      {/* delivery tracker */}
      <div className="rounded-card bg-surface border border-border shadow-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wrench size={15} className="text-accent" /><span className="text-[14px] font-bold text-ink">Delivery status</span>
          <span className="text-[11.5px] font-semibold rounded-full px-2 py-0.5 bg-accent text-white ml-1">{st}</span>
          {at && st !== 'Complete' && <span className="ml-auto text-[12.5px] text-ink-3"><Calendar size={13} className="inline mr-1 text-muted-3" />{at > Date.now() ? `Install in ${Math.ceil((at - Date.now()) / 86_400_000)} days · ` : ''}{new Date(at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>}
        </div>
        <div className="flex items-center">
          {INSTALL_STAGES.map((s, i) => (
            <div key={s} className="flex-1 flex items-center">
              <div className="flex flex-col items-center flex-1">
                <span className={classNames('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2', i < stageIdx ? 'bg-accent-500 border-accent-500 text-white' : i === stageIdx ? 'border-accent text-accent bg-white ring-4 ring-accent-wash' : 'border-border text-muted-3 bg-white')}>{i < stageIdx ? <Check size={11} /> : i + 1}</span>
                <span className={classNames('text-[10.5px] mt-1 text-center', i === stageIdx ? 'font-bold text-ink' : 'text-muted-2')}>{s}</span>
              </div>
              {i < INSTALL_STAGES.length - 1 && <span className={classNames('h-[2px] flex-1 -mt-4', i < stageIdx ? 'bg-accent-500' : 'bg-border')} />}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* DNO */}
        <Panel icon={Bolt} title="DNO / grid connection" action={<button onClick={() => nav('/studio/dno')} className="text-[12px] font-semibold text-accent">DNO Autopilot →</button>}>
          {dno ? <>
            <KV k="Route" v={`${dno.data?.form} · ${dno.data?.form === 'G99' ? 'apply & wait for approval' : 'notify within 28 days'}`} />
            <KV k="Network" v={String(dno.data?.network ?? '—')} /><KV k="Reference" v={String(dno.data?.reference ?? '—')} />
            <KV k="Submitted" v={fmt(dno.at)} /><KV k="Approved" v={dno.done ? fmt(dno.done) : <span className="text-[#B45309] font-semibold">Awaiting · {Math.floor((Date.now() - dno.at) / 86_400_000)} days so far</span>} />
          </> : <Empty text="Not submitted yet. This is the first thing to do after signing." />}
        </Panel>

        {/* Install plan */}
        <Panel icon={Calendar} title="Install plan">
          <KV k="Install date" v={at ? fmt(at) : <span className="text-[#B45309] font-semibold">Not booked</span>} />
          <KV k="Team" v={del.team ?? '—'} /><KV k="Days on site" v={`${del.installDays}`} />
          <KV k="Scaffold" v={<span className="flex items-center gap-2 justify-end">{del.scaffold.company}
            <select value={del.scaffold.status} onChange={(e) => save({ scaffold: { ...del.scaffold, status: e.target.value as Delivery['scaffold']['status'] } }, 'Scaffold updated')} className="h-7 px-1.5 rounded-md border border-border text-[12px] outline-none">
              {['not-booked', 'booked', 'up', 'down'].map((s) => <option key={s} value={s}>{s.replace('-', ' ')}</option>)}
            </select></span>} />
          {del.scaffold.upAt && <KV k="Scaffold up / down" v={`${fmt(del.scaffold.upAt)} → ${del.scaffold.downAt ? fmt(del.scaffold.downAt) : 'after install'}`} />}
        </Panel>
      </div>

      {/* Kit & orders */}
      <Panel icon={Box} title="Kit list & orders" action={<span className="text-[12px] text-muted-2">{del.orders.filter((o) => o.status === 'delivered').length}/{del.orders.length} delivered</span>}>
        <div className="grid grid-cols-[1fr_1fr] gap-4">
          <table className="w-full text-[12.5px]">
            <thead><tr className="text-[10.5px] uppercase tracking-[0.07em] text-muted-3 text-left"><th className="font-semibold py-1.5">Item</th><th className="font-semibold text-right">Qty</th><th className="font-semibold pl-3">Detail</th></tr></thead>
            <tbody>{del.kit.map((k) => <tr key={k.item} className="border-t border-divider-row"><td className="py-1.5 text-ink-2 font-medium">{k.item}</td><td className="text-right tabular-nums">{k.qty}</td><td className="pl-3 text-muted-b">{k.detail}</td></tr>)}</tbody>
          </table>
          <div className="flex flex-col gap-2">
            {del.orders.map((o, i) => { const [l, c, bg] = ORDER_TONE[o.status]; return (
              <div key={i} className="rounded-lg border border-divider px-3 py-2 flex items-center gap-3">
                <div className="min-w-0 flex-1"><div className="text-[12.5px] font-semibold text-ink-2 truncate">{o.supplier}</div><div className="text-[11.5px] text-muted-2 truncate">{o.items} · {money(o.value, { compact: true })}{o.eta && o.status === 'ordered' ? ` · ETA ${fmt(o.eta)}` : ''}</div></div>
                <select value={o.status} onChange={(e) => save({ orders: del.orders.map((x, k) => (k === i ? { ...x, status: e.target.value as typeof o.status, orderedAt: x.orderedAt ?? Date.now(), deliveredAt: e.target.value === 'delivered' ? Date.now() : x.deliveredAt } : x)) }, 'Order updated')}
                  className="h-7 px-1.5 rounded-full text-[11.5px] font-semibold outline-none border-0" style={{ color: c, background: bg }}>
                  {(['to-order', 'ordered', 'delivered'] as const).map((s) => <option key={s} value={s}>{ORDER_TONE[s][0]}</option>)}
                </select>
                <span className="sr-only">{l}</span>
              </div>
            ) })}
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-4">
        {/* Install-day checklist */}
        <Panel icon={Check} title="Install-day checklist" action={<span className="text-[12px] text-muted-2">{del.checklist.filter((c) => c.done).length}/{del.checklist.length}</span>}>
          {del.checklist.map((c, i) => (
            <label key={c.label} className="flex items-center gap-2.5 py-1 text-[12.5px] text-ink-2 cursor-pointer">
              <input type="checkbox" checked={c.done} onChange={() => save({ checklist: del.checklist.map((x, k) => (k === i ? { ...x, done: !x.done } : x)) })} style={{ accentColor: '#0E7A66' }} />
              <span className={c.done ? 'text-muted-2 line-through' : ''}>{c.label}</span>
            </label>
          ))}
        </Panel>

        {/* Commissioning */}
        <Panel icon={Sun} title="Commissioning results">
          {Object.keys(del.commissioning).length ? Object.entries(del.commissioning).map(([k, v]) => <KV key={k} k={k} v={v} />) : <Empty text="Recorded on install day: IR, Zs, Voc, export limit and monitoring." />}
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Payments */}
        <Panel icon={Dollar} title="Payments" action={<span className="text-[12px] text-muted-2">{money(paid)} paid · <b className={owed ? 'text-ink-2' : ''}>{money(owed)} to collect</b></span>}>
          {del.payments.map((p, i) => { const [l, c, bg] = PAY_TONE[p.status]; return (
            <div key={i} className="flex items-center gap-3 py-1.5 border-b border-divider-row last:border-0">
              <div className="flex-1"><div className="text-[12.5px] font-semibold text-ink-2">{p.label}</div><div className="text-[11.5px] text-muted-2">{p.at ? fmt(p.at) : 'On completion'}</div></div>
              <span className="text-[13px] font-bold text-ink tabular-nums">{money(p.amount)}</span>
              <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 w-[82px] text-center" style={{ color: c, background: bg }}>{l}</span>
              {p.status !== 'paid' && p.status !== 'not-due' && <button onClick={() => save({ payments: del.payments.map((x, k) => (k === i ? { ...x, status: 'paid', at: Date.now() } : x)) }, `${p.label} marked paid`)} className="text-[11.5px] font-semibold text-accent">Mark paid</button>}
            </div>
          ) })}
        </Panel>

        {/* Snags */}
        <Panel icon={Clock} title={`Snags · ${del.snags.filter((s) => s.status === 'open').length} open`}>
          {del.snags.map((s, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 border-b border-divider-row last:border-0 text-[12.5px]">
              <span className={classNames('w-2 h-2 rounded-full', s.status === 'open' ? 'bg-negative' : 'bg-positive')} />
              <span className={classNames('flex-1', s.status === 'fixed' && 'text-muted-2 line-through')}>{s.text}</span><span className="text-[11px] text-muted-3">{fmt(s.at)}</span>
              {s.status === 'open' && <button onClick={() => save({ snags: del.snags.map((x, k) => (k === i ? { ...x, status: 'fixed' } : x)) }, 'Snag fixed')} className="text-[11.5px] font-semibold text-accent">Fixed</button>}
            </div>
          ))}
          {!del.snags.length && <div className="text-[12.5px] text-muted-2 py-1">No snags logged.</div>}
          <div className="flex gap-2 mt-2">
            <input value={snag} onChange={(e) => setSnag(e.target.value)} placeholder="Log a snag…" className="flex-1 h-8 px-2.5 rounded-control border border-border text-[12.5px] outline-none focus:border-accent" />
            <button onClick={() => { if (!snag.trim()) return; save({ snags: [...del.snags, { text: snag.trim(), status: 'open', at: Date.now() }] }, 'Snag logged'); setSnag('') }} className="h-8 px-2.5 rounded-control border border-border text-[12px] font-semibold text-ink-3 hover:bg-control flex items-center gap-1"><Plus size={12} />Add</button>
          </div>
        </Panel>
      </div>

      {/* Handover & portal */}
      <Panel icon={Home} title="Handover & customer portal" action={portal && <button onClick={() => nav(`/customers/${portal.id}`)} className="text-[12px] font-semibold text-accent">Open their portal →</button>}>
        <div className="grid grid-cols-4 gap-4">
          <Stat l="Installed" v={ins?.done ? fmt(ins.done) : '—'} />
          <Stat l="MCS certificate" v={String(hand?.data?.mcs ?? '—')} />
          <Stat l="Portal" v={portal ? (portal.status === 'active' ? 'Active' : 'Invited, not opened') : 'Not created'} />
          <Stat l="Review" v={String(hand?.data?.review ?? '—')} />
        </div>
      </Panel>
      <div className="text-[11.5px] text-muted-3 flex items-center gap-1.5"><File size={12} />Documents for this customer are listed on the Customer journey tab.</div>
    </div>
  )
}

function Panel({ icon: I, title, action, children }: { icon: (p: { size?: number; className?: string }) => JSX.Element; title: string; action?: ReactNode; children: ReactNode }) {
  return <section className="rounded-card bg-surface border border-border shadow-card p-4"><div className="flex items-center gap-2 mb-2.5"><I size={14} className="text-muted-3" /><span className="text-[13px] font-bold text-ink flex-1">{title}</span>{action}</div><div className="flex flex-col gap-1">{children}</div></section>
}
function KV({ k, v }: { k: string; v: ReactNode }) { return <div className="flex justify-between gap-3 text-[12.5px] py-0.5"><span className="text-muted-2 shrink-0">{k}</span><span className="text-ink-2 text-right min-w-0">{v}</span></div> }
function Stat({ l, v }: { l: string; v: string }) { return <div><div className="text-[11px] text-muted-2">{l}</div><div className="text-[13px] font-semibold text-ink-2 truncate">{v}</div></div> }
function Empty({ text }: { text: string }) { return <div className="text-[12.5px] text-muted-2">{text}</div> }
