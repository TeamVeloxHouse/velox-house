import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Sun, Bolt, Layers, Radar, Person, Building, Wrench, Sparkle, MapPin, Flow, Clock, ChevronRight, Bell, Check } from '../components/icons'
import { useActions, useState_ } from '../store/store'
import { money } from '../lib/format'
import { ProspectDatabase, ProspectDetail } from './CommercialSolar'
import { ArtHomeFinder, ArtWholeHome, ArtEvCharger, ArtEnquiries, ArtBatteryRetrofit, ArtReferrals } from '../components/ToolArt'

type Icon = (p: { size?: number; className?: string }) => JSX.Element
type ToolDef = {
  id: string; name: string; tagline: string; desc: string; icon: Icon; to?: string; live: boolean
  accent: string; wash: string; features: { icon: Icon; label: string }[]; eta?: string
  preview: (accent: string) => JSX.Element
}

const TOOLS: ToolDef[] = [
  {
    id: 'home-finder', name: 'Home Finder', tagline: 'Street-level targeting',
    desc: 'Pull every home around a showroom or postcode, measure each roof from satellite and keep the ones worth knocking on.',
    icon: Sun, to: '/tools/home-finder', live: true, accent: '#15223B', wash: '#E4F7F2',
    features: [{ icon: Radar, label: 'Area scan' }, { icon: Sun, label: 'Live roof data' }, { icon: MapPin, label: 'Map' }],
    preview: () => <ArtHomeFinder />,
  },
  {
    id: 'whole-home', name: 'Whole-home Designer', tagline: 'Solar + battery + EV',
    desc: 'Model a homeowner’s solar, battery and EV as one system, half-hour by half-hour, and show the real saving.',
    icon: Sparkle, to: '/design/whole-home', live: true, accent: '#15223B', wash: '#E4F7F2',
    features: [{ icon: Sun, label: 'Solar' }, { icon: Layers, label: 'Battery' }, { icon: Bolt, label: 'EV' }],
    preview: () => <ArtWholeHome />,
  },
  {
    id: 'ev-charging', name: 'EV Charger Sizer', tagline: 'Home charging',
    desc: 'Size a home charger, check the supply’s headroom and show the cost per mile on solar.',
    icon: Bolt, to: '/studio/ev', live: true, accent: '#15223B', wash: '#E4F7F2',
    features: [{ icon: Bolt, label: 'Load check' }, { icon: Clock, label: 'Payback' }],
    preview: () => <ArtEvCharger />,
  },
  {
    id: 'enquiries', name: 'Enquiry Capture', tagline: 'Web, ads & showroom', eta: 'Q4',
    desc: 'Every website form, Meta/Google lead ad and showroom walk-in lands here, scored and routed within a minute.',
    icon: Person, live: false, accent: '#15223B', wash: '#EDF1F5',
    features: [{ icon: Flow, label: 'Lead ads' }, { icon: Person, label: 'Walk-ins' }],
    preview: () => <ArtEnquiries />,
  },
  {
    id: 'battery-retrofit', name: 'Battery Retrofit Finder', tagline: 'Homes with panels, no battery', eta: 'Q1',
    desc: 'Spot homes that already have solar from aerial imagery and offer them a battery upgrade.',
    icon: Layers, live: false, accent: '#15223B', wash: '#EDF1F5',
    features: [{ icon: Radar, label: 'Aerial check' }, { icon: Layers, label: 'Upsell' }],
    preview: () => <ArtBatteryRetrofit />,
  },
  {
    id: 'referrals', name: 'Referral Engine', tagline: 'Neighbours of happy customers', eta: 'Q1',
    desc: 'Turn every install into introductions: target the streets around finished jobs and reward referrals from the customer portal.',
    icon: Wrench, live: false, accent: '#15223B', wash: '#EDF1F5',
    features: [{ icon: MapPin, label: 'Nearby streets' }, { icon: Person, label: 'Portal rewards' }],
    preview: () => <ArtReferrals />,
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
                { l: 'Searches run', v: String(solarCampaigns.length) },
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
                  const t = TOOLS.find((x) => x.id === (c.tool ?? 'commercial-solar')) ?? TOOLS[0]
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
                <div className="relative h-[150px] overflow-hidden" style={{ background: `linear-gradient(160deg, ${t.wash} 0%, #FFFFFF 90%)` }}>
                  <div className={`absolute inset-x-2 top-5 bottom-0 transition-transform duration-300 ${t.live ? "group-hover:scale-[1.04]" : "grayscale-[0.5] opacity-60"}`}>{t.preview(t.accent)}</div>
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[#62E4CC] shadow-card" style={{ background: t.accent }}><t.icon size={18} /></span>
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
                      {t.id === 'home-finder' && (
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
                        <span className="text-[11.5px] text-muted-2 flex items-center gap-1.5"><Clock size={12} />{run ? `Last run ${ago(run.createdAt)}` : t.id === 'home-finder' ? 'Not run yet' : 'Calculator'}</span>
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
