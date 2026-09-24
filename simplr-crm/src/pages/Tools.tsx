import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Sun, Bolt, Layers, Radar, Person, Building, Wrench, Sparkle, MapPin, Flow, Clock, ChevronRight, Bell, Check } from '../components/icons'
import { useActions, useState_ } from '../store/store'
import { money } from '../lib/format'
import { ProspectDatabase, ProspectDetail } from './CommercialSolar'

type Icon = (p: { size?: number; className?: string }) => JSX.Element
type ToolDef = {
  id: string; name: string; tagline: string; desc: string; icon: Icon; to?: string; live: boolean
  accent: string; wash: string; features: { icon: Icon; label: string }[]; eta?: string
  preview: (accent: string) => JSX.Element
}

const TOOLS: ToolDef[] = [
  {
    id: 'company-search', name: 'Company & People Search', tagline: 'Company-first prospecting',
    desc: 'Find companies by industry and place — or one by name — then reveal the decision-makers. Measure a roof any time.',
    icon: Building, to: '/tools/company-search', live: true, accent: '#13927B', wash: '#E6F6F1',
    features: [{ icon: Sparkle, label: 'Ovi chat' }, { icon: Person, label: 'Decision-makers' }, { icon: MapPin, label: 'Map' }],
    preview: (a) => <PreviewList accent={a} />,
  },
  {
    id: 'commercial-solar', name: 'Commercial Solar Finder', tagline: 'Roof-first prospecting',
    desc: 'Scan an area, measure every roof from satellite, score the hottest solar prospects and find the people.',
    icon: Sun, to: '/tools/commercial-solar', live: true, accent: '#D97706', wash: '#FDF3E3',
    features: [{ icon: Radar, label: 'Area scan' }, { icon: Sun, label: 'Live roof data' }, { icon: Flow, label: 'Pipeline' }],
    preview: (a) => <PreviewRoof accent={a} />,
  },
  {
    id: 'ev-charging', name: 'EV Charging Calculator', tagline: 'Fleet & workplace',
    desc: 'Size fleet and workplace charging, check the site’s load headroom and model the payback.',
    icon: Bolt, to: '/studio/ev', live: true, accent: '#4F46E5', wash: '#EEEFFD',
    features: [{ icon: Bolt, label: 'Load check' }, { icon: Layers, label: 'Charger mix' }, { icon: Clock, label: 'Payback' }],
    preview: (a) => <PreviewBars accent={a} />,
  },
  {
    id: 'domestic-solar', name: 'Domestic Solar Calculator', tagline: 'Homeowner savings', eta: 'Q4',
    desc: 'Homeowner roof and savings calculator with finance and self-consumption modelling.',
    icon: Sun, live: false, accent: '#EA7A2A', wash: '#FDF0E6',
    features: [{ icon: Sun, label: 'Roof model' }, { icon: Layers, label: 'Finance' }],
    preview: (a) => <PreviewHouse accent={a} />,
  },
  {
    id: 'battery-storage', name: 'Battery Storage Sizer', tagline: 'Peak-shaving & backup', eta: 'Q4',
    desc: 'Size storage against a real load profile for peak-shaving, tariff arbitrage and backup.',
    icon: Layers, live: false, accent: '#0284C7', wash: '#E6F3FA',
    features: [{ icon: Flow, label: 'Load profile' }, { icon: Bolt, label: 'Tariffs' }],
    preview: (a) => <PreviewBattery accent={a} />,
  },
  {
    id: 'heat-pump', name: 'Heat Pump Estimator', tagline: 'Heat-loss led sizing', eta: 'Q1',
    desc: 'Room-by-room heat-loss sizing and a running-cost comparison against gas.',
    icon: Wrench, live: false, accent: '#DC4B4B', wash: '#FCECEC',
    features: [{ icon: Wrench, label: 'Heat loss' }, { icon: Layers, label: 'vs gas' }],
    preview: (a) => <PreviewCurve accent={a} />,
  },
]

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export function ToolsHub() {
  const nav = useNavigate()
  const act = useActions()
  const { solarProspects, solarCampaigns } = useState_()
  const [notified, setNotified] = useState<string[]>([])

  const forTool = (id: string) => solarProspects.filter((p) => (p.tool ?? 'commercial-solar') === id)
  const peopleOf = (ps: typeof solarProspects) => ps.reduce((s, p) => s + (p.contactsRevealed ? p.contacts.length : 0), 0)
  const lastRun = (id: string) => solarCampaigns.filter((c) => (c.tool ?? 'commercial-solar') === id).sort((a, b) => b.createdAt - a.createdAt)[0]

  const totalPeople = peopleOf(solarProspects)
  const measured = solarProspects.filter((p) => !p.roofPending).length
  const saving = solarProspects.reduce((s, p) => s + (p.roofPending ? 0 : p.year1Saving || 0), 0)
  const recent = [...solarCampaigns].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4)

  return (
    <>
      <TopBar title="Tools" crumbs={['Find']}
        actions={<button onClick={() => nav('/tools/database')} className="h-9 px-3.5 rounded-control bg-surface border border-border text-[13px] font-semibold text-ink-3 hover:bg-control flex items-center gap-2"><Layers size={15} />All prospects</button>} />
      <PageBody>
        {/* hero: live totals + recent searches */}
        <div className="grid grid-cols-[1.35fr_1fr] gap-4">
          <div className="rounded-card bg-deep-panel p-6 relative overflow-hidden">
            <svg className="absolute -right-10 -top-10 opacity-[0.12]" width="260" height="260" viewBox="0 0 260 260" fill="none">
              {[40, 75, 110].map((r) => <circle key={r} cx="130" cy="130" r={r} stroke="#62E4CC" strokeWidth="1.5" />)}
              <path d="M130 130 L230 70" stroke="#62E4CC" strokeWidth="2" />
            </svg>
            <div className="flex items-center gap-2 text-mint text-[11px] font-semibold uppercase tracking-[0.1em]"><Radar size={14} />Find · Prospecting tools</div>
            <div className="text-[22px] font-bold text-white tracking-[-0.02em] mt-2 max-w-[460px] leading-tight">Every tool feeds one prospects pipeline.</div>
            <div className="text-[13px] text-white/60 mt-1.5 max-w-[480px]">Each finds and qualifies leads its own way — with its own chat, results and database — and hands them on to Engage.</div>
            <div className="grid grid-cols-4 gap-2.5 mt-5">
              {[
                { l: 'Prospects', v: String(solarProspects.length) },
                { l: 'People found', v: String(totalPeople) },
                { l: 'Roofs measured', v: String(measured) },
                { l: 'Saving found', v: money(saving, { compact: true }) },
              ].map((s) => (
                <div key={s.l} className="rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 py-2.5">
                  <div className="text-[19px] font-bold text-white leading-none">{s.v}</div>
                  <div className="text-[11px] text-white/55 mt-1.5">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-card bg-surface border border-border shadow-card p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[13.5px] font-bold text-ink">Recent searches</div>
              <button onClick={() => nav('/tools/database')} className="text-[12px] font-semibold text-accent hover:underline">View all</button>
            </div>
            {recent.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-4">
                <span className="w-10 h-10 rounded-xl bg-accent-wash text-accent flex items-center justify-center"><Sparkle size={18} /></span>
                <div className="text-[12.5px] text-muted-b max-w-[240px]">No searches yet. Open a tool and tell Ovi who you want to reach.</div>
              </div>
            ) : (
              <div className="flex flex-col">
                {recent.map((c) => {
                  const t = TOOLS.find((x) => x.id === (c.tool ?? 'commercial-solar')) ?? TOOLS[1]
                  const n = solarProspects.filter((p) => p.campaignId === c.id).length
                  return (
                    <button key={c.id} onClick={() => t.to && nav(t.to)} className="flex items-center gap-3 py-2.5 border-b border-divider-row last:border-0 text-left hover:bg-surface-tint -mx-2 px-2 rounded-lg transition-colors">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: t.wash, color: t.accent }}><t.icon size={15} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-ink-2 truncate">{c.name}</span>
                        <span className="block text-[11.5px] text-muted-2 truncate">{t.name} · {ago(c.createdAt)}</span>
                      </span>
                      <span className="text-[12px] font-semibold text-ink-3 shrink-0">{c.status === 'scanning' ? <span className="text-accent">Running…</span> : `${n} found`}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-end justify-between mt-1">
          <div>
            <div className="text-[16px] font-bold text-ink">Tools</div>
            <div className="text-[12.5px] text-muted-b">{TOOLS.filter((t) => t.live).length} live · {TOOLS.filter((t) => !t.live).length} on the roadmap</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {TOOLS.map((t) => {
            const ps = forTool(t.id)
            const run = lastRun(t.id)
            const on = notified.includes(t.id)
            return (
              <div
                key={t.id}
                onClick={() => t.live && t.to && nav(t.to)}
                className={`group rounded-card bg-surface border border-border shadow-card overflow-hidden flex flex-col transition-all duration-200 ${t.live ? 'cursor-pointer hover:shadow-lift hover:-translate-y-0.5 hover:border-input-border' : ''}`}
              >
                {/* visual preview */}
                <div className="relative h-[128px] overflow-hidden" style={{ background: `linear-gradient(150deg, ${t.wash} 0%, #FFFFFF 95%)` }}>
                  <div className={`absolute inset-0 flex items-center justify-center transition-transform duration-300 ${t.live ? 'group-hover:scale-[1.04]' : 'grayscale-[0.6] opacity-70'}`}>{t.preview(t.accent)}</div>
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white shadow-card" style={{ background: t.accent }}><t.icon size={18} /></span>
                  </div>
                  <div className="absolute top-3 right-3">
                    {t.live ? (
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold bg-white/90 backdrop-blur rounded-full px-2.5 py-1 border border-white text-positive shadow-card"><span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />Live</span>
                    ) : (
                      <span className="text-[11px] font-semibold bg-white/90 backdrop-blur rounded-full px-2.5 py-1 border border-white text-muted-b shadow-card">Coming {t.eta}</span>
                    )}
                  </div>
                </div>

                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div>
                    <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: t.accent }}>{t.tagline}</div>
                    <div className="text-[15.5px] font-bold text-ink mt-0.5">{t.name}</div>
                    <div className="text-[12.5px] text-muted-b mt-1 leading-snug">{t.desc}</div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {t.features.map((f) => (
                      <span key={f.label} className="flex items-center gap-1 text-[11px] font-medium text-ink-3 bg-control rounded-md px-2 py-1"><f.icon size={11} />{f.label}</span>
                    ))}
                  </div>

                  {t.live ? (
                    <>
                      {t.id !== 'ev-charging' && (
                        <div className="grid grid-cols-3 rounded-lg border border-divider divide-x divide-divider">
                          {[
                            { l: 'Prospects', v: ps.length },
                            { l: 'People', v: peopleOf(ps) },
                            { l: 'Roofs', v: ps.filter((p) => !p.roofPending).length },
                          ].map((s) => (
                            <div key={s.l} className="px-2.5 py-2">
                              <div className="text-[15px] font-bold text-ink leading-none">{s.v}</div>
                              <div className="text-[10.5px] text-muted-2 mt-1">{s.l}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-auto flex items-center justify-between pt-1">
                        <span className="text-[11.5px] text-muted-2 flex items-center gap-1.5"><Clock size={12} />{run ? `Last run ${ago(run.createdAt)}` : t.id === 'ev-charging' ? 'Calculator' : 'Not run yet'}</span>
                        <span className="text-[12.5px] font-semibold flex items-center gap-1 transition-transform group-hover:translate-x-0.5" style={{ color: t.accent }}>Open<ChevronRight size={14} /></span>
                      </div>
                    </>
                  ) : (
                    <div className="mt-auto flex items-center justify-between pt-1">
                      <span className="text-[11.5px] text-muted-2">On the roadmap</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (on) return; setNotified((n) => [...n, t.id]); act.toast(`We'll let you know when ${t.name} is live`) }}
                        className={`h-8 px-3 rounded-control border text-[12px] font-semibold flex items-center gap-1.5 transition-colors ${on ? 'border-positive-border bg-positive-wash text-positive' : 'border-border bg-surface text-ink-3 hover:bg-control'}`}
                      >
                        {on ? <><Check size={13} />You're on the list</> : <><Bell size={13} />Notify me</>}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </PageBody>
    </>
  )
}

/* ─────────── Card preview illustrations (pure SVG, tinted per tool) ─────────── */

function PreviewList({ accent }: { accent: string }) {
  return (
    <svg width="230" height="100" viewBox="0 0 230 100" fill="none" className="mt-6">
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${i * 6} ${i * 30})`} opacity={1 - i * 0.22}>
          <rect width="210" height="26" rx="7" fill="#fff" stroke="#E4E8EE" />
          <rect x="7" y="6" width="14" height="14" rx="4" fill={accent} opacity="0.85" />
          <rect x="28" y="8" width={70 - i * 12} height="4" rx="2" fill="#1B2534" opacity="0.7" />
          <rect x="28" y="15" width={48 - i * 6} height="3" rx="1.5" fill="#98A1B0" />
          {[0, 1, 2].map((j) => <circle key={j} cx={150 + j * 9} cy="13" r="5.5" fill={['#EAF6F2', '#EEF2FF', '#FDF1E7'][j]} stroke="#fff" strokeWidth="1.5" />)}
          <circle cx="193" cy="13" r="6.5" fill="none" stroke={accent} strokeWidth="2.2" strokeDasharray={`${30 - i * 7} 41`} transform="rotate(-90 193 13)" />
        </g>
      ))}
    </svg>
  )
}

function PreviewRoof({ accent }: { accent: string }) {
  return (
    <svg width="220" height="110" viewBox="0 0 220 110" fill="none" className="mt-5">
      <path d="M30 95 L60 25 L200 25 L185 95 Z" fill="#fff" stroke="#E4E8EE" strokeWidth="1.5" />
      {Array.from({ length: 4 }).map((_, r) =>
        Array.from({ length: 7 }).map((__, c) => (
          <rect key={`${r}-${c}`} x={62 + c * 18 - r * 6} y={32 + r * 15} width="15" height="12" rx="1.5" fill={accent} opacity={0.35 + ((r + c) % 3) * 0.2} />
        )),
      )}
      <circle cx="196" cy="18" r="9" fill={accent} opacity="0.25" />
      <circle cx="196" cy="18" r="5" fill={accent} />
    </svg>
  )
}

function PreviewBars({ accent }: { accent: string }) {
  const h = [30, 46, 38, 62, 54, 74, 66]
  return (
    <svg width="210" height="100" viewBox="0 0 210 100" fill="none" className="mt-6">
      <line x1="10" y1="92" x2="200" y2="92" stroke="#E4E8EE" />
      {h.map((v, i) => <rect key={i} x={24 + i * 25} y={92 - v} width="15" height={v} rx="3" fill={accent} opacity={0.3 + i * 0.1} />)}
      <path d="M20 58 C 60 50, 100 40, 190 20" stroke={accent} strokeWidth="2" strokeDasharray="4 4" />
    </svg>
  )
}

function PreviewHouse({ accent }: { accent: string }) {
  return (
    <svg width="200" height="110" viewBox="0 0 200 110" fill="none" className="mt-5">
      <path d="M45 55 L100 18 L155 55 V100 H45 Z" fill="#fff" stroke="#E4E8EE" strokeWidth="1.5" />
      <path d="M100 18 L155 55" stroke="#E4E8EE" strokeWidth="1.5" />
      {[0, 1, 2].map((i) => <path key={i} d={`M${108 + i * 13} ${31 + i * 8.5} l11 7.5 l-4 6 l-11 -7.5 z`} fill={accent} opacity={0.5 + i * 0.15} />)}
      <rect x="88" y="72" width="24" height="28" rx="2" fill={accent} opacity="0.2" />
    </svg>
  )
}

function PreviewBattery({ accent }: { accent: string }) {
  return (
    <svg width="200" height="100" viewBox="0 0 200 100" fill="none" className="mt-6">
      <rect x="40" y="30" width="110" height="50" rx="9" fill="#fff" stroke="#E4E8EE" strokeWidth="1.5" />
      <rect x="150" y="45" width="8" height="20" rx="2.5" fill="#E4E8EE" />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={48 + i * 25} y="38" width="20" height="34" rx="4" fill={accent} opacity={0.3 + i * 0.18} />)}
    </svg>
  )
}

function PreviewCurve({ accent }: { accent: string }) {
  return (
    <svg width="210" height="100" viewBox="0 0 210 100" fill="none" className="mt-6">
      {[30, 55, 80].map((y) => <line key={y} x1="10" y1={y} x2="200" y2={y} stroke="#EEF1F4" />)}
      <path d="M10 80 C 50 78, 70 30, 110 34 S 170 60, 200 22" stroke={accent} strokeWidth="2.5" fill="none" />
      <path d="M10 80 C 50 78, 70 30, 110 34 S 170 60, 200 22 V 90 H 10 Z" fill={accent} opacity="0.08" />
      <path d="M10 62 C 60 60, 120 58, 200 50" stroke="#98A1B0" strokeWidth="1.5" strokeDasharray="4 4" />
    </svg>
  )
}

export function ProspectsDatabasePage() {
  const nav = useNavigate()
  const { solarProspects } = useState_()
  const [detailId, setDetailId] = useState<string | null>(null)
  const detail = detailId ? solarProspects.find((p) => p.id === detailId) ?? null : null
  return (
    <>
      <TopBar title="All prospects" crumbs={['Find', 'Tools']}
        actions={<button onClick={() => nav('/tools')} className="h-9 px-3.5 rounded-control bg-surface border border-border text-[13px] font-semibold text-ink-3 hover:bg-control flex items-center gap-2"><Radar size={15} />Tools</button>} />
      <PageBody>
        <ProspectDatabase prospects={solarProspects} onOpen={setDetailId} showTool />
      </PageBody>
      {detail && <ProspectDetail p={detail} onClose={() => setDetailId(null)} />}
    </>
  )
}
