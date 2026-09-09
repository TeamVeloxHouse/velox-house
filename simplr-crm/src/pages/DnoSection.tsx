import { useEffect, useMemo, useState } from 'react'
import { Button, Chip } from '../components/ui'
import { Modal, Field, Input, Select } from '../components/overlays'
import { Check, Bolt, File, Send, Plus, MapPin, Sparkle, Download } from '../components/icons'
import { useActions } from '../store/store'
import {
  buildSldModel, FORM_TONE, STATUS_LABEL,
  STATUS_ORDER, nextStatus, resolveDno, matchTypeTest,
} from '../lib/dno'
import { openDnoPdf, downloadDnoPdf } from '../lib/dnoPdf'
import type { StudioProject, DnoApplication, DnoDevice, DnoRun, DnoDoc, PvString, ExportScheme } from '../store/types'
import { classNames } from '../lib/format'

const tone: Record<string, 'positive' | 'accent' | 'warning' | 'neutral'> = FORM_TONE as any

/** Animated status pill — reusable on the delivery board card, project header, anywhere. */
export function DnoStatusPill({ dno, size = 'sm' }: { dno?: DnoApplication; size?: 'sm' | 'md' }) {
  if (!dno) return null
  const running = dno.run?.active
  const pad = size === 'md' ? 'text-[12px] px-2.5 py-1' : 'text-[10.5px] px-2 py-0.5'
  if (running) {
    return (
      <span className={classNames('inline-flex items-center gap-1.5 rounded-full font-semibold bg-accent-wash text-accent-deep', pad)}>
        <span className="dno-spin w-2.5 h-2.5 rounded-full border-[1.5px] border-accent border-t-transparent" />
        <span className="truncate max-w-[150px]">{dno.run!.step}…</span>
        <style>{`.dno-spin{animation:dnospin .7s linear infinite}@keyframes dnospin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.dno-spin{animation:none}}`}</style>
      </span>
    )
  }
  const t = dno.status === 'rejected' ? 'negative' : dno.status === 'pto' || dno.status === 'approved' || dno.status === 'installed' ? 'positive' : dno.status === 'reviewing' || dno.status === 'info' ? 'warning' : 'accent'
  const toneCls: Record<string, string> = { positive: 'bg-positive/10 text-positive', warning: 'bg-warn/10 text-warn', negative: 'bg-negative/10 text-negative', accent: 'bg-accent-wash text-accent-deep' }
  const pulse = dno.status === 'submitted' || dno.status === 'reviewing'
  return (
    <span className={classNames('inline-flex items-center gap-1.5 rounded-full font-semibold', toneCls[t], pad)}>
      <span className={classNames('w-1.5 h-1.5 rounded-full bg-current', pulse && 'dno-pulse')} />
      DNO · {dno.form} · {STATUS_LABEL[dno.status]}
      {pulse && <style>{`.dno-pulse{animation:dnopulse 1.4s ease-in-out infinite}@keyframes dnopulse{0%,100%{opacity:1}50%{opacity:.35}}@media (prefers-reduced-motion:reduce){.dno-pulse{animation:none}}`}</style>}
    </span>
  )
}

/** The DNO Autopilot cockpit — a section on the delivery project. */
export function DnoTab({ p }: { p: StudioProject }) {
  const act = useActions()
  const dno = p.dno
  const [editOpen, setEditOpen] = useState(false)
  const [msgOpen, setMsgOpen] = useState(false)
  const [refInput, setRefInput] = useState('')

  const run = () => act.startDnoRun(p.id)
  // The mounted tab OWNS the pacing: advance one step per tick until the last, then finish.
  // Keyed on run.index so it drives whoever started the run (button or Ovi), can't leak across
  // unmounts, and self-heals a stuck/orphaned run (or clears a stale pre-upgrade one).
  const runActive = p.dno?.run?.active
  const runIndex = p.dno?.run?.index
  useEffect(() => {
    const r = p.dno?.run
    if (!r?.active) return
    if (!r.steps?.length) { act.finishDnoRun(p.id); return }
    if (r.index >= r.steps.length - 1) {
      const id = setTimeout(() => act.finishDnoRun(p.id), 420)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => act.setDnoRunStep(p.id, r.index + 1, r.steps[r.index + 1]), 600)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runActive, runIndex])

  // AI running — show the live stream, on the card and here.
  if (dno?.run?.active && dno.run.steps?.length) return <RunningPanel run={dno.run} address={p.address} />

  if (!dno) {
    return (
      <div className="bg-surface border border-border rounded-card p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-accent-wash text-accent flex items-center justify-center mx-auto mb-3"><Sparkle size={22} /></div>
        <div className="text-[16px] font-semibold text-ink mb-1">Queue the DNO application</div>
        <div className="text-[13px] text-muted-b max-w-[440px] mx-auto mb-4">Autopilot reads this project — system size, MPAN, devices from the survey &amp; design — classifies the connection (G98 / G99), builds the pack and tracks the DNO's reply. You'll watch it work, then review and sign. No re-keying.</div>
        <Button variant="primary" icon={<Sparkle size={15} />} onClick={run}>Queue DNO application</Button>
      </div>
    )
  }

  const inverters = dno.devices.filter((d) => d.kind === 'inverter')
  const totalOutputKw = inverters.reduce((s, d) => s + d.capacityKw, 0)
  const offRegister = dno.devices.filter((d) => !d.onRegister)
  const bothSigned = dno.signatures.installer && dno.signatures.client
  const canSubmit = dno.status === 'validated' && bothSigned
  const stepIdx = STATUS_ORDER.indexOf(dno.status as any)

  return (
    <div className="flex flex-col gap-4">
      {/* Verdict */}
      <div className="bg-surface border border-border rounded-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-accent-wash text-accent flex items-center justify-center shrink-0"><Bolt size={20} /></span>
            <div>
              <div className="flex items-center gap-2.5"><span className="text-[20px] font-bold text-ink leading-none">{dno.classification}</span><Chip tone={tone[dno.form]} dot>{dno.form}</Chip></div>
              <div className="text-[12.5px] text-muted-b mt-1.5">Aggregate RC <b className="text-ink-2 tabular-nums">{dno.aggregateRcA} A</b> · {dno.meetsSgi ? 'meets' : 'does not meet'} SGI criteria · {dno.phase === 1 ? 'single' : 'three'}-phase</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={run} className="text-[12.5px] text-accent font-semibold inline-flex items-center gap-1"><Sparkle size={13} /> Re-run</button>
            <Button icon={<Plus size={14} />} onClick={() => setEditOpen(true)}>Edit inputs</Button>
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-surface-tint border border-divider p-3.5 text-[12.5px] text-ink-3 leading-relaxed">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-accent font-semibold">Routing rationale</span>
          <div className="mt-1">{dno.rationale}</div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <Field2 label="DNO region" value={dno.dnoRegion} />
          <Field2 label="MPAN" value={dno.mpan ?? '—'} mono />
          <Field2 label="Inverter output" value={`${totalOutputKw} kW`} />
          <Field2 label="Export" value={dno.exportScheme && dno.exportScheme !== 'none' ? `${dno.exportScheme} · ${dno.exportLimitKw ?? '?'} kW` : 'Not limited'} />
        </div>
      </div>

      {/* Lifecycle strip */}
      <div className="bg-surface border border-border rounded-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[15px] font-semibold text-ink">Application status</div>
          <DnoStatusPill dno={dno} size="md" />
        </div>
        <div className="flex items-center mb-4">
          {STATUS_ORDER.map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5 shrink-0" style={{ width: 52 }}>
                <div className={classNames('w-7 h-7 rounded-full flex items-center justify-center border-2', i < stepIdx ? 'bg-positive border-positive text-white' : i === stepIdx ? 'border-accent text-accent bg-accent-wash' : 'border-input-border text-muted-3')}>
                  {i < stepIdx ? <Check size={13} strokeWidth={3} /> : <span className="text-[11px] font-bold">{i + 1}</span>}
                </div>
                <span className={classNames('text-[9.5px] text-center leading-tight', i === stepIdx ? 'text-accent font-semibold' : 'text-muted-2')}>{STATUS_LABEL[s]}</span>
              </div>
              {i < STATUS_ORDER.length - 1 && <div className="flex-1 h-0.5 mx-1 -mt-4" style={{ background: i < stepIdx ? '#0E7C66' : '#E4E8EE' }} />}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {dno.status === 'draft' && <Button variant="primary" icon={<File size={15} />} onClick={() => act.generateDnoDocs(p.id, 'pre-install')}>Generate pre-install pack</Button>}
          {dno.status === 'validated' && !canSubmit && <span className="text-[12.5px] text-warn font-medium">Capture both signatures below to submit.</span>}
          {canSubmit && <Button variant="primary" icon={<Send size={15} />} onClick={() => act.advanceDno(p.id)}>Submit to {dno.dnoRegion.split(' ')[0]}</Button>}
          {dno.status === 'submitted' && <Button variant="primary" onClick={() => act.setDnoStatus(p.id, 'reviewing')}>Mark under review</Button>}
          {dno.status === 'reviewing' && (
            <div className="flex items-center gap-2">
              <Input value={refInput} onChange={(e) => setRefInput(e.target.value)} placeholder="DNO reference (optional)" className="w-52" />
              <Button variant="primary" icon={<Check size={15} />} onClick={() => act.setDnoStatus(p.id, 'approved', refInput || undefined)}>Confirm approved</Button>
              <button onClick={() => act.setDnoStatus(p.id, 'rejected')} className="text-[12.5px] text-negative font-semibold hover:underline">Rejected</button>
            </div>
          )}
          {dno.status === 'approved' && <Button variant="primary" onClick={() => act.setDnoStatus(p.id, 'installed')}>Mark installed</Button>}
          {dno.status === 'installed' && <Button variant="primary" icon={<File size={15} />} onClick={() => { act.generateDnoDocs(p.id, 'post-install'); act.setDnoStatus(p.id, 'pto') }}>Generate post-install pack &amp; complete</Button>}
          {dno.reference && <span className="text-[12.5px] text-muted-b">Ref <b className="font-mono text-ink-2">{dno.reference}</b></span>}
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1.25fr 1fr' }}>
        <div className="flex flex-col gap-4">
          {/* SLD */}
          <div className="bg-surface border border-border rounded-card p-5">
            <div className="flex items-center justify-between mb-1"><div className="text-[15px] font-semibold text-ink">Single line diagram</div><span className="text-[11.5px] font-mono text-muted-2 uppercase tracking-wider">Auto-generated</span></div>
            <div className="text-[12px] text-muted-2 mb-3">{dno.strings.length} string{dno.strings.length === 1 ? '' : 's'} → {inverters.length} inverter{inverters.length === 1 ? '' : 's'}{dno.devices.some((d) => d.kind === 'battery') ? ' + storage' : ''}</div>
            <Sld app={dno} />
          </div>

          {/* Equipment schedule */}
          <div className="bg-surface border border-border rounded-card p-5">
            <div className="flex items-center justify-between mb-3"><div className="text-[15px] font-semibold text-ink">Equipment schedule</div>{offRegister.length > 0 ? <Chip tone="negative" dot>{offRegister.length} off register</Chip> : <Chip tone="positive" dot>All on ENA register</Chip>}</div>
            <div className="flex flex-col gap-2">
              {dno.devices.map((d) => (
                <div key={d.id} className="flex items-center gap-3 py-1.5">
                  <span className={classNames('w-2 h-2 rounded-full shrink-0', d.onRegister ? 'bg-positive' : 'bg-negative')} />
                  <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2">{d.make} {d.model}</div><div className="text-[11.5px] text-muted-2"><span className="capitalize">{d.kind}</span> · {d.capacityKw} {d.kind === 'battery' ? 'kWh' : 'kW'}{d.powerFactor ? ` · pf ${d.powerFactor}` : ''}</div></div>
                  <span className={classNames('text-[11px] font-mono', d.onRegister ? 'text-muted-b' : 'text-negative')}>{d.typeTestRef ?? 'Not type-tested'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Site details */}
          <div className="bg-surface border border-border rounded-card p-5">
            <div className="text-[15px] font-semibold text-ink mb-3">System &amp; site details</div>
            <div className="grid grid-cols-2 gap-3">
              <Field2 label="Supply phase" value={dno.phase === 1 ? 'Single phase' : 'Three phase'} />
              <Field2 label="Install location" value={dno.installLocation ?? '—'} />
              <Field2 label="Isolator location" value={dno.isolatorLocation ?? '—'} />
              <Field2 label="Pre-existing generation" value={dno.preExisting ? 'Yes' : 'No'} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Signatures */}
          <div className="bg-surface border border-border rounded-card p-5">
            <div className="text-[15px] font-semibold text-ink mb-3">Signatures</div>
            <SigRow label="Installer" who="installer" p={p} name={p.owner} />
            <SigRow label="Client" who="client" p={p} name={p.customer} />
          </div>

          {/* Documents */}
          <div className="bg-surface border border-border rounded-card p-5">
            <div className="flex items-center justify-between mb-3"><div className="text-[15px] font-semibold text-ink">Documents</div>{dno.documents.some((d) => d.kind === 'pre-install') && <button className="text-[12.5px] text-accent font-semibold" onClick={() => act.generateDnoDocs(p.id, 'pre-install')}>Regenerate</button>}</div>
            {dno.documents.length === 0 ? (
              <div className="text-[12.5px] text-muted-2 py-3 text-center">No pack yet. Generate the pre-install pack from the status panel above.</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {dno.documents.map((d) => (
                  <div key={d.id} className="flex items-center gap-2.5 py-1.5">
                    <span className="w-7 h-7 rounded-lg bg-accent-wash text-accent flex items-center justify-center shrink-0"><File size={13} /></span>
                    <div className="min-w-0 flex-1"><div className="text-[12.5px] font-semibold text-ink-2 font-mono truncate">{d.name}</div><div className="text-[11px] text-muted-2 capitalize">{d.kind} · {d.pages}pp · {d.generatedAt}</div></div>
                    <button onClick={() => openDnoPdf(p, d)} className="text-[12px] text-accent font-semibold hover:underline shrink-0">Preview</button>
                    <button onClick={() => downloadDnoPdf(p, d)} className="w-7 h-7 rounded-md hover:bg-control text-muted-b flex items-center justify-center shrink-0" title="Download"><Download size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DNO messages */}
          <div className="bg-surface border border-border rounded-card p-5">
            <div className="flex items-center justify-between mb-3"><div className="text-[15px] font-semibold text-ink">DNO correspondence</div><button className="text-[12.5px] text-accent font-semibold" onClick={() => setMsgOpen(true)}>Message DNO</button></div>
            {dno.messages.length === 0 ? (
              <div className="text-[12.5px] text-muted-2 py-3 text-center">No replies yet. Auto-submissions are tracked here; you can message the DNO to follow up.</div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {dno.messages.map((m) => (
                  <div key={m.id} className={classNames('rounded-lg p-3 text-[12.5px]', m.from === 'dno' ? 'bg-surface-tint border border-divider' : 'bg-accent-wash')}>
                    <div className="flex items-center justify-between mb-1"><span className={classNames('text-[10.5px] font-mono uppercase tracking-wider font-semibold', m.from === 'dno' ? 'text-ink-3' : 'text-accent')}>{m.from === 'dno' ? dno.dnoRegion.split(' ')[0] : 'You'}</span><span className="text-[11px] text-muted-2">{m.at}</span></div>
                    <div className="text-ink-3 leading-relaxed">{m.body}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-surface border border-border rounded-card p-5">
        <div className="text-[15px] font-semibold text-ink mb-3">Audit trail</div>
        <div className="flex flex-col">
          {dno.events.map((e, i) => (
            <div key={e.id} className="flex gap-3">
              <div className="flex flex-col items-center"><div className={classNames('w-2.5 h-2.5 rounded-full shrink-0 mt-1', i === dno.events.length - 1 ? 'bg-accent' : 'bg-positive')} />{i < dno.events.length - 1 && <div className="w-0.5 flex-1 my-0.5 bg-divider" style={{ minHeight: 18 }} />}</div>
              <div className="pb-2.5"><div className="text-[12.5px] font-semibold text-ink-2">{e.label}</div><div className="text-[11px] text-muted-2">{e.at}{e.note ? ` · ${e.note}` : ''}</div></div>
            </div>
          ))}
        </div>
      </div>

      <EditInputsModal open={editOpen} onClose={() => setEditOpen(false)} p={p} dno={dno} />
      <MessageModal open={msgOpen} onClose={() => setMsgOpen(false)} p={p} region={dno.dnoRegion} />
    </div>
  )
}

/** Live AI stream — spinner→✓ per step, driven by the watched run state. */
function RunningPanel({ run, address }: { run: DnoRun; address: string }) {
  return (
    <div className="bg-surface border border-border rounded-card p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-8 h-8 rounded-lg bg-accent-wash text-accent flex items-center justify-center"><Sparkle size={16} /></span>
        <div><div className="text-[15px] font-semibold text-ink">DNO Autopilot is preparing the application</div><div className="text-[12px] text-muted-2">{address}</div></div>
      </div>
      <div className="flex flex-col gap-2.5 max-w-[560px]">
        {run.steps.map((label, i) => {
          const done = i < run.index
          const active = i === run.index
          return (
            <div key={i} className={classNames('flex items-center gap-3 text-[13px]', done ? 'text-ink-2' : active ? 'text-ink font-semibold' : 'text-muted-3')}>
              <span className={classNames('w-5 h-5 rounded-full flex items-center justify-center shrink-0', done ? 'bg-positive text-white' : active ? 'border-2 border-accent' : 'border border-input-border')}>
                {done ? <Check size={11} strokeWidth={3} /> : active ? <span className="dno-spin w-2.5 h-2.5 rounded-full border-[1.5px] border-accent border-t-transparent" /> : null}
              </span>
              <span>{label}</span>
            </div>
          )
        })}
      </div>
      <style>{`.dno-spin{animation:dnospin .7s linear infinite}@keyframes dnospin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.dno-spin{animation:none}}`}</style>
    </div>
  )
}

function Field2({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-divider bg-surface-tint px-3 py-2">
      <div className="text-[10.5px] font-mono uppercase tracking-wider text-muted-2 font-semibold">{label}</div>
      <div className={classNames('text-[13px] font-semibold text-ink-2 mt-0.5 truncate', mono && 'font-mono')} title={value}>{value}</div>
    </div>
  )
}

function SigRow({ label, who, p, name }: { label: string; who: 'installer' | 'client'; p: StudioProject; name: string }) {
  const act = useActions()
  const sig = p.dno?.signatures[who]
  return (
    <div className="flex items-center justify-between py-2 border-b border-divider last:border-0">
      <div><div className="text-[13px] font-semibold text-ink-2">{label}</div><div className="text-[11.5px] text-muted-2">{sig ? `${sig.by} · signed ${sig.signedAt}` : name}</div></div>
      {sig ? <Chip tone="positive" dot>Signed</Chip> : <Button onClick={() => act.signDno(p.id, who, name)}>Capture signature</Button>}
    </div>
  )
}

/** Rule-generated single line diagram as inline SVG (theme-aware via CSS-var tokens). */
function Sld({ app }: { app: DnoApplication }) {
  const nodes = useMemo(() => buildSldModel(app), [app])
  const rowH = 52
  const h = nodes.length * rowH + 20
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 460 ${h}`} width="100%" style={{ maxWidth: 460 }} role="img" aria-label="Single line diagram">
        {nodes.map((n, i) => {
          const y = 20 + i * rowH
          const cx = 150
          return (
            <g key={n.key}>
              {i < nodes.length - 1 && <line x1={cx} y1={y + 18} x2={cx} y2={y + rowH + 2} stroke="var(--sld-line, #C7CFDA)" strokeWidth={1.5} />}
              <rect x={cx - 26} y={y} width={52} height={34} rx={6} fill="var(--sld-box, #F5F7FA)" stroke="var(--sld-stroke, #B9C2CF)" strokeWidth={1.4} />
              <SldGlyph kind={n.key} x={cx} y={y + 17} />
              <text x={cx + 40} y={y + 14} fontSize={12} fontWeight={600} fill="var(--sld-text, #333C48)" style={{ fontFamily: 'inherit' }}>{n.label}</text>
              {n.note && <text x={cx + 40} y={y + 28} fontSize={10} fill="var(--sld-muted, #8B95A4)" style={{ fontFamily: 'inherit' }}>{n.note}</text>}
            </g>
          )
        })}
      </svg>
      <style>{`
        :root { --sld-line:#C7CFDA; --sld-box:#F5F7FA; --sld-stroke:#B9C2CF; --sld-text:#333C48; --sld-muted:#8B95A4; --sld-accent:#2E5AD8; }
        .dark, [data-theme="dark"] { --sld-line:#2C3644; --sld-box:#141C26; --sld-stroke:#394452; --sld-text:#C2CBD8; --sld-muted:#6C7787; --sld-accent:#6E93F5; }
      `}</style>
    </div>
  )
}

function SldGlyph({ kind, x, y }: { kind: string; x: number; y: number }) {
  const c = 'var(--sld-accent, #2E5AD8)'
  if (kind === 'array') return <g stroke={c} strokeWidth={1.3} fill="none"><rect x={x - 14} y={y - 7} width={28} height={14} rx={1.5} /><line x1={x - 7} y1={y - 7} x2={x - 7} y2={y + 7} /><line x1={x} y1={y - 7} x2={x} y2={y + 7} /><line x1={x + 7} y1={y - 7} x2={x + 7} y2={y + 7} /></g>
  if (kind === 'inverter') return <g stroke={c} strokeWidth={1.4} fill="none"><rect x={x - 11} y={y - 8} width={22} height={16} rx={2} /><path d={`M${x - 6} ${y + 3} q3 -9 6 0`} /></g>
  if (kind === 'battery') return <g stroke={c} strokeWidth={1.4} fill="none"><rect x={x - 12} y={y - 6} width={24} height={12} rx={2} /><line x1={x + 12} y1={y - 3} x2={x + 15} y2={y - 3} /></g>
  if (kind === 'meter') return <g stroke={c} strokeWidth={1.3} fill="none"><circle cx={x} cy={y} r={8} /><line x1={x} y1={y} x2={x + 4} y2={y - 4} /></g>
  if (kind === 'cutout') return <g stroke={c} strokeWidth={1.4} fill="none"><path d={`M${x} ${y - 8} l6 8 -6 8 -6 -8 z`} /></g>
  return <g stroke={c} strokeWidth={1.4} fill="none"><circle cx={x - 6} cy={y} r={2.4} /><line x1={x - 4} y1={y} x2={x + 7} y2={y - 5} /></g>
}

const INSTALL_LOCATIONS = ['Loft', 'Roof space', 'Garage', 'Outbuilding', 'Plant room', 'Utility room']
const ISOLATOR_LOCATIONS = ['Next to inverter', 'By the meter', 'External wall', 'Consumer unit']

function EditInputsModal({ open, onClose, p, dno }: { open: boolean; onClose: () => void; p: StudioProject; dno: DnoApplication }) {
  const act = useActions()
  const [phase, setPhase] = useState<1 | 3>(dno.phase)
  const [mpan, setMpan] = useState(dno.mpan ?? '')
  const [devices, setDevices] = useState<DnoDevice[]>(dno.devices)
  const [strings, setStrings] = useState<PvString[]>(dno.strings)
  const [scheme, setScheme] = useState<ExportScheme>(dno.exportScheme ?? 'none')
  const [limitKw, setLimitKw] = useState(String(dno.exportLimitKw ?? ''))
  const [installLocation, setInstall] = useState(dno.installLocation ?? 'Loft')
  const [isolatorLocation, setIsolator] = useState(dno.isolatorLocation ?? 'Next to inverter')
  const [preExisting, setPre] = useState(!!dno.preExisting)
  const previewRegion = resolveDno(mpan)
  const inverters = devices.filter((d) => d.kind === 'inverter')

  const patchDevice = (id: string, patch: Partial<DnoDevice>) => setDevices((arr) => arr.map((d) => {
    if (d.id !== id) return d
    const merged = { ...d, ...patch }
    if (patch.make != null || patch.model != null) { const m = matchTypeTest(merged.make, merged.model); merged.typeTestRef = m.typeTestRef; merged.onRegister = m.onRegister }
    return merged
  }))
  const addInverter = () => setDevices((arr) => [...arr, { id: `inv${Date.now()}`, kind: 'inverter', make: 'Solis', model: 'S6-EH1P8K-L', capacityKw: 4, powerFactor: 1.0, ...matchTypeTest('Solis', 'S6-EH1P8K-L') }])
  const addString = () => setStrings((arr) => [...arr, { id: `s${Date.now()}`, panels: 8, watts: 480, inverterId: inverters[0]?.id ?? 'dev-inv' }])
  const totalKwp = strings.reduce((s, st) => s + (st.panels * st.watts) / 1000, 0)

  const save = () => {
    act.updateDnoInputs(p.id, {
      phase, mpan: mpan || undefined, devices, strings, exportScheme: scheme,
      exportLimitKw: scheme === 'none' ? undefined : Number(limitKw) || undefined,
      installLocation, isolatorLocation, preExisting,
    })
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="System details" subtitle="Pre-filled from the survey & design — edit anything; Autopilot re-classifies on save" width={680}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={<Sparkle size={14} />} onClick={save}>Save &amp; re-classify</Button></>}>
      <div className="flex flex-col gap-4 max-h-[62vh] overflow-y-auto pr-1">
        <Section title="Supply & site">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supply phase"><Select value={String(phase)} onChange={(e) => setPhase(Number(e.target.value) as 1 | 3)}><option value="1">Single phase</option><option value="3">Three phase</option></Select></Field>
            <Field label="MPAN"><Input value={mpan} onChange={(e) => setMpan(e.target.value)} placeholder="13-digit MPAN" /></Field>
          </div>
          <div className="text-[11.5px] text-muted-b flex items-center gap-1.5"><MapPin size={12} /> Resolves to <b className="text-ink-2">{previewRegion}</b></div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Install location"><Select value={installLocation} onChange={(e) => setInstall(e.target.value)}>{INSTALL_LOCATIONS.map((l) => <option key={l}>{l}</option>)}</Select></Field>
            <Field label="Lockable isolator location"><Select value={isolatorLocation} onChange={(e) => setIsolator(e.target.value)}>{ISOLATOR_LOCATIONS.map((l) => <option key={l}>{l}</option>)}</Select></Field>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" checked={preExisting} onChange={(e) => setPre(e.target.checked)} /> Pre-existing generation already on site</label>
        </Section>

        <Section title="Inverters & storage">
          <div className="flex flex-col gap-2">
            {devices.map((d) => (
              <div key={d.id} className="grid gap-2 items-center" style={{ gridTemplateColumns: '1.1fr 1.3fr 64px 56px 24px' }}>
                <Input value={d.make} onChange={(e) => patchDevice(d.id, { make: e.target.value })} placeholder="Make" />
                <Input value={d.model} onChange={(e) => patchDevice(d.id, { model: e.target.value })} placeholder="Model" />
                <Input type="number" value={String(d.capacityKw)} onChange={(e) => patchDevice(d.id, { capacityKw: Number(e.target.value) })} placeholder={d.kind === 'battery' ? 'kWh' : 'kW'} />
                <span className={classNames('text-[10px] font-mono text-center', d.onRegister ? 'text-positive' : 'text-negative')}>{d.onRegister ? '✓ ENA' : 'off reg'}</span>
                <button onClick={() => setDevices((arr) => arr.filter((x) => x.id !== d.id))} className="text-muted-3 hover:text-negative text-[16px]">×</button>
              </div>
            ))}
          </div>
          <button onClick={addInverter} className="text-[13px] text-accent font-semibold flex items-center gap-1"><Plus size={14} /> Add inverter</button>
        </Section>

        <Section title={`PV strings · ${Math.round(totalKwp * 100) / 100} kWp`}>
          <div className="flex flex-col gap-2">
            {strings.map((st, i) => (
              <div key={st.id} className="grid gap-2 items-center" style={{ gridTemplateColumns: '20px 64px 12px 72px 1.2fr 24px' }}>
                <span className="text-[11px] text-muted-2 font-mono">{i + 1}.</span>
                <Input type="number" value={String(st.panels)} onChange={(e) => setStrings((arr) => arr.map((x) => (x.id === st.id ? { ...x, panels: Number(e.target.value) } : x)))} placeholder="panels" />
                <span className="text-[12px] text-muted-3 text-center">×</span>
                <Input type="number" value={String(st.watts)} onChange={(e) => setStrings((arr) => arr.map((x) => (x.id === st.id ? { ...x, watts: Number(e.target.value) } : x)))} placeholder="W" />
                <Select value={st.inverterId} onChange={(e) => setStrings((arr) => arr.map((x) => (x.id === st.id ? { ...x, inverterId: e.target.value } : x)))}>{inverters.map((inv) => <option key={inv.id} value={inv.id}>{inv.make} {inv.model}</option>)}</Select>
                <button onClick={() => setStrings((arr) => arr.filter((x) => x.id !== st.id))} className="text-muted-3 hover:text-negative text-[16px]">×</button>
              </div>
            ))}
          </div>
          <button onClick={addString} className="text-[13px] text-accent font-semibold flex items-center gap-1"><Plus size={14} /> Add string</button>
        </Section>

        <Section title="Export limitation">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Scheme"><Select value={scheme} onChange={(e) => setScheme(e.target.value as ExportScheme)}><option value="none">None / not limited</option><option value="fixed">Fixed export limit</option><option value="dynamic">Dynamic (G100)</option></Select></Field>
            {scheme !== 'none' && <Field label="Export limit (kW)"><Input type="number" value={limitKw} onChange={(e) => setLimitKw(e.target.value)} placeholder="kW" /></Field>}
          </div>
        </Section>
      </div>
    </Modal>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-divider p-3.5">
      <div className="text-[11px] font-mono uppercase tracking-wider text-muted-b font-semibold mb-2.5">{title}</div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  )
}

function MessageModal({ open, onClose, p, region }: { open: boolean; onClose: () => void; p: StudioProject; region: string }) {
  const act = useActions()
  const [body, setBody] = useState('')
  return (
    <Modal open={open} onClose={onClose} title={`Message ${region.split(' ')[0]}`} subtitle="Follow up on this application"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={<Send size={15} />} onClick={() => { if (body.trim()) { act.addDnoMessage(p.id, 'installer', body.trim()); setBody(''); onClose() } }}>Send</Button></>}>
      <Field label="Message"><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="w-full rounded-lg border border-input-border bg-surface p-3 text-[13px] outline-none focus:border-border-blue" placeholder="Please confirm expected turnaround on our G99 application…" /></Field>
    </Modal>
  )
}
