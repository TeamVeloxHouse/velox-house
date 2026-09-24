import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Rail } from './Rail'
import { CommandPalette } from './CommandPalette'
import { Dock } from './Dock'
import { Onboarding } from './Onboarding'
import { Toaster } from './overlays'
import { Lock } from './icons'
import { useActions, useState_ } from '../store/store'
import { canAccess } from './nav-config'
import { roleByKey } from '../lib/roles'

export function Layout() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { currentRole } = useState_()
  const { setRole } = useActions()
  const location = useLocation()
  const nav = useNavigate()
  const allowed = canAccess(location.pathname, currentRole)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    const onOpen = () => setPaletteOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('simplr-open-palette', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('simplr-open-palette', onOpen)
    }
  }, [])

  return (
    <div className="h-full flex bg-canvas overflow-hidden">
      <Rail />
      <div className="flex-1 flex flex-col min-w-0 bg-canvas-fade">
        {currentRole !== 'owner' && (
          <div className="shrink-0 h-9 px-5 flex items-center gap-2 text-[12.5px] text-white" style={{ background: '#15223B' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#62E4CC]" />
            Previewing the app as <b>{roleByKey(currentRole).label}</b> · {roleByKey(currentRole).blurb}
            <button onClick={() => setRole('owner', true)} className="ml-auto font-semibold text-[#62E4CC] hover:underline">Back to Managing Director view</button>
          </div>
        )}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {allowed ? <Outlet context={{ openPalette: () => setPaletteOpen(true) }} /> : (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-10">
              <span className="w-14 h-14 rounded-2xl bg-control text-muted-b flex items-center justify-center"><Lock size={24} /></span>
              <div className="text-[17px] font-bold text-ink">This page isn’t part of the {roleByKey(currentRole).label} view</div>
              <div className="text-[13px] text-muted-b max-w-[420px]">Access is set by role. The Managing Director can see everything and can change who sees what.</div>
              <button onClick={() => nav('/')} className="h-9 px-4 rounded-control bg-accent-gradient text-white text-[13px] font-semibold shadow-primary">Go to My Day</button>
            </div>
          )}
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Dock />
      <Onboarding />
      <Toaster />
    </div>
  )
}
