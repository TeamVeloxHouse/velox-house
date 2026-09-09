import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Card, Button, Chip, Kpi, Progress } from '../components/ui'
import { Field, Input, Textarea, Select } from '../components/overlays'
import { Check, Plus, MapPin, Sun, Bolt, ChevronRight, ChevronDown } from '../components/icons'
import { useState_, useActions, uid } from '../store/store'
import { classNames } from '../lib/format'
import {
  SURVEY_PRODUCTS, sectionsFor, completeness, surveyFlags, compass8, productEmoji, productLabel,
  COVERINGS, CONDITIONS, photoSlotsFor, type SurveyField, type SurveySection,
} from '../lib/survey'
import type { SiteSurvey, SurveyProductKey, RoofFace, SurveyPhoto } from '../store/types'

const statusTone: Record<SiteSurvey['status'], 'neutral' | 'accent' | 'positive'> = { draft: 'neutral', submitted: 'accent', reviewed: 'positive' }
const statusLabel: Record<SiteSurvey['status'], string> = { draft: 'In progress', submitted: 'Submitted', reviewed: 'Reviewed' }
const GRAD = 'linear-gradient(135deg,#3B6BF5 0%,#7C3AED 100%)'

/** Recompute the photo tray to match the products in scope, keeping any already-captured slots. */
function reconcilePhotos(products: SurveyProductKey[], existing: SurveyPhoto[]): SurveyPhoto[] {
  return photoSlotsFor(products).map((slot) => {
    const prev = existing.find((p) => p.section === slot.section && p.key === slot.key)
    return prev ?? { id: uid('ph'), section: slot.section, key: slot.key, label: slot.label, required: slot.required, captured: false }
  })
}

/* ══════════════════════════════════════════════════════════════════════════
 * Office list — every survey + the survey jobs still to do
 * ════════════════════════════════════════════════════════════════════════ */
export function SurveysList() {
  const nav = useNavigate()
  const { surveys, jobs } = useState_()
  const actions = useActions()

  const submitted = surveys.filter((s) => s.status === 'submitted')
  const drafts = surveys.filter((s) => s.status === 'draft')
  // Survey jobs that don't yet have a survey started
  const todo = jobs.filter((j) => j.kind === 'survey' && j.status !== 'complete' && j.status !== 'cancelled' && !surveys.some((s) => s.jobId === j.id))

  function startFromJob(jobId: string) {
    const job = jobs.find((j) => j.id === jobId)
    if (!job) return
    const s = actions.startSurvey({ jobId: job.id, dealId: job.dealId, personId: job.personId, address: job.address, customer: job.customer })
    nav(`/survey/${s.id}`)
  }

  return (
    <>
      <TopBar title="Site surveys" crumbs={['Studio', 'Deliver']} actions={<Button variant="primary" icon={<Plus size={15} />} onClick={() => nav('/jobs')}>Book a survey</Button>} />
      <PageBody>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Kpi label="Surveys captured" value={String(surveys.length)} delta={`${drafts.length} in progress`} deltaTone="muted" />
          <Kpi variant="blue" label="To survey" value={String(todo.length)} delta="Jobs booked" />
          <Kpi label="Submitted" value={String(submitted.length)} delta="Awaiting review" deltaTone="muted" />
          <Kpi variant="deep" label="Reviewed" value={String(surveys.filter((s) => s.status === 'reviewed').length)} delta="Ready for design & DNO" />
        </div>

        {todo.length > 0 && (
          <div>
            <div className="eyebrow text-muted-3 mb-2">Jobs to survey</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {todo.map((j) => (
                <Card key={j.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: GRAD }}><MapPin size={15} /></span>
                    <div className="min-w-0">
                      <div className="font-semibold text-ink text-[14px] truncate">{j.customer}</div>
                      <div className="text-[12px] text-muted-2 truncate">{j.address}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[12px] text-muted-3">{j.ref}{j.date ? ` · ${j.date}` : ' · unscheduled'}</span>
                    <Button variant="primary" className="h-8" onClick={() => startFromJob(j.id)}>Start survey</Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="eyebrow text-muted-3 mb-2">All surveys</div>
          {surveys.length === 0 ? (
            <Card><div className="text-[13px] text-muted-2 py-6 text-center">No surveys yet. Start one from a booked survey job above.</div></Card>
          ) : (
            <div className="flex flex-col gap-2">
              {surveys.map((s) => {
                const c = completeness(s)
                const flags = surveyFlags(s)
                return (
                  <button key={s.id} onClick={() => nav(`/studio/surveys/${s.id}`)} className="text-left">
                    <Card className="hover:border-border-blue transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-ink text-[14px] truncate">{s.customer}</span>
                            <Chip tone={statusTone[s.status]} dot>{statusLabel[s.status]}</Chip>
                          </div>
                          <div className="text-[12px] text-muted-2 truncate">{s.ref} · {s.address} · {s.surveyor}</div>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            {s.products.map((p) => <span key={p} className="text-[12px]" title={productLabel(p)}>{productEmoji(p)}</span>)}
                            {flags.length > 0 && <Chip tone="warning">{flags.length} flag{flags.length > 1 ? 's' : ''}</Chip>}
                          </div>
                        </div>
                        <div className="w-32 shrink-0">
                          <div className="flex items-center justify-between text-[12px] mb-1"><span className="text-muted-3">Complete</span><span className="font-semibold text-ink">{c.pct}%</span></div>
                          <Progress value={c.pct} color={c.pct === 100 ? '#0E7C66' : '#3B6BF5'} />
                        </div>
                        <ChevronRight size={16} className="text-muted-3 shrink-0" />
                      </div>
                    </Card>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </PageBody>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
 * Office read-only report
 * ════════════════════════════════════════════════════════════════════════ */
function AnswerRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-divider last:border-0">
      <span className="text-[12.5px] text-muted-2 shrink-0">{label}</span>
      <span className="text-[13px] text-ink font-medium text-right">{value && value.trim() ? value : <span className="text-muted-3 font-normal">—</span>}</span>
    </div>
  )
}
function fmt(field: SurveyField, raw?: string): string {
  if (raw == null || raw === '') return ''
  if (field.type === 'toggle') return raw === 'true' ? 'Yes' : 'No'
  return field.unit ? `${raw} ${field.unit}` : raw
}

export function SurveyReport() {
  const { id } = useParams()
  const nav = useNavigate()
  const { surveys, projects } = useState_()
  const actions = useActions()
  const s = surveys.find((x) => x.id === id)
  if (!s) return (<><TopBar title="Survey" crumbs={['Studio', 'Deliver']} /><PageBody><Card>Survey not found.</Card></PageBody></>)

  const c = completeness(s)
  const flags = surveyFlags(s)
  const sections = sectionsFor(s.products)
  const project = s.projectId ? projects.find((p) => p.id === s.projectId) : undefined

  return (
    <>
      <TopBar title={`${s.customer} — site survey`} crumbs={['Studio', 'Deliver', s.ref]} actions={
        <div className="flex items-center gap-2">
          <Button onClick={() => nav(`/survey/${s.id}`)}>Open on mobile</Button>
          {project && <Button onClick={() => nav('/studio/dno')} icon={<Bolt size={14} />}>DNO</Button>}
          {s.status === 'submitted' && <Button variant="primary" icon={<Check size={14} />} onClick={() => { actions.reviewSurvey(s.id); actions.toast('Survey marked reviewed') }}>Mark reviewed</Button>}
        </div>
      } />
      <PageBody>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Kpi label="Status" value={statusLabel[s.status]} delta={s.surveyor} deltaTone="muted" />
          <Kpi variant="blue" label="Completeness" value={`${c.pct}%`} delta={`${c.done}/${c.total} required`} />
          <Kpi label="Products" value={String(s.products.length)} delta={s.products.map(productLabel).join(' · ')} deltaTone="muted" />
          <Kpi variant="deep" label="Risk flags" value={String(flags.length)} delta={flags.length ? 'Needs attention' : 'All clear'} />
        </div>

        {flags.length > 0 && (
          <Card className="border-l-4" >
            <div className="eyebrow text-muted-3 mb-2">Risk flags</div>
            <ul className="flex flex-col gap-1.5">
              {flags.map((f, i) => <li key={i} className="flex items-start gap-2 text-[13px] text-ink"><span className="text-[#C2410C] mt-0.5">▲</span>{f}</li>)}
            </ul>
          </Card>
        )}

        {/* Roof faces */}
        {s.products.includes('solar') && (
          <div>
            <div className="eyebrow text-muted-3 mb-2">Roof — {s.roof.length} face{s.roof.length !== 1 ? 's' : ''}</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {s.roof.map((f) => (
                <Card key={f.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2"><Sun size={15} className="text-accent" /><span className="font-semibold text-ink text-[14px]">{f.name}</span></div>
                  <div className="grid grid-cols-2 gap-x-3 text-[12.5px]">
                    <AnswerRow label="Orientation" value={f.orientationDeg != null ? `${compass8(f.orientationDeg)} · ${f.orientationDeg}°` : ''} />
                    <AnswerRow label="Pitch" value={f.pitchDeg != null ? `${f.pitchDeg}°` : ''} />
                    <AnswerRow label="Covering" value={f.covering} />
                    <AnswerRow label="Condition" value={f.condition} />
                    <AnswerRow label="Size" value={f.widthM && f.heightM ? `${f.widthM} × ${f.heightM} m` : ''} />
                    <AnswerRow label="Age" value={f.coveringAge} />
                  </div>
                  {f.obstructions && <div className="text-[12px] text-muted-2">Obstructions: {f.obstructions}</div>}
                </Card>
              ))}
              {s.roof.length === 0 && <Card><div className="text-[13px] text-muted-3">No roof faces captured.</div></Card>}
            </div>
          </div>
        )}

        {/* Sections */}
        <div className="grid lg:grid-cols-2 gap-4">
          {sections.filter((sec) => !sec.roof).map((sec) => (
            <Card key={sec.key} className="flex flex-col">
              <div className="flex items-center gap-2 mb-1.5"><span>{sec.emoji}</span><span className="font-semibold text-ink text-[14px]">{sec.title}</span></div>
              <div className="flex flex-col">
                {sec.fields.map((f) => <AnswerRow key={f.id} label={f.label} value={fmt(f, s.answers[f.id])} />)}
              </div>
              {sec.photos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {sec.photos.map((slot) => {
                    const ph = s.photos.find((p) => p.section === sec.key && p.key === slot.key)
                    const has = ph?.captured
                    return <Chip key={slot.key} tone={has ? 'positive' : slot.required ? 'warning' : 'neutral'}>{has ? '📷 ' : '○ '}{slot.label}</Chip>
                  })}
                </div>
              )}
            </Card>
          ))}
        </div>

        {s.surveyorNote && <Card><div className="eyebrow text-muted-3 mb-1">Surveyor note</div><div className="text-[13px] text-ink">{s.surveyorNote}</div></Card>}
      </PageBody>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
 * Mobile capture wizard (full-screen, outside the CRM shell)
 * ════════════════════════════════════════════════════════════════════════ */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={classNames('w-12 h-7 rounded-full p-0.5 transition-colors shrink-0', on ? 'bg-[#7C3AED]' : 'bg-[#D4D9E2]')}>
      <span className={classNames('block w-6 h-6 rounded-full bg-white shadow transition-transform', on && 'translate-x-5')} />
    </button>
  )
}

function FieldControl({ field, value, onChange }: { field: SurveyField; value: string; onChange: (v: string) => void }) {
  if (field.type === 'toggle') {
    return (
      <div className="flex items-center justify-between gap-3 py-1">
        <div><div className="text-[14px] font-medium text-ink">{field.label}</div>{field.hint && <div className="text-[12px] text-muted-2">{field.hint}</div>}</div>
        <Toggle on={value === 'true'} onChange={(v) => onChange(String(v))} />
      </div>
    )
  }
  return (
    <Field label={field.required ? `${field.label} *` : field.label}>
      {field.type === 'select' ? (
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {field.options!.map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      ) : field.type === 'textarea' ? (
        <Textarea value={value} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} rows={3} />
      ) : (
        <div className="relative">
          <Input type={field.type === 'number' ? 'number' : 'text'} inputMode={field.type === 'number' ? 'decimal' : undefined} value={value} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
          {field.unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-3">{field.unit}</span>}
        </div>
      )}
      {field.hint && <div className="text-[12px] text-muted-2 mt-1">{field.hint}</div>}
    </Field>
  )
}

function PhotoTray({ survey, sectionKey, onToggle }: { survey: SiteSurvey; sectionKey: string; onToggle: (photoId: string) => void }) {
  const shots = survey.photos.filter((p) => p.section === sectionKey)
  if (shots.length === 0) return null
  return (
    <div className="mt-4">
      <div className="eyebrow text-muted-3 mb-2">Photos</div>
      <div className="grid grid-cols-2 gap-2">
        {shots.map((p) => (
          <button key={p.id} onClick={() => onToggle(p.id)} className={classNames('rounded-card border-2 border-dashed p-3 flex flex-col items-center justify-center gap-1 h-24 transition-colors', p.captured ? 'border-[#0E7C66] bg-[#E9F5F1]' : p.required ? 'border-[#E7A977] bg-[#FDF6EF]' : 'border-border bg-control')}>
            <span className="text-2xl">{p.captured ? '📷' : '＋'}</span>
            <span className={classNames('text-[11.5px] text-center leading-tight font-medium', p.captured ? 'text-[#0E7C66]' : 'text-muted-2')}>{p.label}{p.required && !p.captured ? ' *' : ''}</span>
          </button>
        ))}
      </div>
      <div className="text-[11px] text-muted-3 mt-1.5">Tap to simulate capturing a photo. * required</div>
    </div>
  )
}

function RoofStep({ survey, onChange }: { survey: SiteSurvey; onChange: (roof: RoofFace[]) => void }) {
  const [open, setOpen] = useState<string | null>(survey.roof[0]?.id ?? null)
  function add() {
    const face: RoofFace = { id: uid('rf'), name: survey.roof.length === 0 ? 'Rear (main)' : `Face ${survey.roof.length + 1}` }
    onChange([...survey.roof, face]); setOpen(face.id)
  }
  const patch = (fid: string, p: Partial<RoofFace>) => onChange(survey.roof.map((f) => (f.id === fid ? { ...f, ...p } : f)))
  const remove = (fid: string) => onChange(survey.roof.filter((f) => f.id !== fid))
  const num = (v: string): number | undefined => (v === '' ? undefined : Number(v))

  return (
    <div className="flex flex-col gap-2">
      {survey.roof.map((f) => {
        const isOpen = open === f.id
        return (
          <div key={f.id} className="rounded-card border border-border bg-surface overflow-hidden">
            <button onClick={() => setOpen(isOpen ? null : f.id)} className="w-full flex items-center gap-2 px-3.5 py-3 text-left">
              <Sun size={16} className="text-accent shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink text-[14px] truncate">{f.name || 'Roof face'}</div>
                <div className="text-[12px] text-muted-2">{f.orientationDeg != null ? `${compass8(f.orientationDeg)} · ${f.orientationDeg}°` : 'no orientation'}{f.pitchDeg != null ? ` · ${f.pitchDeg}° pitch` : ''}</div>
              </div>
              <ChevronDown size={16} className={classNames('text-muted-3 transition-transform', isOpen && 'rotate-180')} />
            </button>
            {isOpen && (
              <div className="px-3.5 pb-4 flex flex-col gap-3 border-t border-divider pt-3">
                <Field label="Name"><Input value={f.name} onChange={(e) => patch(f.id, { name: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Orientation (° from N) *"><Input type="number" inputMode="decimal" value={f.orientationDeg ?? ''} onChange={(e) => patch(f.id, { orientationDeg: num(e.target.value) })} placeholder="180 = S" /></Field>
                  <Field label="Pitch (°) *"><Input type="number" inputMode="decimal" value={f.pitchDeg ?? ''} onChange={(e) => patch(f.id, { pitchDeg: num(e.target.value) })} /></Field>
                  <Field label="Width (m)"><Input type="number" inputMode="decimal" value={f.widthM ?? ''} onChange={(e) => patch(f.id, { widthM: num(e.target.value) })} /></Field>
                  <Field label="Height (m)"><Input type="number" inputMode="decimal" value={f.heightM ?? ''} onChange={(e) => patch(f.id, { heightM: num(e.target.value) })} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Covering"><Select value={f.covering ?? ''} onChange={(e) => patch(f.id, { covering: e.target.value })}><option value="">Select…</option>{COVERINGS.map((o) => <option key={o}>{o}</option>)}</Select></Field>
                  <Field label="Condition"><Select value={f.condition ?? ''} onChange={(e) => patch(f.id, { condition: e.target.value })}><option value="">Select…</option>{CONDITIONS.map((o) => <option key={o}>{o}</option>)}</Select></Field>
                </div>
                <Field label="Covering age"><Input value={f.coveringAge ?? ''} onChange={(e) => patch(f.id, { coveringAge: e.target.value })} placeholder="e.g. ~40 yrs" /></Field>
                <Field label="Obstructions"><Textarea rows={2} value={f.obstructions ?? ''} onChange={(e) => patch(f.id, { obstructions: e.target.value })} placeholder="Chimney, rooflight, vent, dormer…" /></Field>
                <button onClick={() => remove(f.id)} className="text-[13px] text-[#B01B4F] font-medium self-start">Remove this face</button>
              </div>
            )}
          </div>
        )
      })}
      <button onClick={add} className="rounded-card border-2 border-dashed border-border py-3 text-[14px] font-semibold text-accent flex items-center justify-center gap-2"><Plus size={16} />Add roof face</button>
    </div>
  )
}

export function SurveyCapture() {
  const { id } = useParams()
  const nav = useNavigate()
  const { surveys } = useState_()
  const actions = useActions()
  const s = surveys.find((x) => x.id === id)
  const [step, setStep] = useState(0)

  if (!s) return <div className="min-h-screen flex items-center justify-center text-muted-2">Survey not found.</div>

  // steps: products → each in-scope section → review
  const sections = sectionsFor(s.products)
  const steps: ({ kind: 'products' } | { kind: 'section'; section: SurveySection } | { kind: 'review' })[] = [
    { kind: 'products' },
    ...sections.map((section) => ({ kind: 'section' as const, section })),
    { kind: 'review' as const },
  ]
  const current = steps[Math.min(step, steps.length - 1)]
  const c = completeness(s)

  const setAnswer = (fid: string, v: string) => actions.saveSurvey(s.id, { answers: { ...s.answers, [fid]: v } })
  const toggleProduct = (k: SurveyProductKey) => {
    const products = s.products.includes(k) ? s.products.filter((p) => p !== k) : [...s.products, k]
    if (products.length === 0) return
    actions.saveSurvey(s.id, { products, photos: reconcilePhotos(products, s.photos) })
  }

  const submit = () => {
    actions.submitSurvey(s.id)
    nav(`/studio/surveys/${s.id}`)
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col" style={{ background: '#F4F6FA' }}>
      {/* Header + progress */}
      <div className="text-white px-4 pt-4 pb-3 sticky top-0 z-10" style={{ background: GRAD }}>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[12px] opacity-80">{s.ref} · {s.customer}</div>
            <div className="font-bold text-[15px] truncate">{s.address}</div>
          </div>
          <button onClick={() => nav('/studio/surveys')} className="text-[12px] font-semibold bg-white/20 rounded-lg px-2.5 py-1.5 shrink-0">Save & exit</button>
        </div>
        <div className="flex gap-1 mt-3">
          {steps.map((_, i) => <span key={i} className={classNames('h-1.5 rounded-full flex-1 transition-colors', i <= step ? 'bg-white' : 'bg-white/30')} />)}
        </div>
        <div className="text-[11.5px] opacity-90 mt-1.5">Step {step + 1} of {steps.length}</div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 pb-28 max-w-lg mx-auto w-full">
        {current.kind === 'products' && (
          <div>
            <h2 className="text-[19px] font-bold text-ink mb-1">What are we surveying?</h2>
            <p className="text-[13px] text-muted-2 mb-4">Pick every product in scope — the survey adapts to what you choose.</p>
            <div className="flex flex-col gap-2">
              {SURVEY_PRODUCTS.map((p) => {
                const on = s.products.includes(p.key)
                return (
                  <button key={p.key} onClick={() => toggleProduct(p.key)} className={classNames('flex items-center gap-3 rounded-card border-2 p-3.5 text-left transition-colors', on ? 'border-[#7C3AED] bg-[#F5F0FE]' : 'border-border bg-surface')}>
                    <span className="text-2xl">{p.emoji}</span>
                    <span className="flex-1 font-semibold text-ink text-[15px]">{p.label}</span>
                    <span className={classNames('w-6 h-6 rounded-full flex items-center justify-center', on ? 'bg-[#7C3AED] text-white' : 'border-2 border-border')}>{on && <Check size={14} />}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {current.kind === 'section' && (
          <div>
            <h2 className="text-[19px] font-bold text-ink mb-1 flex items-center gap-2"><span>{current.section.emoji}</span>{current.section.title}</h2>
            <p className="text-[13px] text-muted-2 mb-4">{current.section.blurb}</p>
            {current.section.roof ? (
              <RoofStep survey={s} onChange={(roof) => actions.saveSurvey(s.id, { roof })} />
            ) : (
              <div className="flex flex-col gap-3.5">
                {current.section.fields.map((f) => <FieldControl key={f.id} field={f} value={s.answers[f.id] ?? ''} onChange={(v) => setAnswer(f.id, v)} />)}
                <PhotoTray survey={s} sectionKey={current.section.key} onToggle={(pid) => actions.toggleSurveyPhoto(s.id, pid)} />
              </div>
            )}
          </div>
        )}

        {current.kind === 'review' && (
          <div>
            <h2 className="text-[19px] font-bold text-ink mb-1">Review & submit</h2>
            <p className="text-[13px] text-muted-2 mb-4">Everything required must be filled before this survey can be submitted.</p>
            <Card className="mb-3">
              <div className="flex items-center justify-between mb-1.5"><span className="text-[13px] font-semibold text-ink">Completeness</span><span className="font-bold text-ink">{c.pct}%</span></div>
              <Progress value={c.pct} color={c.pct === 100 ? '#0E7C66' : '#3B6BF5'} height={10} />
              <div className="text-[12px] text-muted-2 mt-1.5">{c.done} of {c.total} required items done</div>
            </Card>
            {c.missing.length > 0 ? (
              <Card>
                <div className="eyebrow text-muted-3 mb-2">Still needed ({c.missing.length})</div>
                <ul className="flex flex-col gap-1.5">{c.missing.map((m, i) => <li key={i} className="flex items-start gap-2 text-[13px] text-ink"><span className="text-[#C2410C] mt-0.5">○</span>{m}</li>)}</ul>
              </Card>
            ) : (
              <Card><div className="flex items-center gap-2 text-[14px] font-semibold text-[#0E7C66]"><Check size={18} />All required items captured — ready to submit.</div></Card>
            )}
            <div className="mt-3">
              <Field label="Surveyor note (optional)"><Textarea rows={3} value={s.surveyorNote ?? ''} onChange={(e) => actions.saveSurvey(s.id, { surveyorNote: e.target.value })} placeholder="Anything the office / install crew should know…" /></Field>
            </div>
          </div>
        )}
      </div>

      {/* Sticky footer nav */}
      <div className="fixed bottom-0 inset-x-0 bg-surface border-t border-border px-4 py-3 flex items-center gap-3 max-w-lg mx-auto">
        <Button className="flex-1 justify-center h-11" onClick={() => (step === 0 ? nav('/studio/surveys') : setStep(step - 1))}>{step === 0 ? 'Exit' : 'Back'}</Button>
        {current.kind === 'review' ? (
          <Button variant="primary" className="flex-1 justify-center h-11 disabled:opacity-50" onClick={() => c.missing.length === 0 && submit()}>{c.missing.length === 0 ? 'Submit survey' : `${c.missing.length} left`}</Button>
        ) : (
          <Button variant="primary" className="flex-1 justify-center h-11" onClick={() => setStep(step + 1)}>Next</Button>
        )}
      </div>
    </div>
  )
}
