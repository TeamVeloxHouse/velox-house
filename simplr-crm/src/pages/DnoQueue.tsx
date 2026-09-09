import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Kpi, Chip } from '../components/ui'
import { PillTabs } from '../components/chrome'
import { Bolt, Envelope, Layers } from '../components/icons'
import { Table, Row, Cell } from '../components/Table'
import { useState_ } from '../store/store'
import { FORM_TONE, STATUS_LABEL } from '../lib/dno'
import type { StudioProject, DnoStatus } from '../store/types'
import { classNames } from '../lib/format'

const tone: Record<string, 'positive' | 'accent' | 'warning' | 'neutral'> = FORM_TONE as any
const statusTone: Record<DnoStatus, 'positive' | 'accent' | 'warning' | 'neutral' | 'negative'> = {
  draft: 'neutral', validated: 'accent', submitted: 'accent', reviewing: 'warning', info: 'warning',
  approved: 'positive', installed: 'positive', pto: 'positive', rejected: 'negative',
}
const OPEN: DnoStatus[] = ['submitted', 'reviewing', 'info']

function parseStamp(s?: string): number | null {
  if (!s) return null
  const t = Date.parse(s)
  return isNaN(t) ? null : t
}
function agingDays(s?: string): number | null {
  const t = parseStamp(s)
  return t == null ? null : Math.max(0, Math.round((Date.now() - t) / 864e5))
}

export function DnoQueue() {
  const nav = useNavigate()
  const { projects } = useState_()
  const [tab, setTab] = useState('applications')

  const apps = useMemo(() => projects.filter((p) => p.dno), [projects])
  const submitted = apps.filter((p) => OPEN.includes(p.dno!.status))
  const approved = apps.filter((p) => ['approved', 'installed', 'pto'].includes(p.dno!.status))
  const draft = apps.filter((p) => ['draft', 'validated'].includes(p.dno!.status))
  const oldest = submitted.map((p) => agingDays(p.dno!.submittedAt) ?? 0).reduce((a, b) => Math.max(a, b), 0)

  const replies = useMemo(() => {
    const out: { p: StudioProject; body: string; at: string }[] = []
    apps.forEach((p) => p.dno!.messages.filter((m) => m.from === 'dno').forEach((m) => out.push({ p, body: m.body, at: m.at })))
    return out
  }, [apps])

  return (
    <>
      <TopBar title="DNO applications" crumbs={['Studio', 'Compliance']} />
      <PageBody>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Kpi label="Total applications" value={String(apps.length)} delta={`${draft.length} in draft`} deltaTone="muted" />
          <Kpi variant="blue" label="Awaiting DNO" value={String(submitted.length)} delta={oldest ? `oldest ${oldest} days` : 'none open'} />
          <Kpi label="Approved / live" value={String(approved.length)} delta="Offer received" deltaTone="muted" />
          <Kpi variant="deep" label="Replies to review" value={String(replies.length)} delta="From DNOs" />
        </div>

        <PillTabs className="mt-1" value={tab} onChange={setTab} tabs={[
          { id: 'applications', label: `Applications · ${apps.length}`, icon: Layers },
          { id: 'replies', label: `DNO replies${replies.length ? ` · ${replies.length}` : ''}`, icon: Envelope },
        ]} />

        {tab === 'applications' && (
          apps.length === 0 ? (
            <div className="bg-surface border border-border rounded-card p-8 text-center text-[13px] text-muted-b">No DNO applications yet. Open a delivery project and run DNO Autopilot from its DNO tab.</div>
          ) : (
            <Table
              template="1.7fr 0.9fr 1.5fr 1.1fr 0.9fr 1fr"
              columns={[{ key: 'a', header: 'Project' }, { key: 'f', header: 'Form' }, { key: 'd', header: 'DNO region' }, { key: 's', header: 'Status' }, { key: 'g', header: 'Aging', align: 'right' }, { key: 'r', header: 'Reference' }]}
              footer={<span>{apps.length} application{apps.length === 1 ? '' : 's'}</span>}
            >
              {apps.map((p) => {
                const d = p.dno!
                const age = OPEN.includes(d.status) ? agingDays(d.submittedAt) : null
                return (
                  <Row key={p.id} template="1.7fr 0.9fr 1.5fr 1.1fr 0.9fr 1fr" onClick={() => nav(`/studio/delivery/${p.id}#dno`)}>
                    <Cell className="font-semibold text-ink-2">
                      <div className="flex items-center gap-2.5"><span className="w-6 h-6 rounded-md bg-accent-wash text-accent flex items-center justify-center shrink-0"><Bolt size={13} /></span><div className="min-w-0"><div className="truncate">{p.address}</div><div className="text-[11px] text-muted-2 font-normal">{p.customer}</div></div></div>
                    </Cell>
                    <Cell><Chip tone={tone[d.form]} dot>{d.form}</Chip></Cell>
                    <Cell muted>{d.dnoRegion}</Cell>
                    <Cell><Chip tone={statusTone[d.status]} dot>{STATUS_LABEL[d.status]}</Chip></Cell>
                    <Cell align="right" className={classNames('tabular-nums', age != null && age > 20 ? 'text-warn font-semibold' : 'text-muted-b')}>{age != null ? `${age}d` : '—'}</Cell>
                    <Cell muted className="font-mono text-[12px]">{d.reference ?? '—'}</Cell>
                  </Row>
                )
              })}
            </Table>
          )
        )}

        {tab === 'replies' && (
          replies.length === 0 ? (
            <div className="bg-surface border border-border rounded-card p-8 text-center text-[13px] text-muted-b">No DNO replies yet. Replies to submitted applications land here.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {replies.map((r, i) => (
                <button key={i} onClick={() => nav(`/studio/delivery/${r.p.id}#dno`)} className="text-left bg-surface border border-border rounded-card p-4 hover:shadow-card transition-shadow">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5"><span className="w-7 h-7 rounded-lg bg-accent-wash text-accent flex items-center justify-center shrink-0"><Envelope size={14} /></span><div><div className="text-[13px] font-semibold text-ink-2">{r.p.dno!.dnoRegion.split(' ')[0]} — {r.p.address}</div><div className="text-[11px] text-muted-2">{r.p.customer} · ref {r.p.dno!.reference ?? '—'}</div></div></div>
                    <span className="text-[11.5px] text-muted-2">{r.at}</span>
                  </div>
                  <div className="text-[12.5px] text-ink-3 leading-relaxed pl-10">{r.body}</div>
                </button>
              ))}
            </div>
          )
        )}
      </PageBody>
    </>
  )
}
