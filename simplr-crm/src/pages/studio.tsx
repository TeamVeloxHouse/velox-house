import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Kpi, Chip, type ChipTone } from '../components/ui'
import { Table, Row, Cell } from '../components/Table'
import { Modal, Field, Input, Select } from '../components/overlays'
import { Sun, Plus, Sparkle, File, Check } from '../components/icons'
import { useState_, useActions } from '../store/store'
import { gbp, designFor, monthlyPayment } from '../lib/solar'
import type { Deal, FinanceProduct } from '../store/types'

const AMBER = '#E8721A'
const amberGrad = 'linear-gradient(135deg,#1FAE94 0%,#159C86 100%)' // unified blue→purple highlight

type PStatus = 'Draft' | 'Sent' | 'Viewed' | 'Won' | 'Lost'
function statusOf(d: Deal): PStatus {
  if (d.won) return 'Won'
  if (d.lost) return 'Lost'
  if (d.stage === 'Negotiations Started' || d.stage === 'Proposal Made') return 'Viewed'
  return 'Sent'
}
const statusTone: Record<PStatus, ChipTone> = { Draft: 'neutral', Sent: 'accent', Viewed: 'warning', Won: 'positive', Lost: 'negative' }
function views(id: string) { return (id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 9) + 1 }

function useProposals() {
  const { deals } = useState_()
  return deals.filter((d) => d.solar).sort((a, b) => (b.solar!.systemCost - a.solar!.systemCost))
}

/* ---------- Overview ---------- */
export function StudioOverview() {
  const nav = useNavigate()
  const proposals = useProposals()
  const open = proposals.filter((d) => !d.lost)
  const won = proposals.filter((d) => d.won)
  const decided = proposals.filter((d) => d.won || d.lost)
  const pipeline = open.filter((d) => !d.won).reduce((s, d) => s + d.solar!.systemCost, 0)
  const avgKwp = proposals.length ? (proposals.reduce((s, d) => s + d.solar!.systemKwp, 0) / proposals.length).toFixed(1) : '0'
  const acceptRate = decided.length ? Math.round((won.length / decided.length) * 100) : 0

  return (
    <>
      <TopBar title="TellOvi Studio" crumbs={['Overview']} actions={<Button variant="primary" icon={<Sun size={16} />} onClick={() => nav('/studio/design')}>New design</Button>} />
      <PageBody>
        <div className="rounded-card p-6 text-white relative overflow-hidden" style={{ background: 'linear-gradient(150deg,#15223B,#0A3B33)' }}>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 100% at 90% -10%, rgba(124,58,237,0.28), transparent 55%)' }} />
          <div className="relative">
            <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: '#F5B85C' }}><Sun size={14} /> DESIGN · QUOTE · CLOSE</div>
            <div className="text-[24px] font-bold mt-1.5 max-w-[30ch]">Turn an address into a signed, financed solar deal</div>
            <div className="text-[13px] mt-1.5" style={{ color: '#c3ccdb' }}>Instant AI design, live proposals and analytics — the platform your reps sell on.</div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => nav('/studio/design')} className="h-9 px-4 rounded-lg text-white text-[13px] font-semibold flex items-center gap-1.5" style={{ background: amberGrad }}><Sun size={15} /> Design a roof</button>
              <button onClick={() => nav('/studio/proposals')} className="h-9 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[13px] font-semibold">View proposals</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Kpi label="Proposals" value={String(proposals.length)} delta="Total created" deltaTone="muted" />
          <Kpi variant="blue" label="Open pipeline" value={gbp(pipeline)} delta={`${open.filter((d) => !d.won).length} live`} deltaTone="muted" />
          <Kpi label="Acceptance rate" value={`${acceptRate}%`} delta={`${won.length} won`} />
          <Kpi variant="deep" label="Avg. system" value={`${avgKwp} kWp`} delta="Per proposal" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-[15px] font-semibold text-ink">Recent proposals</div>
            <button onClick={() => nav('/studio/proposals')} className="text-[13px] font-semibold" style={{ color: AMBER }}>View all</button>
          </div>
          <ProposalTable proposals={proposals.slice(0, 6)} onOpen={(id) => nav(`/studio/proposal/${id}`)} />
        </div>
      </PageBody>
    </>
  )
}

function ProposalTable({ proposals, onOpen }: { proposals: Deal[]; onOpen: (id: string) => void }) {
  const template = '2fr 1fr 1fr 1fr 0.9fr 0.7fr'
  if (proposals.length === 0)
    return <div className="bg-surface border border-border rounded-card p-10 text-center"><Sun size={26} className="mx-auto" style={{ color: AMBER }} /><div className="text-[15px] font-semibold text-ink-2 mt-2">No proposals yet</div><div className="text-[13px] text-muted-b mt-0.5">Design a roof to create your first solar proposal.</div></div>
  return (
    <Table
      template={template}
      columns={[{ key: 'a', header: 'Property' }, { key: 's', header: 'System' }, { key: 'v', header: 'Value', align: 'right' }, { key: 'save', header: 'Savings/yr', align: 'right' }, { key: 'st', header: 'Status' }, { key: 'views', header: 'Views', align: 'right' }]}
      footer={<><span>{proposals.length} proposals</span><span>Live tracking</span></>}
    >
      {proposals.map((d) => {
        const s = d.solar!
        const st = statusOf(d)
        return (
          <Row key={d.id} template={template} onClick={() => onOpen(d.id)}>
            <Cell>
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: amberGrad }}><Sun size={14} /></span>
                <span className="font-semibold text-ink-2 truncate">{s.address}</span>
                {s.source === 'google' && <Sparkle size={12} className="text-accent shrink-0" />}
              </div>
            </Cell>
            <Cell muted>{s.systemKwp} kWp · {s.panels}p</Cell>
            <Cell align="right" className="font-semibold text-ink-2">{gbp(s.systemCost)}</Cell>
            <Cell align="right" className="text-positive font-medium">{gbp(s.annualSavings)}</Cell>
            <Cell><Chip tone={statusTone[st]} dot>{st}</Chip></Cell>
            <Cell align="right" muted>{st === 'Draft' ? '—' : views(d.id)}</Cell>
          </Row>
        )
      })}
    </Table>
  )
}

/* ---------- Proposals list ---------- */
export function ProposalsList() {
  const nav = useNavigate()
  const proposals = useProposals()
  return (
    <>
      <TopBar title="Proposals" crumbs={['Studio']} actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => nav('/studio/design')}>New design</Button>} />
      <PageBody>
        <div className="grid grid-cols-4 gap-4">
          {(['Sent', 'Viewed', 'Won', 'Lost'] as PStatus[]).map((st) => (
            <div key={st} className="bg-surface border border-border rounded-card p-4">
              <div className="text-[12px] text-muted-2">{st}</div>
              <div className="text-[24px] font-bold text-ink mt-0.5">{proposals.filter((d) => statusOf(d) === st).length}</div>
            </div>
          ))}
        </div>
        <ProposalTable proposals={proposals} onOpen={(id) => nav(`/studio/proposal/${id}`)} />
      </PageBody>
    </>
  )
}

/* ---------- Analytics ---------- */
export function StudioAnalytics() {
  const proposals = useProposals()
  const statuses: PStatus[] = ['Sent', 'Viewed', 'Won', 'Lost']
  const counts = statuses.map((st) => ({ st, n: proposals.filter((d) => statusOf(d) === st).length }))
  const maxN = Math.max(1, ...counts.map((c) => c.n))
  const totalValue = proposals.reduce((s, d) => s + d.solar!.systemCost, 0)
  const wonValue = proposals.filter((d) => d.won).reduce((s, d) => s + d.solar!.systemCost, 0)
  const totalSavings = proposals.reduce((s, d) => s + d.solar!.annualSavings, 0)
  const totalKwp = proposals.reduce((s, d) => s + d.solar!.systemKwp, 0)

  return (
    <>
      <TopBar title="Analytics" crumbs={['Studio']} />
      <PageBody>
        <div className="grid grid-cols-4 gap-4">
          <Kpi label="Quoted value" value={gbp(totalValue)} delta={`${proposals.length} proposals`} deltaTone="muted" />
          <Kpi variant="blue" label="Won value" value={gbp(wonValue)} delta="Signed" />
          <Kpi label="kWp designed" value={`${totalKwp.toFixed(1)}`} delta="Across all roofs" deltaTone="muted" />
          <Kpi variant="deep" label="Savings offered" value={`${gbp(totalSavings)}/yr`} delta="To customers" />
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
          <div className="bg-surface border border-border rounded-card p-5">
            <div className="text-[15px] font-semibold text-ink mb-4">Proposal funnel</div>
            <div className="flex flex-col gap-3">
              {counts.map((c) => (
                <div key={c.st} className="flex items-center gap-3">
                  <div className="w-16 text-[13px] text-ink-3">{c.st}</div>
                  <div className="flex-1 h-7 rounded-lg bg-control overflow-hidden"><div className="h-full rounded-lg flex items-center px-2.5 text-[12px] font-semibold text-white" style={{ width: `${(c.n / maxN) * 100}%`, background: c.st === 'Won' ? '#0E7C66' : c.st === 'Lost' ? '#B01B4F' : amberGrad, minWidth: 30 }}>{c.n}</div></div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-surface border border-border rounded-card p-5">
            <div className="text-[15px] font-semibold text-ink mb-4">System size mix</div>
            <div className="flex items-end gap-2 h-[150px]">
              {proposals.slice(0, 10).map((d) => {
                const h = (d.solar!.systemKwp / Math.max(...proposals.map((p) => p.solar!.systemKwp))) * 120
                return <div key={d.id} className="flex-1 rounded-t" title={`${d.solar!.address}: ${d.solar!.systemKwp} kWp`} style={{ height: h, background: amberGrad }} />
              })}
              {proposals.length === 0 && <div className="text-[13px] text-muted-2">No proposals yet.</div>}
            </div>
          </div>
        </div>
      </PageBody>
    </>
  )
}

/* ---------- Templates (stub) ---------- */
export function StudioTemplates() {
  const act = useActions()
  const templates = [
    { name: 'Residential solar', desc: 'Standard home rooftop system', on: true },
    { name: 'Solar + battery', desc: 'PV with backup storage', on: true },
    { name: 'Commercial rooftop', desc: 'Larger flat-roof arrays', on: false },
    { name: 'Solar + EV charger', desc: 'Home system with EV charging', on: false },
  ]
  return (
    <>
      <TopBar title="Templates" crumbs={['Studio']} actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => act.toast('New proposal template (demo)', 'accent')}>New template</Button>} />
      <PageBody>
        <div className="text-[13px] text-muted-b max-w-[640px]">Proposal templates set the default products, pricing and inclusions for each system type — so every quote is accurate and on-brand.</div>
        <div className="grid grid-cols-2 gap-4">
          {templates.map((t) => (
            <div key={t.name} className="bg-surface border border-border rounded-card p-4 flex items-start gap-3">
              <span className="w-10 h-10 rounded-[10px] flex items-center justify-center text-white shrink-0" style={{ background: t.on ? amberGrad : '#8A94A4' }}><File size={18} /></span>
              <div className="flex-1">
                <div className="flex items-center gap-2"><span className="text-[14px] font-semibold text-ink-2">{t.name}</span>{t.on && <Chip tone="positive" dot>Active</Chip>}</div>
                <div className="text-[12.5px] text-muted-2 mt-0.5">{t.desc}</div>
                <button onClick={() => act.toast(`${t.name} template opened (demo)`, 'accent')} className="mt-2 text-[12.5px] font-semibold flex items-center gap-1" style={{ color: AMBER }}>{t.on ? <><Check size={13} /> Edit template</> : 'Enable template'}</button>
              </div>
            </div>
          ))}
        </div>
      </PageBody>
    </>
  )
}
