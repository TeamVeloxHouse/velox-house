import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Chip } from '../components/ui'
import { Sun, Bolt, Layers, Radar, Person, Building, Flow, Wrench } from '../components/icons'
import { useState_ } from '../store/store'
import { ProspectDatabase, ProspectDetail } from './CommercialSolar'

type ToolDef = { id: string; name: string; desc: string; icon: any; to?: string; live: boolean }
const TOOLS: ToolDef[] = [
  { id: 'company-search', name: 'Company & People Search', desc: 'Find companies by industry and place — or one by name — then reveal the decision-makers. Measure a roof any time.', icon: Building, to: '/tools/company-search', live: true },
  { id: 'commercial-solar', name: 'Commercial Solar Finder', desc: 'Scan an area, measure every roof, score the hottest solar prospects and find the people.', icon: Sun, to: '/tools/commercial-solar', live: true },
  { id: 'domestic-solar', name: 'Domestic Solar Calculator', desc: 'Homeowner roof + savings calculator with finance and self-consumption modelling.', icon: Sun, live: false },
  { id: 'ev-charging', name: 'EV Charging Calculator', desc: 'Fleet & workplace charging sizing, load and payback.', icon: Bolt, to: '/studio/ev', live: true },
  { id: 'battery-storage', name: 'Battery Storage Sizer', desc: 'Size storage against a load profile for peak-shaving and backup.', icon: Layers, live: false },
  { id: 'heat-pump', name: 'Heat Pump Estimator', desc: 'Heat-loss led sizing and running-cost comparison vs gas.', icon: Wrench, live: false },
]

export function ToolsHub() {
  const nav = useNavigate()
  const { solarProspects } = useState_()
  const countFor = (id: string) => solarProspects.filter((p) => (p.tool ?? 'commercial-solar') === id).length

  return (
    <>
      <TopBar title="Tools" crumbs={['Find']}
        actions={<button onClick={() => nav('/tools/database')} className="h-9 px-3.5 rounded-control bg-surface border border-border text-[13px] font-semibold text-ink-3 hover:bg-control flex items-center gap-2"><Layers size={15} />All prospects</button>} />
      <PageBody>
        <div className="rounded-card p-6 flex items-center gap-4" style={{ background: 'linear-gradient(135deg,#EEF2FB,#F5F0FF 70%)', border: '1px solid #E3E8F5' }}>
          <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Radar size={28} /></span>
          <div className="flex-1"><div className="text-[18px] font-bold text-ink">Prospecting tools</div><div className="text-[13.5px] text-muted-b mt-0.5">Each tool finds and qualifies leads its own way, with its own chat, scanned results and database — all flowing into one prospects pipeline.</div></div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {TOOLS.map((t) => {
            const n = countFor(t.id)
            return (
              <button key={t.id} disabled={!t.live} onClick={() => t.to && nav(t.to)}
                className={classNames('text-left rounded-card bg-surface border border-border p-5 flex flex-col gap-3 transition-shadow', t.live ? 'hover:shadow-modal cursor-pointer' : 'opacity-60 cursor-default')}>
                <div className="flex items-center justify-between">
                  <span className="w-12 h-12 rounded-2xl flex items-center justify-center text-white" style={{ background: t.live ? 'linear-gradient(135deg,#3B6BF5,#7C3AED)' : '#94A3B8' }}><t.icon size={24} /></span>
                  {t.live ? (n > 0 ? <Chip tone="accent">{n} prospects</Chip> : <Chip tone="positive" dot>Live</Chip>) : <Chip tone="neutral">Coming soon</Chip>}
                </div>
                <div><div className="text-[15px] font-bold text-ink">{t.name}</div><div className="text-[12.5px] text-muted-b mt-1 leading-snug">{t.desc}</div></div>
                {t.live && <div className="text-[12.5px] font-semibold text-accent mt-auto">Open tool →</div>}
              </button>
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

function classNames(...c: (string | false | undefined)[]) { return c.filter(Boolean).join(' ') }
