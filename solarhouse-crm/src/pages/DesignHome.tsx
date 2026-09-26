import { useEffect, useState } from 'react'
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
    if (creating) return
    if (!addr.trim()) { act.toast('Enter a site address first — or try the demo roof', 'warning'); return }
    // a street or postcode on its own would pin the middle of the road and design a neighbour's roof
    if (!pin && !/^\s*(\d|flat|apartment)/i.test(addr) && !/^\s*[^,\d]+ (house|cottage|farm|lodge|barn)\b/i.test(addr)) {
      act.toast('Pick the house from the list below — a street or postcode on its own could land on a neighbour’s roof', 'warning'); return
    }
    setCreating(true)
    const g = pin ? { lat: pin.lat, lng: pin.lng } : await geocodeLocation(addr).then((r) => r && { lat: r.lat, lng: r.lng }).catch(() => undefined)
    const d = act.createDesign({ name: addr.split(',')[0], address: addr, center: g || undefined })
    setCreating(false)
    nav(`/design/${d.id}`)
  }
  // One-click demo — a real pitched gable with two planes, so the studio + 3D open fully populated.
  function createDemo() {
    const lat0 = 52.6297, lng0 = -1.1355, mLat = 110540, mLng = 111320 * Math.cos((lat0 * Math.PI) / 180)
    const dLat = 8 / mLat, dLng = 6 / mLng
    const south = [{ lat: lat0, lng: lng0 - dLng }, { lat: lat0, lng: lng0 + dLng }, { lat: lat0 - dLat, lng: lng0 + dLng }, { lat: lat0 - dLat, lng: lng0 - dLng }]
    const north = [{ lat: lat0, lng: lng0 - dLng }, { lat: lat0, lng: lng0 + dLng }, { lat: lat0 + dLat, lng: lng0 + dLng }, { lat: lat0 + dLat, lng: lng0 - dLng }]
    const d = act.createDesign({
      name: 'Demo — Leicester gable', address: 'Demo roof, Leicester', center: { lat: lat0, lng: lng0 },
      planes: [
        { id: `pl${Date.now().toString(36)}s`, name: 'South plane', polygon: south, pitchDeg: 35, azimuthDeg: 180, areaM2: 96, source: 'manual', racking: 'flush' },
        { id: `pl${Date.now().toString(36)}n`, name: 'North plane', polygon: north, pitchDeg: 35, azimuthDeg: 0, areaM2: 96, source: 'manual', racking: 'flush' },
      ],
    })
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
        <div className="rounded-card p-6 bg-surface">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ background: '#15223B' }}><Sun size={24} /></span>
            <div className="flex-1">
              <div className="text-[17px] font-bold text-ink">Design a solar system</div>
              <div className="text-[13px] text-muted-b mt-0.5">Enter a site and Ovi measures the roof, then you lay out panels, angles and strings — a full design that flows into the proposal.</div>
            </div>
          </div>
          <div className="flex items-end gap-2 mt-4">
            <label className="flex-1 flex flex-col gap-1.5">
              <span className="eyebrow text-[10px] text-muted-3">Site address</span>
              <AddressAutocomplete value={addr} placeholder="Start typing a building or address…"
                onChange={(t) => { setAddr(t); setPin(undefined) }}
                onPick={async (p) => { setAddr(p.text); setPin(undefined); const g = await geocodeLocation(p.text); if (g) setPin({ lat: g.lat, lng: g.lng }) }} />
            </label>
            <Button variant="primary" icon={<Plus size={16} />} onClick={createFromAddress} className={creating ? 'opacity-60 pointer-events-none' : ''}>{creating ? 'Creating…' : 'New design'}</Button>
            <Button variant="secondary" icon={<Sun size={16} />} onClick={createDemo}>Demo roof</Button>
          </div>
          <PostcodeHomes query={addr} onPick={(h) => { setAddr(h.address); setPin(h.center) }} picked={pin} />
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
            <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-white" style={{ background: '#15223B' }}><Layers size={28} /></span>
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

type PostcodeHome = { id: string; label: string; number: string; street: string; address: string; center: { lat: number; lng: number }; areaM2: number }
const POSTCODE_RE = /^\s*([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\s*(?:,.*)?$/i // "CF14 2AG" or a picked "CF14 2AG, Cardiff, UK"

/** Typed just a postcode? List every home in it (house number first) so you pick the exact roof. */
function PostcodeHomes({ query, onPick, picked }: { query: string; onPick: (h: PostcodeHome) => void; picked?: { lat: number; lng: number } }) {
  // a full postcode, or a street picked/typed WITHOUT a house number ("Clos-y-Dolydd, Beddau") — either way, list the homes
  const pcMatch = query.match(POSTCODE_RE)?.[1]?.toUpperCase() ?? null
  const streetQ = !pcMatch && /,/.test(query) && !/^\s*\d/.test(query) && query.split(',')[0].trim().length >= 4 ? query.trim() : null
  const pc = pcMatch ?? streetQ
  const [state, setState] = useState<{ pc: string; loading: boolean; homes: PostcodeHome[]; reason?: string; district?: string } | null>(null)
  const [filter, setFilter] = useState('')
  useEffect(() => {
    if (!pc) return
    let dead = false
    setState({ pc, loading: true, homes: [] }); setFilter('')
    fetch(pcMatch ? `/api/postcode-homes?pc=${encodeURIComponent(pc)}` : `/api/street-homes?q=${encodeURIComponent(pc)}`).then((r) => r.json())
      .then((j) => { if (!dead) setState({ pc, loading: false, homes: j.homes ?? [], reason: j.ok ? undefined : j.reason, district: j.district }) })
      .catch(() => { if (!dead) setState({ pc, loading: false, homes: [], reason: 'Could not reach the address lookup' }) })
    return () => { dead = true }
  }, [pc])
  // keep showing the list after a pick (the input then holds the full address, not the postcode)
  if (!state || (!pc && !picked)) return null
  const shown = state.homes.filter((h) => !filter || h.label.toLowerCase().includes(filter.toLowerCase()))
  const streets = [...new Set(shown.map((h) => h.street))]
  return (
    <div className="mt-4 rounded-card bg-surface border border-border p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-bold text-ink">Which home {POSTCODE_RE.test(state.pc) ? 'in' : 'on'} {state.pc.split(',')[0]}?</div>
          <div className="text-[12px] text-muted-b">{state.loading ? 'Finding every building in the postcode and its address…' : state.reason ? state.reason : `${state.homes.length} home${state.homes.length === 1 ? '' : 's'}${state.district ? ` · ${state.district}` : ''} — picking one pins the design on that exact roof`}</div>
        </div>
        {state.homes.length > 8 && <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="House number or name…" className="h-8 w-[180px] px-2.5 rounded-control border border-input-border bg-white text-[12.5px] outline-none focus:border-accent" />}
      </div>
      {state.loading && <div className="mt-3 grid grid-cols-6 gap-2">{Array.from({ length: 12 }, (_, i) => <div key={i} className="h-[52px] rounded-[10px] bg-control animate-pulse" />)}</div>}
      {!state.loading && streets.map((st) => (
        <div key={st} className="mt-3">
          {streets.length > 1 && <div className="eyebrow text-[10px] text-muted-3 mb-1.5">{st || 'Named homes'}</div>}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
            {shown.filter((h) => h.street === st).map((h) => {
              const on = !!picked && Math.abs(picked.lat - h.center.lat) < 1e-7 && Math.abs(picked.lng - h.center.lng) < 1e-7
              return (
                <button key={h.id} onClick={() => onPick(h)} title={h.address}
                  className={`text-left rounded-[10px] border px-3 py-2 transition-colors ${on ? 'border-[#15223B] bg-[#15223B] text-white' : 'border-border bg-white hover:border-[#62E4CC]'}`}>
                  <div className={`text-[15px] font-bold leading-tight truncate ${on ? 'text-white' : 'text-ink'}`}>{h.number}</div>
                  <div className={`text-[10.5px] truncate ${on ? 'text-[#62E4CC]' : 'text-muted-b'}`}>{h.street || h.label} · {h.areaM2} m²</div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {!state.loading && !state.reason && !state.homes.length && <div className="mt-2 text-[12px] text-muted-b">No mapped homes found in this postcode — type the full address instead.</div>}
    </div>
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
        <span className="text-[10.5px] font-bold px-2 py-1 rounded-full shrink-0" style={done ? { background: '#62E4CC', color: '#15223B' } : { background: '#E9EDF2', color: '#15223B' }}>{done ? 'Confirmed' : 'Draft'}</span>
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
