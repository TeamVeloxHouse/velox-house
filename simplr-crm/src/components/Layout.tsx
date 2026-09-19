import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Rail } from './Rail'
import { SectionNav } from './SectionNav'
import { CommandPalette } from './CommandPalette'
import { Dock } from './Dock'
import { Onboarding } from './Onboarding'
import { Toaster } from './overlays'

export function Layout() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const location = useLocation()
  const showSectionNav = !location.pathname.startsWith('/settings')

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
        {showSectionNav && <SectionNav />}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Outlet context={{ openPalette: () => setPaletteOpen(true) }} />
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Dock />
      <Onboarding />
      <Toaster />
    </div>
  )
}
