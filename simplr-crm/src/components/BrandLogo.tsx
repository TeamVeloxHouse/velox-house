import { useState } from 'react'

/**
 * Real company logo with a resilient source chain:
 *   1. Clearbit Logo API (high-quality full-colour logos)
 *   2. Google favicon service (works for essentially any domain)
 *   3. a branded initials tile (offline / unknown domain)
 * Each source falls through to the next on load error.
 */
export function BrandLogo({
  domain,
  name,
  color,
  initials,
  size = 40,
  radius = 10,
}: {
  domain?: string
  name: string
  color: string
  initials: string
  size?: number
  radius?: number
}) {
  const sources = domain
    ? [
        `https://logo.clearbit.com/${domain}?size=${size * 2}`,
        `https://www.google.com/s2/favicons?domain=${domain}&sz=${size * 2 > 64 ? 128 : 64}`,
      ]
    : []
  const [idx, setIdx] = useState(0)
  const src = sources[idx]

  return (
    <span
      className="inline-flex items-center justify-center shrink-0 overflow-hidden"
      style={{ width: size, height: size, borderRadius: radius, background: src ? '#fff' : color, border: src ? '1px solid #E4E8EE' : 'none' }}
    >
      {src ? (
        <img
          key={src}
          src={src}
          alt={name}
          width={size}
          height={size}
          onError={() => setIdx((i) => i + 1)}
          style={{ width: '76%', height: '76%', objectFit: 'contain' }}
        />
      ) : (
        <span className="text-white font-bold" style={{ fontSize: Math.round(size * 0.34) }}>{initials}</span>
      )}
    </span>
  )
}
