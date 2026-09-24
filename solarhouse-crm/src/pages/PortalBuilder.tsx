import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Button } from '../components/ui'
import { Modal, Field, Input } from '../components/overlays'
import { Sliders, ChevronDown, Check, Clock, Sun, Bolt, Flow, Dollar, File, Users, Wrench, Play, Sparkle, Robot, Home } from '../components/icons'
import { useActions, useState_ } from '../store/store'
import { classNames } from '../lib/format'
import type { PortalConfig, PortalSectionConfig } from '../store/types'

/* Portal builder — no code, no Claude: an installer edits a DRAFT of their customer portal, previews
 * it live, then publishes it to every customer in one click. Every publish is kept as a version that
 * can be restored. This is what makes the portal sellable to other installers. */

const ME = 'Jordan Miles'
const COLOURS = ['#0E7A66', '#15223B', '#2563EB', '#7C3AED', '#DB2777', '#D97706', '#0891B2', '#111827']
const ICON: Record<string, (p: { size?: number }) => JSX.Element> = { Overview: Home, Progress: Flow, Energy: Bolt, Savings: Dollar, Documents: File, Community: Users, Support: Wrench, Resources: Play, 'Refer a friend': Sparkle }
const same = (a: PortalConfig, b: PortalConfig) => JSON.stringify(a) === JSON.stringify(b)

export function PortalBuilder() {
  const nav = useNavigate()
  const act = useActions()
  const { portalTemplate: t, portals } = useState_()
  const d = t.draft
  const dirty = !same(t.draft, t.live)
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop')
  const [publishOpen, setPublishOpen] = useState(false)
  const [note, setNote] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const set = (p: Partial<PortalConfig>) => act.updatePortalDraft(p)
  const setSection = (id: string, p: Partial<PortalSectionConfig>) => set({ sections: d.sections.map((s) => (s.id === id ? { ...s, ...p } : s)) })
  const move = (i: number, dir: -1 | 1) => { const s = [...d.sections]; const j = i + dir; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j], s[i]]; set({ sections: s }) }
  const live = portals.filter((p) => p.status === 'active').length

  return (
    <>
      <TopBar title="Portal builder" crumbs={['Customers', 'Portals']} identity={{ icon: Sliders, accent: '#0E7A66' }}
        actions={<>
          <span className={classNames('h-8 px-2.5 rounded-full text-[12px] font-semibold flex items-center gap-1.5', dirty ? 'bg-[#FDF3E3] text-[#B45309]' : 'bg-positive-wash text-positive')}>
            <span className={classNames('w-1.5 h-1.5 rounded-full', dirty ? 'bg-[#D97706]' : 'bg-positive')} />{dirty ? 'Draft: unpublished changes' : 'Live matches draft'}
          </span>
          <Button icon={<Clock size={15} />} onClick={() => setHistoryOpen(true)}>History · {t.versions.length}</Button>
          {dirty && <Button onClick={() => act.discardPortalDraft()}>Discard draft</Button>}
          <Button variant="primary" icon={<Check size={15} />} onClick={() => dirty && setPublishOpen(true)}>Publish to {live} customers</Button>
        </>} />
      <div className="flex-1 min-h-0 grid grid-cols-[380px_1fr]">
        {/* editor */}
        <aside className="border-r border-border bg-surface overflow-y-auto p-4 flex flex-col gap-3">
          <Group title="Brand">
            <div className="text-[12px] font-semibold text-ink-3 mb-1.5">Portal colour</div>
            <div className="flex flex-wrap gap-2">{COLOURS.map((c) => <button key={c} onClick={() => set({ brandColor: c })} className={classNames('w-8 h-8 rounded-lg border-2', d.brandColor === c ? 'border-ink' : 'border-transparent')} style={{ background: c }} title={c} />)}
              <label className="w-8 h-8 rounded-lg border border-dashed border-input-border flex items-center justify-center cursor-pointer text-muted-b text-[11px]" title="Custom colour">+<input type="color" value={d.brandColor} onChange={(e) => set({ brandColor: e.target.value })} className="sr-only" /></label>
            </div>
          </Group>
          <Group title="Welcome">
            <Field label="Headline (use {first} for their first name)"><Input value={d.welcomeTitle} onChange={(e) => set({ welcomeTitle: e.target.value })} /></Field>
            <Field label="Intro"><textarea value={d.welcomeBody} onChange={(e) => set({ welcomeBody: e.target.value })} rows={3} className="w-full rounded-control border border-input-border px-3 py-2 text-[13px] outline-none focus:border-accent resize-none" /></Field>
          </Group>
          <Group title={`Sections · ${d.sections.filter((s) => s.visible).length} shown`}>
            <div className="text-[11.5px] text-muted-2 mb-1">Show, hide, rename and reorder what customers see.</div>
            <div className="flex flex-col gap-1.5">
              {d.sections.map((s, i) => { const I = ICON[s.id] ?? Home; return (
                <div key={s.id} className={classNames('rounded-lg border px-2 py-1.5 flex items-center gap-2', s.visible ? 'border-border bg-surface' : 'border-dashed border-input-border bg-[#FAFBFC]')}>
                  <div className="flex flex-col">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="text-muted-3 hover:text-ink-3 disabled:opacity-30 leading-none"><ChevronDown size={12} className="rotate-180" /></button>
                    <button onClick={() => move(i, 1)} disabled={i === d.sections.length - 1} className="text-muted-3 hover:text-ink-3 disabled:opacity-30 leading-none"><ChevronDown size={12} /></button>
                  </div>
                  <span className={s.visible ? 'text-ink-3' : 'text-muted-3'}><I size={14} /></span>
                  <input value={s.label} onChange={(e) => setSection(s.id, { label: e.target.value })} className={classNames('flex-1 min-w-0 h-7 px-1.5 rounded text-[13px] outline-none focus:bg-control', !s.visible && 'text-muted-3')} />
                  <Toggle on={s.visible} onClick={() => setSection(s.id, { visible: !s.visible })} />
                </div>
              ) })}
            </div>
          </Group>
          <Group title="Features">
            <label className="flex items-center justify-between text-[13px] text-ink-2 py-1"><span className="flex items-center gap-2"><Robot size={14} />Ask Ovi assistant</span><Toggle on={d.askOvi} onClick={() => set({ askOvi: !d.askOvi })} /></label>
            <Field label="Referral reward (£ per install)"><Input type="number" value={String(d.referralReward)} onChange={(e) => set({ referralReward: Number(e.target.value) || 0 })} /></Field>
          </Group>
          <Group title="Support details">
            <Field label="Phone"><Input value={d.supportPhone} onChange={(e) => set({ supportPhone: e.target.value })} /></Field>
            <Field label="Email"><Input value={d.supportEmail} onChange={(e) => set({ supportEmail: e.target.value })} /></Field>
            <Field label="Google review link"><Input value={d.reviewLink} onChange={(e) => set({ reviewLink: e.target.value })} /></Field>
          </Group>
          <div className="rounded-xl bg-accent-wash-4 border border-border-blue p-3 text-[12px] text-ink-3 leading-snug">
            <b className="text-accent-700">How this works.</b> Edits save to a draft only, so customers see nothing until you press <b>Publish</b>. Every publish is kept in History and can be restored. Any installer using the app customises their portal here, without code or Claude.
          </div>
        </aside>

        {/* preview */}
        <main className="min-w-0 bg-[#EEF1F5] overflow-y-auto p-6 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 self-stretch">
            <span className="text-[12px] font-semibold text-muted-b">Draft preview</span>
            <div className="ml-auto inline-flex bg-white rounded-control p-[3px] border border-border">
              {(['desktop', 'phone'] as const).map((v) => <button key={v} onClick={() => setDevice(v)} className={classNames('h-[28px] px-3 rounded-[7px] text-[12px] font-semibold capitalize', device === v ? 'bg-ink text-white' : 'text-muted-b')}>{v}</button>)}
            </div>
            <button onClick={() => portals[0] && nav(`/customers/${portals[0].id}`)} className="text-[12px] font-semibold text-accent">Open the live portal →</button>
          </div>
          <Preview cfg={d} phone={device === 'phone'} />
        </main>
      </div>

      <Modal open={publishOpen} onClose={() => setPublishOpen(false)} title="Publish portal changes" subtitle={`This goes live for all ${live} active customers immediately`}
        footer={<><Button onClick={() => setPublishOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => { act.publishPortal(note.trim(), ME); setNote(''); setPublishOpen(false) }}>Publish now</Button></>}>
        <Field label="What changed? (for the history)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Hid Community, raised referral reward to £150" autoFocus /></Field>
        <div className="text-[12.5px] text-muted-b flex flex-col gap-1">{diff(t.live, t.draft).map((x) => <div key={x} className="flex gap-2"><span className="w-1.5 h-1.5 rounded-full bg-accent-500 mt-1.5 shrink-0" />{x}</div>)}</div>
      </Modal>
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="Version history" subtitle="Every published version. Restoring loads it into your draft, then you publish.">
        <div className="flex flex-col gap-2">
          {t.versions.map((v, i) => (
            <div key={v.id} className="rounded-lg border border-border px-3 py-2.5 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full" style={{ background: v.config.brandColor }} />
              <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate">{v.note}</div><div className="text-[11.5px] text-muted-2">{new Date(v.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {v.by}{i === 0 ? ' · live now' : ''}</div></div>
              {i > 0 && <button onClick={() => { act.restorePortalVersion(v.id); setHistoryOpen(false) }} className="h-8 px-3 rounded-control border border-border text-[12px] font-semibold text-ink-3 hover:bg-control">Restore</button>}
            </div>
          ))}
        </div>
      </Modal>
    </>
  )
}

function diff(a: PortalConfig, b: PortalConfig): string[] {
  const out: string[] = []
  if (a.brandColor !== b.brandColor) out.push('Portal colour changed')
  if (a.welcomeTitle !== b.welcomeTitle || a.welcomeBody !== b.welcomeBody) out.push('Welcome message edited')
  b.sections.forEach((s, i) => {
    const o = a.sections.find((x) => x.id === s.id)
    if (o && o.visible !== s.visible) out.push(`${s.label} ${s.visible ? 'shown' : 'hidden'}`)
    if (o && o.label !== s.label) out.push(`“${o.label}” renamed to “${s.label}”`)
    if (a.sections[i]?.id !== s.id) out.push(`Section order changed`)
  })
  if (a.askOvi !== b.askOvi) out.push(`Ask Ovi ${b.askOvi ? 'turned on' : 'turned off'}`)
  if (a.referralReward !== b.referralReward) out.push(`Referral reward £${a.referralReward} → £${b.referralReward}`)
  if (a.supportPhone !== b.supportPhone || a.supportEmail !== b.supportEmail || a.reviewLink !== b.reviewLink) out.push('Support details updated')
  return [...new Set(out)]
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <section className="rounded-xl border border-border">
      <button onClick={() => setOpen((o) => !o)} className="w-full px-3 py-2.5 flex items-center justify-between text-[12.5px] font-bold text-ink">{title}<ChevronDown size={14} className={classNames('text-muted-3 transition-transform', !open && '-rotate-90')} /></button>
      {open && <div className="px-3 pb-3 flex flex-col gap-2">{children}</div>}
    </section>
  )
}
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={classNames('w-9 h-5 rounded-full flex items-center px-0.5 shrink-0 transition-colors', on ? 'bg-accent justify-end' : 'bg-input-border justify-start')}><span className="w-4 h-4 rounded-full bg-white shadow" /></button>
}

/** A faithful-in-spirit mini portal rendered from the draft config. */
function Preview({ cfg, phone }: { cfg: PortalConfig; phone: boolean }) {
  const shown = cfg.sections.filter((s) => s.visible)
  return (
    <div className={classNames('bg-[#FAF9F5] rounded-2xl shadow-lift border border-border overflow-hidden transition-all', phone ? 'w-[360px]' : 'w-full max-w-[980px]')}>
      <div className="h-12 px-4 flex items-center gap-2 border-b border-black/5 bg-white/70">
        <img src="/solar-house-logo.png" alt="" className="w-7 h-7" />
        {!phone && <div className="flex items-center gap-1 ml-2 overflow-hidden">{shown.map((s, i) => { const I = ICON[s.id] ?? Home; return <span key={s.id} className="h-7 px-2.5 rounded-full text-[11.5px] font-semibold flex items-center gap-1 whitespace-nowrap" style={i === 0 ? { background: cfg.brandColor, color: '#fff' } : { color: '#2b5045' }}><I size={12} />{s.label}</span> })}</div>}
        {cfg.askOvi && <span className="ml-auto h-7 px-2.5 rounded-full bg-[#15223B] text-white text-[11.5px] font-semibold flex items-center gap-1"><Robot size={12} />Ask Ovi</span>}
      </div>
      <div className="p-5">
        <div className="text-[10.5px] font-extrabold uppercase tracking-wide" style={{ color: cfg.brandColor }}>The Solar House</div>
        <div className={classNames('font-extrabold text-[#12271f] leading-tight mt-0.5', phone ? 'text-[22px]' : 'text-[28px]')}>{cfg.welcomeTitle.replace('{first}', 'Sarah')} 👋</div>
        {cfg.welcomeBody && <div className="text-[13px] text-[#2f423b] mt-1.5 max-w-[560px]">{cfg.welcomeBody}</div>}
        <div className={classNames('grid gap-3 mt-4', phone ? 'grid-cols-1' : 'grid-cols-[1.5fr_1fr]')}>
          <div className="rounded-2xl p-4 text-white min-h-[140px]" style={{ background: `linear-gradient(140deg, #15223B 0%, ${cfg.brandColor} 100%)` }}>
            <div className="text-[12px] opacity-80 flex items-center gap-1"><Sun size={13} />Live energy</div>
            <div className="text-[26px] font-bold mt-1">3.8 kW</div><div className="text-[12px] opacity-80">Powering your home and charging the battery</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[['System', '5.2 kWp'], ['Saving / yr', '£1,180'], ['Payback', '9.8 yrs'], ['Battery', '84%']].map(([l, v]) => <div key={l} className="rounded-xl bg-white border border-black/5 p-3"><div className="text-[10.5px] text-[#4a5a54]">{l}</div><div className="text-[15px] font-bold" style={{ color: cfg.brandColor }}>{v}</div></div>)}
          </div>
        </div>
        {shown.some((s) => s.id === 'Refer a friend') && <div className="mt-3 rounded-xl p-3 text-[12.5px] text-white" style={{ background: cfg.brandColor }}>Refer a friend: you both get <b>£{cfg.referralReward}</b> when they go solar.</div>}
        <div className="mt-3 text-[11.5px] text-[#4a5a54]">Need help? {cfg.supportPhone} · {cfg.supportEmail}</div>
      </div>
      {phone && <div className="h-14 border-t border-black/5 bg-white/80 flex items-center justify-around">{shown.slice(0, 4).map((s, i) => { const I = ICON[s.id] ?? Home; return <span key={s.id} className="flex flex-col items-center text-[9.5px] font-semibold" style={{ color: i === 0 ? cfg.brandColor : '#5b6f68' }}><I size={17} />{s.label}</span> })}</div>}
    </div>
  )
}
