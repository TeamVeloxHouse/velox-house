import { useState, useRef } from 'react'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button, Chip } from '../components/ui'
import { Textarea } from '../components/overlays'
import { File as FileIcon, Sparkle, Plus, Download, Layers, Robot } from '../components/icons'
import { useState_, useActions } from '../store/store'
import type { DocKind, DocFormat, DocTemplate, BrandDoc } from '../store/types'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const FONTS = ['Inter', 'Poppins', 'Roboto', 'Montserrat', 'Georgia', 'System UI']
const kindLabel: Record<DocKind, string> = { deck: 'Pitch deck', proposal: 'Proposal', onepager: 'One-pager', 'case-study': 'Case study', letter: 'Letter' }
const kindIcon: Record<DocKind, any> = { deck: Layers, proposal: FileIcon, onepager: FileIcon, 'case-study': FileIcon, letter: FileIcon }

export function BrandDocuments() {
  const { brandKit, docTemplates, brandDocs, playbooks } = useState_()
  const act = useActions()
  const guide = playbooks.find((p) => p.scope === 'proposal' && p.active)
  const [busy, setBusy] = useState<{ title: string; stage: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function generate(opts: { title: string; kind: DocKind; format: DocFormat; source: 'template' | 'upload'; sourceName?: string }) {
    const stages = [
      'Reading your brand kit…',
      guide ? `Applying your “${guide.title}” playbook…` : 'Applying your tone of voice…',
      `Laying out in ${brandKit.company}’s colours & logo…`,
      opts.kind === 'deck' ? 'Building slides…' : 'Formatting pages…',
    ]
    for (const s of stages) { setBusy({ title: opts.title, stage: s }); await sleep(520) }
    setBusy(null)
    act.addBrandDoc({ title: opts.title, kind: opts.kind, format: opts.format, source: opts.source, sourceName: opts.sourceName })
  }

  function onTemplate(t: DocTemplate) {
    generate({ title: `${brandKit.company} — ${t.name}`, kind: t.kind, format: t.format, source: 'template' })
  }
  function onUpload(name: string) {
    const ext = name.split('.').pop()?.toLowerCase()
    const kind: DocKind = ext === 'ppt' || ext === 'pptx' ? 'deck' : 'proposal'
    const format: DocFormat = kind === 'deck' ? 'pptx' : 'pdf'
    generate({ title: `${name.replace(/\.[^.]+$/, '')} — branded`, kind, format, source: 'upload', sourceName: name })
  }

  return (
    <>
      <TopBar
        title="Brand & Documents"
        crumbs={['Studio', 'Collateral']}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => fileRef.current?.click()}>Upload to re-brand</Button>}
      />
      <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f.name); e.currentTarget.value = '' }} />
      <PageBody>
        {busy && (
          <div className="rounded-card p-4 flex items-center gap-3 text-white" style={{ background: 'linear-gradient(150deg,#1c3a72,#0c1b38)' }}>
            <span className="w-6 h-6 rounded-full border-2 border-white/70 border-t-transparent animate-spin shrink-0" />
            <div className="flex-1"><div className="text-[13px] font-semibold">{busy.title}</div><div className="text-[12px]" style={{ color: '#8FB0FF' }}>{busy.stage}</div></div>
          </div>
        )}

        <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '1fr 1.35fr' }}>
          {/* ── Brand kit ── */}
          <div className="bg-surface border border-border rounded-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[15px] font-semibold text-ink">Brand kit</div>
              <span className="text-[11.5px] text-muted-2">Applied to everything you generate</span>
            </div>
            <button onClick={() => fileRef.current?.click()} className="w-full rounded-xl border border-dashed border-input-border px-4 py-4 flex items-center gap-3 hover:bg-control text-left mb-4">
              <span className="w-11 h-11 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: brandKit.primary }}>{brandKit.company.slice(0, 1)}</span>
              <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate">{brandKit.logoName ?? 'Upload a logo'}</div><div className="text-[12px] text-muted-2">SVG or PNG — shown on every document</div></div>
            </button>

            <Label>Company name</Label>
            <input value={brandKit.company} onChange={(e) => act.updateBrandKit({ company: e.target.value })} className="h-9 w-full px-3 mb-3 rounded-control border border-input-border bg-white text-[13px] text-ink-2 outline-none focus:border-accent" />

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><Label>Primary</Label><ColorRow value={brandKit.primary} onChange={(v) => act.updateBrandKit({ primary: v })} /></div>
              <div><Label>Accent</Label><ColorRow value={brandKit.accent} onChange={(v) => act.updateBrandKit({ accent: v })} /></div>
            </div>

            <Label>Font</Label>
            <select value={brandKit.font} onChange={(e) => act.updateBrandKit({ font: e.target.value })} className="h-9 w-full px-2.5 mb-3 rounded-control border border-input-border bg-white text-[13px] text-ink-2 outline-none focus:border-accent">
              {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>

            <Label>Tone of voice</Label>
            <Textarea value={brandKit.tone} onChange={(e) => act.updateBrandKit({ tone: e.target.value })} rows={3} />
            <div className="text-[11.5px] text-muted-2 mt-2">Colours, logo, font and tone drive every generated document — change them here and all new docs follow.</div>
          </div>

          {/* ── Templates + generated ── */}
          <div className="flex flex-col gap-4">
            <div className="bg-surface border border-border rounded-card p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[15px] font-semibold text-ink">Templates</div>
                {guide && <span className="inline-flex items-center gap-1.5 text-[11.5px] text-accent font-medium"><Robot size={13} /> Styled with “{guide.title}”</span>}
              </div>
              <div className="text-[12.5px] text-muted-b mb-3">Pick one — it comes out in your brand, ready to send.</div>
              <div className="grid grid-cols-2 gap-2.5">
                {docTemplates.map((t) => {
                  const Icon = kindIcon[t.kind]
                  return (
                    <button key={t.id} onClick={() => onTemplate(t)} disabled={!!busy} className="text-left rounded-xl border border-border p-3.5 hover:border-border-blue hover:bg-surface-tint transition-colors disabled:opacity-50">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#FDF2E2', color: '#A85B00' }}><Icon size={15} /></span>
                        <div className="text-[13px] font-semibold text-ink-2">{t.name}</div>
                        <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-muted-3">{t.format}</span>
                      </div>
                      <div className="text-[12px] text-muted-2 mt-1.5 leading-snug">{t.desc}</div>
                    </button>
                  )
                })}
                <button onClick={() => fileRef.current?.click()} disabled={!!busy} className="text-left rounded-xl border border-dashed border-input-border p-3.5 hover:bg-control transition-colors disabled:opacity-50 flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-control flex items-center justify-center text-ink-3 shrink-0"><Plus size={16} /></span>
                  <div><div className="text-[13px] font-semibold text-ink-2">Upload &amp; re-brand</div><div className="text-[12px] text-muted-2">Any PDF, Word or deck</div></div>
                </button>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[15px] font-semibold text-ink">Generated documents</div>
                <span className="text-[12px] text-muted-2">{brandDocs.length} document{brandDocs.length === 1 ? '' : 's'}</span>
              </div>
              {brandDocs.length === 0 ? (
                <div className="text-[13px] text-muted-2 py-6 text-center">Nothing yet — pick a template or upload a document to generate branded collateral.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {brandDocs.map((d) => <DocRow key={d.id} d={d} primary={brandKit.primary} onDownload={() => act.toast('Download (demo) — real .pptx / .docx / PDF generates via the Claude API skills backend', 'accent')} onRemove={() => act.removeBrandDoc(d.id)} />)}
                </div>
              )}
            </div>

            <div className="rounded-card bg-accent-wash-3 border border-[#D3E0FA] p-4 text-[12.5px] text-accent-700 leading-relaxed flex items-start gap-2">
              <Sparkle size={15} className="shrink-0 mt-0.5" />
              <span>Generation is simulated in-app today. Real editable <b>.pptx / .docx / PDF</b> files wire to the Claude API (Agent Skills in a code-execution sandbox) — the same backend step as making the operator live.</span>
            </div>
          </div>
        </div>
      </PageBody>
    </>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide mb-1">{children}</div>
}
function ColorRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 h-9 px-2 rounded-control border border-input-border bg-white">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0" />
      <input value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 min-w-0 text-[12.5px] text-ink-2 font-mono outline-none bg-transparent" />
    </div>
  )
}
function DocRow({ d, primary, onDownload, onRemove }: { d: BrandDoc; primary: string; onDownload: () => void; onRemove: () => void }) {
  const Icon = kindIcon[d.kind]
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border px-3.5 py-2.5">
      <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: primary }}><Icon size={16} /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-ink-2 truncate">{d.title}</div>
        <div className="text-[12px] text-muted-2">{kindLabel[d.kind]} · {d.format.toUpperCase()}{d.source === 'upload' ? ` · from ${d.sourceName}` : ''}</div>
      </div>
      <Chip tone="positive" dot>Branded</Chip>
      <button onClick={onDownload} className="text-[12px] text-accent font-semibold hover:underline inline-flex items-center gap-1"><Download size={13} /> Download</button>
      <button onClick={onRemove} className="text-[12px] text-negative font-medium hover:underline">Remove</button>
    </div>
  )
}
