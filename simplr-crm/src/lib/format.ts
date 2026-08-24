export function money(n: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact) {
    if (Math.abs(n) >= 1_000_000) return `£${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M`
    if (Math.abs(n) >= 1_000) return `£${Math.round(n / 1_000)}K`
    return `£${n}`
  }
  return `£${n.toLocaleString('en-GB')}`
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export function classNames(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ')
}
