import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { PageBody } from '../components/Page'
import { Button } from '../components/ui'
import { Sun, Plus, Building, Layers, Check } from '../components/icons'
import { AddressAutocomplete } from '../components/inputs'
import { useActions, useState_ } from '../store/store'
import { geocodeLocation } from '../lib/commercialFinder'
import { CompanyLogo } from './CommercialSolar'
import type { Design } from '../store/types'

export function DesignHome() {
  const nav = useNavigate()
  const act = useActions()
  const { designs, solarProspects } = useState_()
  const [addr, setAddr] = useState('')
  const [pin, setPin] = useState<{ lat: number; lng: number } | undefined>()
  const [creating, setCreating] = useState(false)

  async function createFromAddress() {
    if (!addr.trim() || creating) return
    setCreating(true)
    const g = pin ? { lat: pin.lat, lng: pin.lng } : await geocodeLocation(addr).then((r) => r && { lat: r.lat, lng: r.lng }).catch(() => undefined)
    const d = act.createDesign({ name: addr.split(',')[0], address: addr, center: g || undefined })
    setCreating(false)
    nav(`/design/${d.id}`)
  }
  function createFromProspect(id: string) {
    const p = solarProspects.find((x) => x.id === id); if (!p) return
    const d = act.createDesign({ name: p.company, address: p.address, center: p.center, prospectId: p.id })
    nav(`/design/${d.id}`)
  }

  // Prospects with a located roof make the best one-click starts.
  const startable = solarProspects.filter((p) => p.center && !designs.some((d) => d.prospectId === p.id)).slice(0, 6)

  return (
    <>
      <TopBar title="Design Studio" crumbs={['Design']} />
      <PageBody>
        {/* Start a new design */}
        <div className="rounded-card p-6" style={{ background: 'linear-gradient(135deg,#EEF2FB,#F5F0FF 70%)', border: '1px solid #E3E8F5' }}>
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Sun size={24} /></span>
            <div className="flex-1">
              <div className="text-[17px] font-bold text-ink">Design a solar system</div>
              <div className="text-[13px] text-muted-b mt-0.5">Enter a site and Ovi measures the roof, then you lay out panels, angles and strings — a full design that flows into the proposal.</div>
            </div>
          </div>
          <div className="flex items-end gap-2 mt-4">
            <label className="flex-1 flex flex-col gap-1.5">
              <span className="eyebrow text-[10px] text-muted-3">Site address</span>
              <AddressAutocomplete value={addr} placeholder="Start typing a building or address…"
                onPick={async (p) => { setAddr(p.text); setPin(undefined); const g = await geocodeLocation(p.text); if (g) setPin({ lat: g.lat, lng: g.lng }) }} />
            </label>
            <Button variant="primary" icon={<Plus size={16} />} onClick={createFromAddress} className={creating ? 'opacity-60 pointer-events-none' : ''}>{creating ? 'Creating…' : 'New design'}</Button>
          </div>
          {startable.length > 0 && (
            <div className="mt-4">
              <div className="eyebrow text-[10px] text-muted-3 mb-2">Or start from a prospect</div>
              <div className="flex flex-wrap gap-2">
                {startable.map((p) => (
                  <button key={p.id} onClick={() => createFromProspect(p.id)} className="h-9 pl-1.5 pr-3 rounded-full bg-surface border border-border hover:border-accent text-[12.5px] font-semibold text-ink-2 flex items-center gap-2">
                    <CompanyLogo domain={p.domain} name={p.company} size={22} /> {p.company.slice(0, 24)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Existing designs */}
        {designs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16 rounded-card border border-dashed border-border">
            <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#3B6BF5,#7C3AED)' }}><Layers size={28} /></span>
            <div className="text-[16px] font-bold text-ink">No designs yet</div>
            <div className="text-[13px] text-muted-b max-w-[440px]">Start one from an address above, or from a prospect you’ve already measured. Every design attaches to its deal and feeds the proposal.</div>
          </div>
        ) : (
          <div>
            <div className="text-[13px] font-bold text-ink-2 mb-3">{designs.length} design{designs.length === 1 ? '' : 's'}</div>
            <div className="grid grid-cols-3 gap-4">
              {designs.map((d) => <DesignCard key={d.id} d={d} onOpen={() => nav(`/design/${d.id}`)} />)}
            </div>
          </div>
        )}
      </PageBody>
    </>
  )
}

function DesignCard({ d, onOpen }: { d: Design; onOpen: () => void }) {
  const done = d.status === 'confirmed'
  return (
    <button onClick={onOpen} className="text-left rounded-card bg-surface border border-border p-4 flex flex-col gap-3 hover:shadow-modal transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-[15px] text-ink truncate">{d.name}</div>
          <div className="text-[11.5px] text-muted-2 truncate">{d.address || 'No address'}</div>
        </div>
        <span className="text-[10.5px] font-bold px-2 py-1 rounded-full shrink-0" style={done ? { background: '#E4F5EE', color: '#0E9F6E' } : { background: '#EEF2FB', color: '#3B6BF5' }}>{done ? 'Confirmed' : 'Draft'}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Mini v={String(d.planes.length)} u="planes" />
        <Mini v={d.systemKwp ? `${Math.round(d.systemKwp)}` : '—'} u="kWp" />
        <Mini v={d.panels ? String(d.panels) : '—'} u="panels" />
      </div>
      <div className="text-[12px] font-semibold text-accent flex items-center gap-1.5">{done ? <><Check size={13} />Open design</> : <>Continue designing →</>}</div>
    </button>
  )
}
function Mini({ v, u }: { v: string; u: string }) {
  return <div className="rounded-lg bg-control py-1.5"><div className="text-[15px] font-bold text-ink leading-none">{v}</div><div className="text-[9.5px] text-muted-2 mt-1 uppercase tracking-wide">{u}</div></div>
}
