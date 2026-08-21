import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Rail } from './Rail'
import { CommandPalette } from './CommandPalette'
import { AiAssistant } from './AiAssistant'
import { Toaster } from './overlays'

export function Layout() {
  const [paletteOpen, setPaletteOpen] = useState(false)

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
      <div className="flex-1 flex flex-col min-w-0">
        <Outlet context={{ openPalette: () => setPaletteOpen(true) }} />
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <AiAssistant />
      <Toaster />
    </div>
  )
}
