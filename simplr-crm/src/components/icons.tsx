import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Base({ size = 18, strokeWidth = 1.7, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth as number}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const Grid = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </Base>
)
export const Bars = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 20V11M10 20V4M16 20V14M22 20V8" />
  </Base>
)
export const Bolt = (p: IconProps) => (
  <Base {...p}>
    <path d="M13 2L4.5 13.5H11l-1 8.5L19 10h-6.5z" />
  </Base>
)
export const Person = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5 20c0-3.6 3.1-5.4 7-5.4s7 1.8 7 5.4" />
  </Base>
)
export const Building = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="3" width="16" height="18" rx="1.5" />
    <path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01" />
  </Base>
)
export const Calendar = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Base>
)
export const Envelope = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 8l9 6 9-6" />
  </Base>
)
export const Pie = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3a9 9 0 1 0 9 9h-9z" />
    <path d="M12 3v9h9a9 9 0 0 0-9-9z" opacity=".5" />
  </Base>
)
export const Gear = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Base>
)
export const Search = (p: IconProps) => (
  <Base strokeWidth={1.9} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M16.5 16.5L21 21" />
  </Base>
)
export const Plus = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
)
export const Check = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 6L9 17l-5-5" />
  </Base>
)
export const ChevronDown = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 9l6 6 6-6" />
  </Base>
)
export const ChevronRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 6l6 6-6 6" />
  </Base>
)
export const ArrowUpRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 17L17 7M8 7h9v9" />
  </Base>
)
export const Phone = (p: IconProps) => (
  <Base {...p}>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" />
  </Base>
)
export const Note = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 4h16v12l-4 4H4z" />
    <path d="M16 20v-4h4M8 9h8M8 13h5" />
  </Base>
)
export const Meeting = (p: IconProps) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M2 20c0-3 2.5-4.6 6-4.6M15 7a3 3 0 0 1 0 6M22 20c0-2.4-1.7-4-4.5-4.5" />
  </Base>
)
export const Task = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M8.5 12l2.5 2.5 5-5" />
  </Base>
)
export const File = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 2h8l4 4v16H6z" />
    <path d="M14 2v4h4" />
  </Base>
)
export const Filter = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 5h16l-6 7v6l-4 2v-8z" />
  </Base>
)
export const Columns = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16M15 4v16" />
  </Base>
)
export const Download = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />
  </Base>
)
export const Bell = (p: IconProps) => (
  <Base {...p}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
  </Base>
)
export const Lock = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Base>
)
export const Star = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 21l1.1-6.5L2.6 9.8l6.5-.9z" />
  </Base>
)
export const Dollar = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.8 7 6.9c0 4.6 10 2.6 10 7.2 0 2.1-2.2 3.4-5 3.4s-5-1.2-5-3.1" />
  </Base>
)
export const Command = (p: IconProps) => (
  <Base {...p}>
    <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
  </Base>
)
export const Clock = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Base>
)
export const Box = (p: IconProps) => (
  <Base {...p}>
    <path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />
  </Base>
)
export const Flow = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="6" height="6" rx="1.5" />
    <rect x="15" y="15" width="6" height="6" rx="1.5" />
    <path d="M9 6h6a3 3 0 0 1 3 3v6" />
  </Base>
)
export const Megaphone = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 11v2a1 1 0 0 0 1 1h2l9 5V5L6 10H4a1 1 0 0 0-1 1zM18 8a4 4 0 0 1 0 8" />
  </Base>
)
export const Layers = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" />
  </Base>
)
export const Target = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" />
  </Base>
)
export const Sparkle = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
  </Base>
)
export const Send = (p: IconProps) => (
  <Base {...p}>
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
  </Base>
)
export const Mic = (p: IconProps) => (
  <Base {...p}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Base>
)
export const Video = (p: IconProps) => (
  <Base {...p}>
    <rect x="2" y="6" width="14" height="12" rx="2" />
    <path d="M16 10l6-3v10l-6-3z" />
  </Base>
)
export const Link = (p: IconProps) => (
  <Base {...p}>
    <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
  </Base>
)
export const Waveform = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" />
  </Base>
)
export const Robot = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="8" width="16" height="11" rx="3" />
    <path d="M12 8V4M9 13h.01M15 13h.01M9 16h6" />
    <circle cx="12" cy="4" r="1" />
  </Base>
)
export const Sun = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8l1.8-1.8M18 6l1.8-1.8" />
  </Base>
)
export const Radar = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 12l7-4M12 21a9 9 0 1 1 6.7-3" />
    <circle cx="12" cy="12" r="1.6" />
    <path d="M12 12a5 5 0 0 1 4-2" opacity=".5" />
  </Base>
)
export const Grid2 = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 3v18" />
  </Base>
)
export const Play = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 4l13 8-13 8z" />
  </Base>
)
export const Users = (p: IconProps) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5M16 5.2a3 3 0 0 1 0 5.8M21 20c0-2.6-1.5-4.2-4-4.7" />
  </Base>
)
export const Wrench = (p: IconProps) => (
  <Base {...p}>
    <path d="M14.5 5.5a4 4 0 0 0-5.3 5.1L4 15.8a2 2 0 0 0 2.8 2.8l5.2-5.2a4 4 0 0 0 5.1-5.3l-2.4 2.4-2.3-.6-.6-2.3z" />
  </Base>
)
export const Sliders = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="8" cy="12" r="2" />
    <circle cx="14" cy="18" r="2" />
  </Base>
)
export const MapPin = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 21s-6.5-5.6-6.5-10.5A6.5 6.5 0 0 1 12 4a6.5 6.5 0 0 1 6.5 6.5C18.5 15.4 12 21 12 21z" />
    <circle cx="12" cy="10.5" r="2.3" />
  </Base>
)
export const Camera = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13" r="3.5" />
  </Base>
)
export const Upload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 15V4M8 8l4-4 4 4" />
    <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </Base>
)
