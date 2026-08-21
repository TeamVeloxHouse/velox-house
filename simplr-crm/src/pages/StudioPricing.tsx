import { useState, useRef } from 'react'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button } from '../components/ui'
import { Modal, Field, Input, Select } from '../components/overlays'
import { Sun, Plus, Sparkle, File } from '../components/icons'
import { useState_, useActions } from '../store/store'
import { gbp, designFor, monthlyPayment } from '../lib/solar'
import type { FinanceProduct } from '../store/types'

export function StudioPricing() {
  const { studioConfig: cfg } = useState_()
  const act = useActions()
  const [addFin, setAddFin] = useState(false)
  const [addAdd, setAddAdd] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const example = designFor('example', undefined, { costPerKwp: cfg.costPerKwp, baseCost: cfg.baseCost, perPanel: cfg.perPanel, marginPct: cfg.marginPct, vatPct: cfg.vatPct })

  const numField = (label: string, key: 'costPerKwp' | 'baseCost' | 'perPanel' | 'marginPct' | 'vatPct', suffix?: string) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-ink-3">{label}</span>
      <div className="flex items-center gap-2">
        <input type="number" value={cfg[key]} onChange={(e) => act.updateStudioConfig({ [key]: Number(e.target.value) })} className="h-9 px-3 rounded-control border border-input-border bg-white text-[13px] text-ink-2 outline-none focus:border-accent w-full" />
        {suffix && <span className="text-[12px] text-muted-2 shrink-0">{suffix}</span>}
      </div>
    </label>
  )

  const first = cfg.finance[0]
  return (
    <>
      <TopBar title="Pricing & finance" crumbs={['Studio', 'Your calculator']} actions={<Button icon={<Sparkle size={16} />} onClick={() => fileRef.current?.click()}>Build with AI</Button>} />
      <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) act.aiBuildCalculator(f.name); e.currentTarget.value = '' }} />
      <PageBody>
        <div className="rounded-card p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(150deg,#1c3a72,#0c1b38)' }}>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 100% at 90% -10%, rgba(245,166,35,0.22), transparent 55%)' }} />
          <div className="relative flex items-center gap-4">
            <span className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0"><Sparkle size={22} /></span>
            <div className="flex-1">
              <div className="text-[15px] font-bold">Build your calculator with AI</div>
              <div className="text-[13px] mt-0.5" style={{ color: '#c3ccdb' }}>Upload your current price list or a recent quote — Simplr AI extracts your cost/kWp, adders and margins into the calculator below for you to review.</div>
            </div>
            <button onClick={() => fileRef.current?.click()} className="h-9 px-4 rounded-lg text-white text-[13px] font-semibold flex items-center gap-1.5 shrink-0" style={{ background: 'linear-gradient(150deg,#F5A623,#E8721A)' }}><File size={15} /> Upload price list</button>
          </div>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
          <div className="flex flex-col gap-4">
            <div className="bg-surface border border-border rounded-card p-5">
              <div className="text-[14px] font-semibold text-ink mb-3">System pricing</div>
              <div className="grid grid-cols-2 gap-3">
                {numField('Cost per kWp', 'costPerKwp', '£')}
                {numField('Base / fixed cost', 'baseCost', '£')}
                {numField('Per-panel cost', 'perPanel', '£')}
                {numField('Margin', 'marginPct', '%')}
                {numField('VAT', 'vatPct', '%')}
              </div>
            </div>
            <div className="bg-surface border border-border rounded-card p-5">
              <div className="flex items-center justify-between mb-3"><div className="text-[14px] font-semibold text-ink">Optional adders</div><button onClick={() => setAddAdd(true)} className="text-[13px] text-accent font-semibold flex items-center gap-1"><Plus size={14} /> Add</button></div>
              <div className="flex flex-col gap-2">
                {cfg.adders.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                    <span className="text-[13px] text-ink-2 flex-1">{a.name}</span>
                    <span className="text-[13px] font-semibold text-ink-2">{gbp(a.amount)}</span>
                    <button onClick={() => act.removeAdder(a.id)} className="text-[12px] text-negative font-medium hover:underline">Remove</button>
                  </div>
                ))}
                {cfg.adders.length === 0 && <div className="text-[12px] text-muted-2">No adders yet.</div>}
              </div>
            </div>
            <div className="bg-surface border border-border rounded-card p-5">
              <div className="flex items-center justify-between mb-3"><div className="text-[14px] font-semibold text-ink">Finance products <span className="text-[12px] text-muted-2 font-normal">· your own agreements</span></div><button onClick={() => setAddFin(true)} className="text-[13px] text-accent font-semibold flex items-center gap-1"><Plus size={14} /> Add</button></div>
              <div className="flex flex-col gap-2">
                {cfg.finance.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                    <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2">{f.name} <span className="text-muted-3 font-normal">· {f.provider}</span></div><div className="text-[11.5px] text-muted-2">{f.apr}% APR · {f.termMonths / 12} yrs · {f.depositPct}% deposit · {f.type}</div></div>
                    <div className="text-right shrink-0"><div className="text-[14px] font-bold text-ink-2">{gbp(monthlyPayment(example.systemCost, f.apr, f.termMonths, f.depositPct))}<span className="text-[11px] text-muted-3">/mo</span></div></div>
                    <button onClick={() => act.removeFinance(f.id)} className="text-[12px] text-negative font-medium hover:underline shrink-0">Remove</button>
                  </div>
                ))}
                {cfg.finance.length === 0 && <div className="text-[12px] text-muted-2">No finance products yet — add your lender agreements.</div>}
              </div>
              <div className="text-[11px] text-muted-3 mt-2.5 leading-snug">Finance is provided under your own lender agreements — Simplr just shows the payments. UK: displaying consumer finance may require FCA authorisation; take advice before going live.</div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-card p-5 text-white" style={{ background: 'linear-gradient(155deg,#1c3a72,#0c1b38)' }}>
              <div className="text-[12px]" style={{ color: '#93A0B4' }}>Example · {example.systemKwp} kWp system</div>
              <div className="text-[30px] font-bold mt-1">{gbp(example.systemCost)}</div>
              <div className="text-[12.5px] mt-0.5" style={{ color: '#8FB0FF' }}>Built from your pricing above · updates live</div>
              <div className="h-px bg-white/10 my-3" />
              <div className="flex flex-col gap-1.5 text-[12.5px]">
                <div className="flex justify-between"><span style={{ color: '#c3ccdb' }}>Base ({example.systemKwp} kWp)</span><span>{gbp(example.systemKwp * cfg.costPerKwp + cfg.baseCost)}</span></div>
                <div className="flex justify-between"><span style={{ color: '#c3ccdb' }}>Margin</span><span>{cfg.marginPct}%</span></div>
                <div className="flex justify-between"><span style={{ color: '#c3ccdb' }}>VAT</span><span>{cfg.vatPct}%</span></div>
                {first && <div className="flex justify-between pt-1.5 mt-1 border-t border-white/10"><span style={{ color: '#8FE0C6' }}>From</span><span className="font-bold" style={{ color: '#8FE0C6' }}>{gbp(monthlyPayment(example.systemCost, first.apr, first.termMonths, first.depositPct))}/mo</span></div>}
              </div>
            </div>
            <div className="rounded-card bg-accent-wash-3 border border-[#D3E0FA] p-4 text-[12.5px] text-accent-700 leading-relaxed">These numbers drive every proposal you generate in the Design Studio — change your pricing here and all new quotes reflect it instantly.</div>
          </div>
        </div>

        <AddFinanceModal open={addFin} onClose={() => setAddFin(false)} onAdd={(f) => { act.addFinance(f); setAddFin(false) }} />
        <AddAdderModal open={addAdd} onClose={() => setAddAdd(false)} onAdd={(name, amount) => { act.addAdder(name, amount); setAddAdd(false) }} />
      </PageBody>
    </>
  )
}

function AddFinanceModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (f: Omit<FinanceProduct, 'id'>) => void }) {
  const [name, setName] = useState('')
  const [provider, setProvider] = useState('')
  const [apr, setApr] = useState('6.9')
  const [term, setTerm] = useState('120')
  const [deposit, setDeposit] = useState('0')
  const [type, setType] = useState<FinanceProduct['type']>('loan')
  return (
    <Modal open={open} onClose={onClose} title="Add finance product" subtitle="From your own lender agreement" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => name.trim() && onAdd({ name, provider: provider || 'Lender', apr: Number(apr), termMonths: Number(term), depositPct: Number(deposit), type })}>Add product</Button></>}>
      <div className="grid grid-cols-2 gap-3"><Field label="Product name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Green Energy Loan" autoFocus /></Field><Field label="Provider"><Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="GoodLeap" /></Field></div>
      <div className="grid grid-cols-3 gap-3"><Field label="APR %"><Input type="number" value={apr} onChange={(e) => setApr(e.target.value)} /></Field><Field label="Term (months)"><Input type="number" value={term} onChange={(e) => setTerm(e.target.value)} /></Field><Field label="Deposit %"><Input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} /></Field></div>
      <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value as FinanceProduct['type'])}><option value="loan">Loan</option><option value="lease">Lease</option><option value="ppa">PPA</option><option value="buy-now-pay-later">Buy now pay later</option></Select></Field>
    </Modal>
  )
}
function AddAdderModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (name: string, amount: number) => void }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="Add optional adder" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => name.trim() && onAdd(name, Number(amount) || 0)}>Add</Button></>}>
      <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Battery storage (5 kWh)" autoFocus /></Field>
      <Field label="Amount (£)"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="3200" /></Field>
    </Modal>
  )
}
