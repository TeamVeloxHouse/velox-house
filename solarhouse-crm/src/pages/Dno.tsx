import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Button, Kpi, Panel, Segmented } from '../components/ui'
import { Modal, Field, Textarea } from '../components/overlays'
import { Dropdown } from '../components/Dropdown'
import { MonthColumns, HBars, DataTable, Legend, C } from '../components/charts'
import { Bolt, Send, Check, Clock, Envelope, Pie, Wrench, Search, Layers, Calendar } from '../components/icons'
import { useState_, useActions } from '../store/store'
import type { Showroom } from '../store/types'
import { classNames } from '../lib/format'
import { SHOWROOM_META } from '../lib/solarHouseData'
import { allDno, submitPatch, approvePatch, infoPatch, DNO_STATE, DNO_COLUMNS, type DnoRow, type DnoState } from '../lib/dnoOps'

/* DNO applications — Operations (a pipeline from "to submit" to "connected", with the actions to move
 * each one on: submit, answer the network's questions, log the approval, chase) and Analytics
 * (volumes, approval times by form and network, what's blocking installs). */

const DAY = 86_400_000
const SHOWROOMS = Object.keys(SHOWROOM_META) as Showroom[]
const fmtDay = (t?: number) => (t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—')
const sys = (r: DnoRow) => { const s = r.deal.journey?.system; return s ? `${s.kwp} kWp${s.batteryKwh ? ` + ${s.batteryKwh} kWh` : ''}` : '—' }
const street = (r: DnoRow) => (r.deal.journey?.address || r.deal.org).split(',')[0]

function useTabs(on: 'ops' | 'analytics') {
  const nav = useNavigate()
  return { items: [{ id: 'ops', label: 'Operations', icon: Wrench }, { id: 'analytics', label: 'Analytics', icon: Pie }], value: on, onChange: (id: string) => nav(id === 'ops' ? '/studio/dno' : '/studio/dno/analytics') }
}
const FormChip = ({ f }: { f: 'G98' | 'G99' }) => <span className={classNames('text-[10.5px] font-bold rounded px-1.5 py-px', f === 'G99' ? 'bg-[#15223B] text-[#62E4CC]' : 'bg-[#E6FAF6] text-[#0A5A4C]')}>{f}</span>

/* ============================ Operations ============================ */
export function DnoOps() {
  const nav = useNavigate()
  const { deals } = useState_()
  const act = useActions()
  const tabs = useTabs('ops')
  const [view, setView] = useState<'Pipeline' | 'Needs action' | 'Blocking installs' | 'All'>('Pipeline')
  const [form, setForm] = useState<'all' | 'G98' | 'G99'>('all')
  const [showroom, setShowroom] = useState<Showroom | 'all'>('all')
  const [q, setQ] = useState('')
  const [answering, setAnswering] = useState<DnoRow | null>(null)
  const now = Date.now()
  const rows = useMemo(() => allDno(deals, now), [deals]) // eslint-disable-line react-hooks/exhaustive-deps
  const f = rows.filter((r) => (form === 'all' || r.form === form) && (showroom === 'all' || r.deal.journey!.showroom === showroom) && (!q || `${r.deal.name} ${r.deal.journey!.postcode} ${r.reference ?? ''}`.toLowerCase().includes(q.toLowerCase())))
  const by = (s: DnoState) => f.filter((r) => r.state === s)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const waiting = [...by('submitted'), ...by('info')]
  const oldest = waiting.reduce((m, r) => Math.max(m, r.waitingDays), 0)
  const nearSla = waiting.filter((r) => r.form === 'G99' && r.waitingDays > r.slaDays * 0.7)
  const blocking = f.filter((r) => (r.state === 'submitted' || r.state === 'info' || r.state === 'to-submit') && r.installAt)
  const needsAction = f.filter((r) => r.state === 'to-submit' || r.state === 'info' || (r.state === 'submitted' && r.form === 'G99' && r.waitingDays > 21))
    .sort((a, b) => (a.state === 'info' ? -1 : 0) - (b.state === 'info' ? -1 : 0) || b.waitingDays - a.waitingDays)

  const submit = (r: DnoRow) => { act.updateDeal(r.deal.id, submitPatch(r)); act.toast(r.form === 'G98' ? `G98 notification filed for ${r.deal.name}` : `G99 application sent to ${r.network} for ${r.deal.name}`) }
  const approve = (r: DnoRow) => { act.updateDeal(r.deal.id, approvePatch(r)); act.toast(`${r.network} approval logged — ${r.deal.name} is clear to install`) }
  const chase = (r: DnoRow) => { act.logActivity({ type: 'email', subject: `Chased ${r.network} on ${r.reference}`, body: `${r.form} for ${r.deal.name}, ${r.waitingDays} days with the network.`, dealId: r.deal.id, done: true }, `Chaser sent to ${r.network} for ${r.reference}`) }

  const Actions = ({ r, small }: { r: DnoRow; small?: boolean }) => {
    const b = small ? 'h-7 px-2.5 text-[11.5px] rounded-[7px]' : 'h-8 px-3 text-[12px] rounded-[8px]'
    if (r.state === 'to-submit') return <button onClick={() => submit(r)} className={classNames(b, 'bg-[#15223B] text-white font-semibold flex items-center gap-1')}><Send size={12} className="text-[#62E4CC]" />{r.form === 'G98' ? 'File G98' : 'Submit G99'}</button>
    if (r.state === 'info') return <button onClick={() => setAnswering(r)} className={classNames(b, 'bg-[#15223B] text-white font-semibold flex items-center gap-1')}><Envelope size={12} className="text-[#62E4CC]" />Answer</button>
    if (r.state === 'submitted') return <span className="flex items-center gap-1.5"><button onClick={() => approve(r)} className={classNames(b, 'bg-[#15223B] text-white font-semibold flex items-center gap-1')}><Check size={12} className="text-[#62E4CC]" />Log approval</button><button onClick={() => chase(r)} className={classNames(b, 'border border-[#E1E6EC] text-ink-3 font-semibold hover:bg-control')}>Chase</button></span>
    return null
  }
  const Card = ({ r }: { r: DnoRow }) => (
    <div className="rounded-[10px] bg-white border border-[#E1E6EC] p-3 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      <div className="flex items-center gap-2"><button onClick={() => nav(`/deals/${r.deal.id}?tab=delivery`)} className="text-[13px] font-bold text-ink truncate flex-1 text-left hover:underline">{r.deal.name}</button><FormChip f={r.form} /></div>
      <div className="text-[11.5px] text-ink-3 truncate mt-0.5">{street(r)} · <b className="text-ink-2">{r.deal.journey!.postcode}</b></div>
      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-2"><span>{sys(r)}</span><span className="ml-auto">{r.network}{r.reference ? ` · ${r.reference}` : ''}</span></div>
      {r.question && <div className="mt-2 text-[11.5px] rounded-md bg-[#F7F9FB] border border-[#E6EAF0] px-2 py-1.5 text-ink-3">“{r.question}”</div>}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#F0F2F5]">
        <span className="text-[11px] text-muted-b flex-1">{r.state === 'to-submit' ? `Signed ${r.waitingDays}d ago` : r.state === 'approved' || r.state === 'connected' ? `Approved ${fmtDay(r.approvedAt)} · ${r.waitingDays}d` : `${r.waitingDays} days with ${r.network}`}{r.installAt && !r.installed ? ` · install ${fmtDay(r.installAt)}` : ''}</span>
        <Actions r={r} small />
      </div>
    </div>
  )

  return (
    <>
      <TopBar title="DNO applications" crumbs={['Delivery']} identity={{ icon: Bolt, accent: '#15223B' }} tabs={tabs} />
      <main className="flex-1 min-h-0 flex flex-col">
        <div className="px-7 pt-5 grid grid-cols-5 gap-4 shrink-0">
          <Kpi variant="navy" icon={Send} label="To submit" value={String(by('to-submit').length)} delta="signed, application not sent" />
          <Kpi icon={Clock} label="With the network" value={String(waiting.length)} delta={`oldest ${oldest} days`} deltaTone="muted" />
          <Kpi icon={Envelope} label="Questions to answer" value={String(by('info').length)} delta="networks waiting on us" deltaTone="muted" />
          <Kpi icon={Calendar} label="Holding up an install" value={String(blocking.length)} delta={`${nearSla.length} G99s past 70% of the 45-day window`} deltaTone="muted" />
          <Kpi variant="teal" icon={Check} label="Approved this month" value={String(f.filter((r) => r.approvedAt && r.approvedAt >= monthStart).length)} delta="clear to install" />
        </div>
        <div className="sh-toolbar shrink-0 px-7 pb-3 flex items-center gap-2.5 flex-wrap">
          <Segmented options={['Pipeline', 'Needs action', 'Blocking installs', 'All']} value={view} onChange={(v) => setView(v as typeof view)} />
          <Segmented options={['All forms', 'G98', 'G99']} value={form === 'all' ? 'All forms' : form} onChange={(v) => setForm(v === 'All forms' ? 'all' : (v as 'G98' | 'G99'))} />
          <Dropdown value={showroom} onChange={(e) => setShowroom(e.target.value as Showroom | 'all')} className="h-9 px-3 rounded-[10px] border border-[#E1E6EC] bg-white text-[13px] font-semibold text-ink-3">
            <option value="all">All showrooms</option>{SHOWROOMS.map((s) => <option key={s} value={s}>{SHOWROOM_META[s].name}</option>)}
          </Dropdown>
          <label className="h-9 w-[240px] rounded-[10px] border border-[#E1E6EC] bg-white flex items-center gap-2 px-3"><Search size={14} className="text-muted-3" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, postcode or reference" className="flex-1 min-w-0 bg-transparent outline-none text-[13px]" /></label>
          <button onClick={() => nav('/studio/dno/projects')} className="ml-auto h-9 px-3 rounded-[10px] text-[12.5px] font-semibold text-ink-3 hover:bg-white flex items-center gap-1.5"><Layers size={14} />DNO Autopilot projects</button>
        </div>

        {view === 'Pipeline' ? (
          <div className="flex-1 min-h-0 overflow-x-auto px-7 pb-5">
            <div className="h-full grid gap-5" style={{ gridTemplateColumns: `repeat(${DNO_COLUMNS.length}, minmax(270px, 1fr))` }}>
              {DNO_COLUMNS.map((s, i) => {
                const col = by(s).sort((a, b) => b.waitingDays - a.waitingDays)
                const shade = ['#A8EDDF', '#62E4CC', '#2FBFA5', '#0E7A66', '#15223B'][i]
                return (
                  <div key={s} className="min-h-0 flex flex-col rounded-xl border border-[#E1E6EC] bg-[#F3F5F8] overflow-hidden">
                    <div className="px-3.5 pb-3 bg-white border-b border-[#E6EAF0]">
                      <div className="h-[4px] -mx-3.5 mb-3" style={{ background: shade }} />
                      <div className="flex items-center gap-2"><span className="text-[13.5px] font-extrabold text-ink">{DNO_STATE[s].label}</span><span className="text-[11px] font-bold rounded-full px-1.5 min-w-[22px] text-center bg-[#EEF1F5] text-ink-3">{col.length}</span></div>
                      <div className="text-[11.5px] text-muted-b mt-1">{DNO_STATE[s].help}</div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2">
                      {col.slice(0, 40).map((r) => <Card key={r.deal.id} r={r} />)}
                      {col.length > 40 && <button onClick={() => setView('All')} className="h-8 rounded-lg border border-dashed border-input-border text-[12px] font-semibold text-muted-b">See all {col.length}</button>}
                      {!col.length && <div className="text-[12px] text-muted-3 text-center py-6">Nothing here</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-7 pb-5">
            <div className="rounded-card bg-white border border-[#E1E6EC] shadow-card overflow-hidden">
              {(() => {
                const T = 'minmax(170px,1.3fr) minmax(160px,1.2fr) 70px 120px 150px 120px 110px 220px'
                const list = view === 'Needs action' ? needsAction : view === 'Blocking installs' ? blocking.sort((a, b) => (a.installAt ?? 0) - (b.installAt ?? 0)) : [...f].sort((a, b) => b.waitingDays - a.waitingDays)
                return (
                  <>
                    <div className="grid gap-3 px-4 h-10 items-center bg-[#FAFBFC] border-b border-[#EEF1F5] text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted-3" style={{ gridTemplateColumns: T }}>
                      <span>Customer</span><span>Address</span><span>Form</span><span>System</span><span>Network · ref</span><span>Status</span><span>Days</span><span />
                    </div>
                    {list.slice(0, 150).map((r) => {
                      const st = DNO_STATE[r.state]
                      return (
                        <div key={r.deal.id} className="grid gap-3 px-4 py-2.5 items-center border-b border-[#F0F2F5] last:border-b-0 hover:bg-[#FAFCFB]" style={{ gridTemplateColumns: T }}>
                          <button onClick={() => nav(`/deals/${r.deal.id}?tab=delivery`)} className="min-w-0 text-left"><div className="text-[13px] font-bold text-ink truncate hover:underline">{r.deal.name}</div>{r.installAt && !r.installed && <div className="text-[11px] text-muted-2">Install {fmtDay(r.installAt)}</div>}</button>
                          <div className="min-w-0 text-[12.5px] text-ink-3 truncate">{street(r)} · <b className="text-ink-2">{r.deal.journey!.postcode}</b></div>
                          <FormChip f={r.form} />
                          <div className="text-[12px] text-ink-3">{sys(r)}</div>
                          <div className="min-w-0 text-[12px] text-ink-3 truncate">{r.network}{r.reference ? ` · ${r.reference}` : ''}</div>
                          <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 w-fit" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                          <div className="text-[12px] tabular-nums text-ink-2">{r.waitingDays}d{r.form === 'G99' && (r.state === 'submitted' || r.state === 'info') ? <span className="text-muted-3"> / {r.slaDays}</span> : ''}</div>
                          <div className="flex justify-end"><Actions r={r} /></div>
                        </div>
                      )
                    })}
                    {!list.length && <div className="py-12 text-center text-[13px] text-muted-2">Nothing needs doing here.</div>}
                  </>
                )
              })()}
            </div>
          </div>
        )}
      </main>
      {answering && <AnswerModal r={answering} onClose={() => setAnswering(null)} onSend={(text) => { act.updateDeal(answering.deal.id, infoPatch(answering, 'answered')); act.logActivity({ type: 'email', subject: `Replied to ${answering.network} — ${answering.reference}`, body: text, dealId: answering.deal.id, done: true }, `Reply sent to ${answering.network}`); setAnswering(null) }} />}
    </>
  )
}

function AnswerModal({ r, onClose, onSend }: { r: DnoRow; onClose: () => void; onSend: (text: string) => void }) {
  const s = r.deal.journey?.system
  const [text, setText] = useState(`Hi,\n\nThanks for your question on ${r.reference}. ${/export limit/i.test(r.question ?? '') ? 'The inverter export limit is set to 3.68 kW per G100.' : /datasheet|G100/i.test(r.question ?? '') ? `Attached are the battery datasheet (${s?.batteryModel ?? 'battery'}, ${s?.batteryKwh} kWh) and our G100 export-limitation scheme.` : /single-line|diagram/i.test(r.question ?? '') ? 'Attached is the single-line diagram showing the battery AC-coupled at the consumer unit.' : 'The MPAN and cut-out rating are attached from the survey photos.'}\n\nKind regards,\nThe Solar House — Ops team`)
  return (
    <Modal open onClose={onClose} title={`Answer ${r.network}`} subtitle={`${r.deal.name} · ${r.form} · ${r.reference}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={<Send size={14} />} onClick={() => onSend(text)}>Send reply</Button></>}>
      <div className="rounded-[10px] bg-[#F7F9FB] border border-[#E6EAF0] px-3 py-2.5 text-[12.5px] text-ink-2"><b>{r.network} asked:</b> “{r.question}”</div>
      <Field label="Your reply (drafted by Ovi from the survey and design)"><Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} /></Field>
    </Modal>
  )
}

/* ============================ Analytics ============================ */
export function DnoAnalytics() {
  const { deals } = useState_()
  const tabs = useTabs('analytics')
  const [showroom, setShowroom] = useState<Showroom | 'all'>('all')
  const now = Date.now()
  const rows = useMemo(() => allDno(deals, now).filter((r) => showroom === 'all' || r.deal.journey!.showroom === showroom), [deals, showroom]) // eslint-disable-line react-hooks/exhaustive-deps
  const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
  const approved = rows.filter((r) => r.approvedAt && r.submittedAt)
  const g99 = approved.filter((r) => r.form === 'G99'), g98 = approved.filter((r) => r.form === 'G98')
  const g99Median = median(g99.map((r) => r.waitingDays))
  const within = g99.length ? Math.round((g99.filter((r) => r.waitingDays <= r.slaDays).length / g99.length) * 100) : 0
  const mKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}` }
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - 5 + i, 1).getTime() })
  const chart = months.map((m) => ({ label: new Date(m).toLocaleDateString('en-GB', { month: 'short' }), value: rows.filter((r) => r.submittedAt && mKey(r.submittedAt) === mKey(m)).length, sub: `${rows.filter((r) => r.submittedAt && mKey(r.submittedAt) === mKey(m) && r.form === 'G99').length} G99 · ${rows.filter((r) => r.submittedAt && mKey(r.submittedAt) === mKey(m) && r.form === 'G98').length} G98` }))
  const buckets = [['Same week', 0, 7], ['1–2 weeks', 7, 14], ['2–3 weeks', 14, 21], ['3–4 weeks', 21, 28], ['4+ weeks', 28, 999]] as const
  const networks = [...new Set(rows.map((r) => r.network))]
  const open = rows.filter((r) => r.state === 'submitted' || r.state === 'info')

  return (
    <>
      <TopBar title="DNO applications" crumbs={['Delivery']} identity={{ icon: Bolt, accent: '#15223B' }} tabs={tabs}
        center={<Segmented options={['All', ...SHOWROOMS.map((s) => SHOWROOM_META[s].name)]} value={showroom === 'all' ? 'All' : SHOWROOM_META[showroom].name} onChange={(v) => setShowroom(v === 'All' ? 'all' : (SHOWROOMS.find((s) => SHOWROOM_META[s].name === v) ?? 'all'))} />} />
      <main className="flex-1 overflow-y-auto">
        <div className="px-7 py-6 flex flex-col gap-5 max-w-[1500px]">
          <div className="grid grid-cols-4 gap-4">
            <Kpi variant="navy" icon={Clock} label="G99 median approval" value={`${g99Median} days`} meter={Math.min(100, (g99Median / 63) * 100)} delta={`${within}% inside the 45-working-day window`} />
            <Kpi icon={Bolt} label="Share needing G99" value={`${rows.length ? Math.round((rows.filter((r) => r.form === 'G99').length / rows.length) * 100) : 0}%`} delta="bigger systems & most batteries" deltaTone="muted" />
            <Kpi icon={Layers} label="Open with networks" value={String(open.length)} delta={`${open.filter((r) => r.state === 'info').length} waiting on our answer`} deltaTone="muted" />
            <Kpi variant="teal" icon={Check} label="G98 notified" value={String(g98.length)} delta={`median ${median(g98.map((r) => r.waitingDays))} days — no wait to install`} />
          </div>
          <Panel title="Applications by month" sub="Filed with the network (G98 notifications + G99 applications)" icon={Calendar}>
            <div className="mb-3"><Legend items={[{ label: 'Applications filed', swatch: C.actual }]} /></div>
            <MonthColumns data={chart} fmt={(n) => String(Math.round(n))} height={200} />
          </Panel>
          <div className="grid grid-cols-2 gap-5">
            <Panel title="How long G99 approvals take" sub="Approved applications, by time with the network" icon={Clock}>
              <HBars data={buckets.map(([label, lo, hi]) => ({ label, value: g99.filter((r) => r.waitingDays >= lo && r.waitingDays < hi).length }))} fmt={String} color="#15223B" />
            </Panel>
            <Panel title="Installs waiting on a DNO" sub="Booked installs where approval isn't in yet" icon={Wrench}>
              <HBars data={[
                { label: 'Install within 7 days', value: open.filter((r) => r.installAt && r.installAt - now < 7 * DAY).length },
                { label: 'Install in 1–3 weeks', value: open.filter((r) => r.installAt && r.installAt - now >= 7 * DAY && r.installAt - now < 21 * DAY).length },
                { label: 'No install date yet', value: open.filter((r) => !r.installAt).length },
              ]} fmt={String} />
            </Panel>
          </div>
          <Panel title="By network" sub="Volume, speed and questions asked" icon={Bolt} pad={false}>
            <div className="p-4">
              <DataTable cols={[{ label: 'Network', w: 'minmax(120px,1.2fr)' }, { label: 'Applications', align: 'right' }, { label: 'G99', align: 'right' }, { label: 'Open now', align: 'right' }, { label: 'Questions asked', align: 'right' }, { label: 'G99 median days', align: 'right' }]}
                rows={networks.map((n) => { const mine = rows.filter((r) => r.network === n); return [<b key="n">{n === 'NGED' ? 'NGED (National Grid)' : n === 'SSEN' ? 'SSEN (Southern)' : n}</b>, mine.filter((r) => r.submittedAt).length, mine.filter((r) => r.form === 'G99').length, mine.filter((r) => r.state === 'submitted' || r.state === 'info').length, mine.filter((r) => r.state === 'info').length, median(mine.filter((r) => r.form === 'G99' && r.approvedAt).map((r) => r.waitingDays))] })} />
            </div>
          </Panel>
          <Panel title="By showroom" sub="Where applications come from" icon={Pie} pad={false}>
            <div className="p-4">
              <DataTable cols={[{ label: 'Showroom' }, { label: 'Signed', align: 'right' }, { label: 'To submit', align: 'right' }, { label: 'With network', align: 'right' }, { label: 'Approved', align: 'right' }, { label: 'Connected', align: 'right' }]}
                rows={SHOWROOMS.map((s) => { const mine = allDno(deals, now).filter((r) => r.deal.journey!.showroom === s); const c = (st: DnoState) => mine.filter((r) => r.state === st).length; return [<span key="n" className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: SHOWROOM_META[s].color }} /><b>{SHOWROOM_META[s].name}</b></span>, mine.length, c('to-submit'), c('submitted') + c('info'), c('approved'), c('connected')] })} />
            </div>
          </Panel>
        </div>
      </main>
    </>
  )
}
