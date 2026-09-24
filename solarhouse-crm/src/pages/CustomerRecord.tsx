import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Phone, Envelope, MapPin, Check, Clock, ChevronDown, ChevronRight, Sun, Bolt, File, Home, Person, Task, Plus, Sparkle, Note } from '../components/icons'
import { useActions, useState_ } from '../store/store'
import { money, classNames } from '../lib/format'
import type { Deal, JourneyKey, JourneyStep } from '../store/types'
import { JOURNEY, SHOWROOM_META } from '../lib/solarHouseData'
import { STAGE_GUIDE, advancePatch, stageAge, dueLabel, currentStep, labelOf, isComplete } from '../lib/journey'
import { DealDetail } from './DealDetail'
import { DeliveryPanel } from '../components/DeliveryPanel'
import { Dropdown } from '../components/Dropdown'

/* The Solar House customer record — one page for a customer's whole life with us:
 * enquiry → contact → consultation → proposal → survey → signed → DNO → install → handover/portal.
 * Every stage is dated, owned and carries its own detail; the current stage shows what's needed. */

const ME = 'Jordan Miles'
const DAY = 86_400_000
const fmt = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtShort = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const gap = (a: number, b: number) => { const d = Math.round((b - a) / DAY); return d <= 0 ? 'same day' : `${d}d` }
const initials = (n: string) => n.split(/[\s&]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
const STEP_ICON: Record<JourneyKey, (p: { size?: number; className?: string }) => JSX.Element> = {
  enquiry: Envelope, contacted: Phone, consultation: Person, proposal: File, survey: Home, signed: Check, dno: Bolt, install: Sun, handover: Sparkle,
}
const PRETTY: Record<string, string> = {
  channel: 'Came in via', message: 'What they said', response: 'Our response time', method: 'How', outcome: 'Outcome', annualKwh: 'Annual usage (kWh)', monthlyBill: 'Monthly bill',
  type: 'Type', where: 'Where', attendees: 'Who attended', interest: 'Interested in', version: 'Version', system: 'System', price: 'Price', finance: 'Finance', views: 'Times viewed', saving: 'Est. saving',
  surveyor: 'Surveyor', roof: 'Roof', scaffold: 'Scaffold', shading: 'Shading', consumerUnit: 'Consumer unit', photos: 'Photos', contract: 'Contract ref', deposit: 'Deposit', payment: 'Payment', signedVia: 'Signed via',
  form: 'DNO form', network: 'Network', reference: 'DNO reference', approved: 'Approved', installBooked: 'Install booked', team: 'Install team', days: 'Days on site', commissioning: 'Commissioning',
  mcs: 'MCS certificate', portal: 'Customer portal', firstGen: 'First generation', review: 'Review',
}

export function CustomerRecord() {
  const { id } = useParams()
  const { deals } = useState_()
  const deal = deals.find((d) => d.id === id)
  if (deal && !deal.journey) return <DealDetail />
  if (!deal) return <DealDetail />
  return <Record d={deal} />
}

function Record({ d }: { d: Deal }) {
  const nav = useNavigate()
  const act = useActions()
  const { deals, activities, conversations } = useState_()
  const j = d.journey!
  const cur = currentStep(d)!
  const curIdx = JOURNEY.findIndex((x) => x.key === cur.key)
  const complete = isComplete(d)
  const age = stageAge(d)
  const sr = SHOWROOM_META[j.showroom]
  const [openStep, setOpenStep] = useState<JourneyKey | null>(complete ? null : cur.key)
  const [note, setNote] = useState('')
  const [params] = useSearchParams()
  const [tab, setTab] = useState<'journey' | 'delivery'>(params.get('tab') === 'delivery' ? 'delivery' : 'journey')

  // Work through a stage without going back to the board: prev/next customer in the same stage.
  const peers = useMemo(() => deals.filter((x) => x.journey && !x.lost && x.stage === d.stage && x.journey.showroom === j.showroom && !x.won === !d.won).sort((a, b) => (currentStep(a)?.at ?? 0) - (currentStep(b)?.at ?? 0)), [deals, d.stage, d.won, j.showroom])
  const pi = peers.findIndex((x) => x.id === d.id)
  const tasks = activities.filter((a) => a.dealId === d.id).sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt)
  const thread = conversations.find((c) => c.name.toLowerCase() === d.name.toLowerCase())

  function advance() {
    const p = advancePatch(d, ME); if (!p) return
    act.updateDeal(d.id, p)
    const nk = p.journey!.steps[p.journey!.steps.length - 1].key
    setOpenStep(nk)
    act.addActivity({ type: 'change', subject: `${labelOf(cur.key)} completed → ${labelOf(nk)}`, dealId: d.id, done: true, who: ME })
    act.toast(`${labelOf(cur.key)} complete · now ${labelOf(nk)}`)
  }
  function addNote() {
    if (!note.trim()) return
    act.updateDeal(d.id, { journey: { ...j, steps: j.steps.map((s) => (s.key === cur.key ? { ...s, notes: [s.notes, note.trim()].filter(Boolean).join('\n') } : s)) } })
    act.addActivity({ type: 'note', subject: note.trim().slice(0, 80), body: note.trim(), dealId: d.id, done: true, who: ME })
    setNote(''); act.toast('Note added to this stage')
  }

  return (
    <>
      <TopBar title={d.name} crumbs={['Deals', sr.name]}
        actions={
          <div className="flex items-center gap-1.5">
            {pi >= 0 && peers.length > 1 && (
              <div className="flex items-center gap-1 mr-1 text-[12px] text-muted-2">
                <span>{pi + 1} of {peers.length} in {d.won ? labelOf(cur.key) : d.stage}</span>
                <button disabled={pi <= 0} onClick={() => nav(`/deals/${peers[pi - 1].id}`)} className="w-8 h-8 rounded-control border border-border flex items-center justify-center text-ink-3 hover:bg-control disabled:opacity-40"><ChevronRight size={14} className="rotate-180" /></button>
                <button disabled={pi >= peers.length - 1} onClick={() => nav(`/deals/${peers[pi + 1].id}`)} className="w-8 h-8 rounded-control border border-border flex items-center justify-center text-ink-3 hover:bg-control disabled:opacity-40"><ChevronRight size={14} /></button>
              </div>
            )}
          </div>
        } />
      <main className="flex-1 overflow-y-auto">
        {/* ── hero ── */}
        <div className="bg-surface border-b border-border px-7 pt-5 pb-4">
          <div className="flex items-start gap-4">
            <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-[18px] font-bold text-white shrink-0" style={{ background: `linear-gradient(135deg, ${sr.color}, #15223B)` }}>{initials(d.name)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[22px] font-bold text-ink tracking-[-0.02em]">{d.name}</span>
                <span className="text-[11.5px] font-semibold rounded-full px-2.5 py-0.5 text-white" style={{ background: sr.color }}>{sr.name}</span>
                {d.lost ? <span className="text-[11.5px] font-semibold rounded-full px-2.5 py-0.5 bg-negative-wash text-negative">Lost · {d.lostReason}</span>
                  : complete ? <span className="text-[11.5px] font-semibold rounded-full px-2.5 py-0.5 bg-positive-wash text-positive">Installed customer</span>
                    : <span className="text-[11.5px] font-semibold rounded-full px-2.5 py-0.5" style={{ color: age.color, background: age.bg }}>{labelOf(cur.key)} · {age.days} days</span>}
              </div>
              <div className="text-[13px] text-muted-b mt-1 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1"><MapPin size={13} />{j.address}</span>
                <span>Adviser <b className="text-ink-3">{d.owner}</b></span>
                <span>Came in via <b className="text-ink-3">{j.source}</b> on {fmt(j.steps[0].at)}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[24px] font-bold text-ink leading-none">{money(d.value)}</div>
              <div className="text-[12px] text-muted-2 mt-1">{j.system ? `${j.system.kwp} kWp${j.system.batteryKwh ? ` + ${j.system.batteryKwh} kWh` : ''}` : 'Estimate'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <a href={`tel:${j.phone.replace(/\s/g, '')}`} className="h-9 px-3.5 rounded-control bg-accent-gradient text-white text-[13px] font-semibold shadow-primary flex items-center gap-1.5"><Phone size={14} />Call {j.phone}</a>
            <a href={`https://wa.me/44${j.phone.replace(/\D/g, '').replace(/^0/, '')}`} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-control border border-border text-[13px] font-semibold text-[#1DA851] hover:bg-[#E6F7EC] flex items-center gap-1.5">WhatsApp</a>
            <a href={`https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(j.email)}&subject=${encodeURIComponent('Your Solar House project')}`} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-control border border-border text-[13px] font-semibold text-[#0A64AD] hover:bg-[#E7F0FA] flex items-center gap-1.5"><Envelope size={14} />Outlook</a>
            {thread && <button onClick={() => nav('/inbox')} className="h-9 px-3 rounded-control border border-border text-[13px] font-semibold text-ink-3 hover:bg-control flex items-center gap-1.5"><Envelope size={14} />Inbox thread</button>}
            <button onClick={() => nav('/design')} className="h-9 px-3 rounded-control border border-border text-[13px] font-semibold text-ink-3 hover:bg-control flex items-center gap-1.5"><Sun size={14} />Design roof</button>
            <div className="ml-auto flex items-center gap-2">
              {!d.lost && !complete && <Dropdown defaultValue="" onChange={(e) => { if (e.target.value) { act.markLost(d.id, d.name, e.target.value); e.target.value = '' } }} className="h-9 px-2 rounded-control border border-border bg-surface text-[12.5px] text-muted-b outline-none"><option value="">Mark lost…</option>{['Went with a cheaper quote', 'Not the right time', 'Roof not suitable', 'Couldn’t get finance', 'Stopped responding'].map((r) => <option key={r}>{r}</option>)}</Dropdown>}
            </div>
          </div>
        </div>

        {/* ── lifecycle tracker ── */}
        <div className="bg-surface border-b border-border px-7 py-4 overflow-x-auto">
          <div className="flex items-start min-w-[900px]">
            {JOURNEY.map((s, i) => {
              const st = j.steps.find((x) => x.key === s.key)
              const state = st?.done ? 'done' : st ? (st.at > Date.now() ? 'booked' : 'current') : 'todo'
              const prevAt = i > 0 ? j.steps.find((x) => x.key === JOURNEY[i - 1].key)?.at : undefined
              const I = STEP_ICON[s.key]
              return (
                <div key={s.key} className="flex-1 flex flex-col items-center relative">
                  {i > 0 && <div className="absolute top-[17px] right-1/2 w-full h-[3px] -z-0" style={{ background: st ? '#1FAE94' : '#E4E8EE' }} />}
                  {/* time taken between the two stages, centred on the connecting line */}
                  {i > 0 && st && prevAt && <span className="absolute top-[-6px] left-0 -translate-x-1/2 text-[10px] text-muted-2 font-semibold bg-surface px-1.5 z-10 whitespace-nowrap">{gap(prevAt, st.at)}</span>}
                  <button onClick={() => setOpenStep(s.key)} className={classNames('relative z-10 w-9 h-9 rounded-full flex items-center justify-center border-2 transition-transform hover:scale-105',
                    state === 'done' ? 'bg-accent-500 border-accent-500 text-white' : state === 'current' ? 'bg-white border-accent text-accent ring-4 ring-accent-wash' : state === 'booked' ? 'bg-white border-dashed border-accent-400 text-accent' : 'bg-white border-border text-muted-3')}>
                    {state === 'done' ? <Check size={16} /> : <I size={15} />}
                  </button>
                  <div className={classNames('text-[11.5px] mt-1.5 text-center leading-tight', state === 'current' ? 'font-bold text-ink' : state === 'todo' ? 'text-muted-3' : 'font-semibold text-ink-3')}>{s.label}</div>
                  <div className="text-[10.5px] text-muted-2 mt-0.5">{st ? (state === 'booked' ? `Booked ${fmtShort(st.at)}` : fmtShort(st.at)) : '—'}</div>
                </div>
              )
            })}
          </div>
        </div>

        {j.delivery && (
          <div className="bg-surface border-b border-border px-7 flex items-stretch gap-1">
            {([['journey', 'Customer journey'], ['delivery', 'Delivery']] as const).map(([id, l]) => (
              <button key={id} onClick={() => setTab(id)} className={classNames('h-11 px-3 text-[13px] border-b-2 -mb-px', tab === id ? 'border-accent text-accent font-semibold' : 'border-transparent text-muted-b font-medium hover:text-ink-3')}>{l}</button>
            ))}
          </div>
        )}
        {tab === 'delivery' && j.delivery ? <div className="px-7 py-5"><DeliveryPanel d={d} /></div> : (
        <div className="px-7 py-5 grid grid-cols-[1fr_340px] gap-5 items-start">
          {/* ── stages ── */}
          <div className="flex flex-col gap-3 min-w-0">
            {!complete && !d.lost && j.nextAction && (() => {
              const due = dueLabel(j.nextAction.due)
              return (
                <div className={classNames('rounded-card border p-4 flex items-center gap-3', due.overdue ? 'bg-negative-wash border-[#FBCFD9]' : 'bg-accent-wash-4 border-border-blue')}>
                  <span className={classNames('w-10 h-10 rounded-xl flex items-center justify-center text-white', due.overdue ? 'bg-negative' : 'bg-accent-gradient')}><Clock size={18} /></span>
                  <div className="flex-1"><div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-2">Next action</div><div className="text-[15px] font-bold text-ink">{j.nextAction.label}</div></div>
                  <span className={classNames('text-[12.5px] font-semibold', due.overdue ? 'text-negative' : 'text-accent')}>{due.text}</span>
                  <button onClick={advance} className="h-9 px-3.5 rounded-control bg-accent-gradient text-white text-[12.5px] font-semibold shadow-primary flex items-center gap-1.5"><Check size={14} />Complete {labelOf(cur.key).toLowerCase()}</button>
                </div>
              )
            })()}

            {JOURNEY.map((s, i) => {
              const st = j.steps.find((x) => x.key === s.key)
              const isCur = s.key === cur.key && !complete && !d.lost
              const open = openStep === s.key
              return <StageCard key={s.key} k={s.key} st={st} index={i} isCurrent={isCur} future={!st} open={open} onToggle={() => setOpenStep(open ? null : s.key)}
                prevAt={i > 0 ? j.steps.find((x) => x.key === JOURNEY[i - 1].key)?.at : undefined}
                footer={isCur && open ? (
                  <div className="flex flex-col gap-2 pt-3 border-t border-divider-row">
                    <div className="flex gap-2">
                      <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} placeholder={`Add a note to ${labelOf(s.key).toLowerCase()}…`} className="flex-1 h-9 px-3 rounded-control border border-input-border text-[13px] outline-none focus:border-accent" />
                      <button onClick={addNote} className="h-9 px-3 rounded-control border border-border text-[12.5px] font-semibold text-ink-3 hover:bg-control flex items-center gap-1.5"><Note size={13} />Add note</button>
                      {curIdx < JOURNEY.length - 1 && <button onClick={advance} className="h-9 px-3.5 rounded-control bg-accent-gradient text-white text-[12.5px] font-semibold shadow-primary flex items-center gap-1.5"><Check size={14} />Complete · move to {JOURNEY[curIdx + 1].label}</button>}
                    </div>
                  </div>
                ) : null} />
            })}
          </div>

          {/* ── side ── */}
          <div className="flex flex-col gap-3">
            <Side title="Homeowner" icon={Person}>
              <KV k="Phone" v={<a href={`tel:${j.phone.replace(/\s/g, '')}`} className="text-accent font-semibold">{j.phone}</a>} />
              <KV k="Email" v={<a href={`mailto:${j.email}`} className="text-accent truncate">{j.email}</a>} />
              <KV k="Address" v={j.address} />
              <KV k="Showroom" v={<span className="flex items-center gap-1.5 justify-end"><span className="w-1.5 h-1.5 rounded-full" style={{ background: sr.color }} />{sr.name}</span>} />
            </Side>
            <Side title="Home & energy" icon={Home}>
              <KV k="Property" v={`${j.property.type} · ${j.property.bedrooms} bed`} />
              <KV k="Roof faces" v={j.property.roofAspect} />
              <KV k="Annual usage" v={`${j.property.annualKwh.toLocaleString()} kWh`} />
              <KV k="Monthly bill" v={`£${j.property.monthlyBill}`} />
              <KV k="Heating" v={j.property.heating} />
              <KV k="Electric car" v={j.property.hasEv ? 'Yes' : 'No'} />
            </Side>
            <Side title="System & price" icon={Sun}>
              {j.system ? (
                <>
                  <KV k="System" v={`${j.system.kwp} kWp · ${j.system.panels} panels`} />
                  <KV k="Panels" v={j.system.panelModel} />
                  <KV k="Inverter" v={j.system.inverter} />
                  <KV k="Battery" v={j.system.batteryKwh ? `${j.system.batteryKwh} kWh` : 'None'} />
                  <KV k="EV charger" v={j.system.evCharger ? 'Yes' : 'No'} />
                  <KV k="Price" v={<b className="text-ink">{money(j.system.price)}</b>} />
                  <KV k="Finance" v={j.system.finance} />
                </>
              ) : <div className="text-[12.5px] text-muted-2">Designed at the consultation. The system appears here once a proposal is sent.</div>}
            </Side>
            <Side title="Documents" icon={File}>
              {docsFor(j.steps).map(([name, when]) => <div key={name} className="flex items-center gap-2 text-[12.5px] py-1"><File size={13} className="text-muted-3" /><span className="text-ink-3 flex-1 truncate">{name}</span><span className="text-muted-3 text-[11.5px]">{when}</span></div>)}
              {!docsFor(j.steps).length && <div className="text-[12.5px] text-muted-2">No documents yet.</div>}
            </Side>
            <Side title={`Tasks & history · ${tasks.length}`} icon={Task} action={<button onClick={() => { act.addActivity({ type: 'task', subject: `Follow up — ${d.name}`, dealId: d.id, who: ME, due: 'Tomorrow', dueDate: new Date(Date.now() + DAY).toISOString().slice(0, 10) }); act.toast('Task added to My Tasks') }} className="text-[12px] font-semibold text-accent flex items-center gap-1"><Plus size={12} />Task</button>}>
              <div className="flex flex-col max-h-[260px] overflow-y-auto -mx-1 px-1">
                {tasks.slice(0, 20).map((t) => (
                  <button key={t.id} onClick={() => act.toggleActivity(t.id)} className="flex items-start gap-2 text-left py-1.5 border-b border-divider-row last:border-0">
                    <span className={classNames('w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0', t.done ? 'bg-accent-500 text-white' : 'border-2 border-input-border')}>{t.done && <Check size={9} />}</span>
                    <span className="min-w-0 flex-1"><span className={classNames('block text-[12.5px] truncate', t.done ? 'text-muted-2 line-through' : 'text-ink-2 font-medium')}>{t.subject.replace(` — ${d.name}`, '')}</span><span className="block text-[11px] text-muted-3">{t.who} · {t.done ? fmtShort(t.completedAt ?? t.createdAt) : t.due ?? ''}</span></span>
                  </button>
                ))}
                {!tasks.length && <div className="text-[12.5px] text-muted-2">No tasks yet.</div>}
              </div>
            </Side>
          </div>
        </div>
        )}
      </main>
    </>
  )
}

function StageCard({ k, st, index, isCurrent, future, open, onToggle, prevAt, footer }: { k: JourneyKey; st?: JourneyStep; index: number; isCurrent: boolean; future: boolean; open: boolean; onToggle: () => void; prevAt?: number; footer?: ReactNode }) {
  const guide = STAGE_GUIDE[k]
  const I = STEP_ICON[k]
  const booked = st && st.at > Date.now()
  const entries = Object.entries(st?.data ?? {})
  return (
    <div className={classNames('rounded-card bg-surface border shadow-card transition-colors', isCurrent ? 'border-accent' : 'border-border', future && 'opacity-80')}>
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center gap-3 text-left">
        <span className={classNames('w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0', st?.done ? 'bg-accent-wash text-accent' : isCurrent ? 'bg-accent-gradient text-white' : 'bg-control text-muted-3')}>{st?.done ? <Check size={16} /> : <I size={16} />}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-muted-3">{index + 1}</span>
            <span className={classNames('text-[14.5px] font-bold', future ? 'text-muted-b' : 'text-ink')}>{labelOf(k)}</span>
            {isCurrent && <span className="text-[10.5px] font-semibold rounded-full px-2 py-px bg-accent text-white">Current</span>}
            {booked && <span className="text-[10.5px] font-semibold rounded-full px-2 py-px bg-accent-wash text-accent">Booked</span>}
          </div>
          <div className="text-[12px] text-muted-2 mt-0.5 truncate">
            {st ? <>{booked ? `Booked for ${fmt(st.at)}` : `Started ${fmt(st.at)}`}{st.by ? ` · ${st.by}` : ''}{st.done ? ` · completed ${fmtShort(st.done)} (${gap(st.at, st.done)})` : ''}{prevAt ? ` · ${gap(prevAt, st.at)} after previous stage` : ''}</> : guide.what}
          </div>
        </div>
        <ChevronDown size={15} className={classNames('text-muted-3 transition-transform', !open && '-rotate-90')} />
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {entries.length > 0 && (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-2.5 rounded-xl bg-[#F8FAFB] border border-divider p-3.5">
              {entries.map(([key, v]) => <div key={key} className="min-w-0"><div className="text-[11px] text-muted-2">{PRETTY[key] ?? key}</div><div className="text-[13px] font-semibold text-ink-2 truncate" title={String(v)}>{String(v)}</div></div>)}
            </div>
          )}
          {st?.notes && <div className="rounded-xl bg-[#FFFBEB] border border-[#FDE68A] px-3.5 py-2.5 text-[12.5px] text-[#78350F] whitespace-pre-wrap"><b className="text-[#92400E]">Notes · </b>{st.notes}</div>}
          {(isCurrent || future) && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-3 mb-1.5">{isCurrent ? 'To complete this stage' : 'What happens here'}</div>
              {future && <div className="text-[12.5px] text-muted-b mb-1.5">{guide.what}</div>}
              <div className="flex flex-col gap-1.5">
                {guide.needs.map((n) => <label key={n} className="flex items-center gap-2 text-[12.5px] text-ink-3"><input type="checkbox" disabled={future} style={{ accentColor: '#0E7A66' }} />{n}</label>)}
              </div>
            </div>
          )}
          {footer}
        </div>
      )}
    </div>
  )
}

function docsFor(steps: JourneyStep[]): [string, string][] {
  const has = (k: JourneyKey) => steps.find((s) => s.key === k)
  const out: [string, string][] = []
  const p = has('proposal'); if (p) out.push([`Proposal ${p.data?.version ?? 'v1'}.pdf`, fmtShort(p.at)])
  const sv = has('survey'); if (sv?.done) out.push([`Survey report (${sv.data?.photos ?? 0} photos)`, fmtShort(sv.done)])
  const sg = has('signed'); if (sg) out.push([`Contract ${sg.data?.contract ?? ''}.pdf`, fmtShort(sg.at)])
  const dn = has('dno'); if (dn) out.push([`${dn.data?.form ?? 'DNO'} application`, fmtShort(dn.at)])
  const ins = has('install'); if (ins?.done) out.push(['Commissioning & test results', fmtShort(ins.done)])
  const h = has('handover'); if (h) out.push([`MCS certificate ${h.data?.mcs ?? ''}`, fmtShort(h.at)], ['Warranty pack', fmtShort(h.at)])
  return out
}

function Side({ title, icon: I, action, children }: { title: string; icon: (p: { size?: number; className?: string }) => JSX.Element; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-card bg-surface border border-border shadow-card p-4">
      <div className="flex items-center gap-2 mb-2.5"><I size={14} className="text-muted-3" /><span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-3 flex-1">{title}</span>{action}</div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}
function KV({ k, v }: { k: string; v: ReactNode }) {
  return <div className="flex justify-between gap-3 text-[12.5px]"><span className="text-muted-2 shrink-0">{k}</span><span className="text-ink-2 text-right min-w-0 truncate">{v}</span></div>
}
