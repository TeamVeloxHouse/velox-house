import type { CustomerPortal, PortalResource } from '../store/types'

/**
 * The customer-facing Ovi. Deliberately SANDBOXED: it only knows the customer's
 * own system, proposal, general solar/energy, and the resource library (manuals,
 * guides, videos, case studies). It must never answer about the CRM, the
 * business, other customers, pipeline, or internal data — a real backend would
 * scope the model + retrieval to exactly this customer.
 */
export type PortalBlock =
  | { type: 'text'; text: string }
  | { type: 'stats'; items: { label: string; value: string }[] }
  | { type: 'manual'; title: string; manufacturer?: string; excerpt: string }
  | { type: 'steps'; title: string; steps: string[] }

export type PortalReply = { text: string; blocks?: PortalBlock[]; working: string[]; source?: string }

const OFF_LIMITS = /\b(pipeline|other customer|another customer|crm|sales team|our leads?|company revenue|deal[s]? worth|forecast|commission|profit margin|internal|staff|employee|who else)\b/i

export const portalStarters = [
  'How much am I saving?',
  'What happens on install day?',
  'My Tesla battery shows a red light',
  'How do I read my export figures?',
]

function stepsFrom(content: string): string[] {
  const nums = content.match(/\d\)\s[^.]*(?:\.[^0-9)]*)?/g)
  if (nums && nums.length >= 2) return nums.map((s) => s.replace(/^\d\)\s*/, '').trim().replace(/\s+/g, ' '))
  return content.split(/\.\s+/).slice(0, 4).map((s) => s.trim()).filter(Boolean)
}

const BRANDS = ['tesla', 'powerwall', 'solaredge', 'givenergy', 'inverter', 'battery']

export function customerAnswer(prompt: string, ctx: { portal: CustomerPortal; resources: PortalResource[] }): PortalReply {
  const q = prompt.toLowerCase().trim()
  const { portal, resources } = ctx
  const first = portal.customer.split(' ')[0]

  // 1. Hard boundary — anything about the business / other customers / the CRM.
  if (OFF_LIMITS.test(q)) {
    return { working: ['Checking what I can help with'], text: `I'm your system assistant, ${first} — I can only help with **your** solar system, your proposal, and getting the most from it. For anything about ${'your account'} beyond that, your installer is the best person to ask.` }
  }

  // 2. Troubleshooting / manuals — find it in the resource library and explain.
  const troubleWords = /\b(not working|offline|error|red light|fault|reset|problem|issue|broken|won'?t|stopped|flashing|help with|fix|troubleshoot)\b/.test(q)
  const brandHit = BRANDS.find((b) => q.includes(b))
  if (troubleWords || brandHit) {
    const manuals = resources.filter((r) => r.type === 'manual' || r.type === 'guide')
    const match = manuals.find((r) => (brandHit && (r.manufacturer?.toLowerCase().includes(brandHit) || r.title.toLowerCase().includes(brandHit))) )
      || manuals.find((r) => r.content && troubleWords && /trouble|reset|error|offline|red light/i.test(r.content))
      || manuals.find((r) => r.manufacturer)
    if (match?.content) {
      const steps = stepsFrom(match.content)
      const excerpt = match.content.split('. ').slice(0, 2).join('. ')
      return {
        working: ['Understanding the problem', `Searching your ${match.manufacturer ?? 'system'} manual`, 'Pulling out the fix'],
        text: `Found it in your **${match.title}**. Here's what's most likely going on and how to sort it — it usually takes a couple of minutes.`,
        blocks: [
          { type: 'manual', title: match.title, manufacturer: match.manufacturer, excerpt },
          { type: 'steps', title: 'Try this', steps },
          { type: 'text', text: `If it's still not right after that, tap “Message my installer” and I'll pass the details on — no need to explain it twice.` },
        ],
        source: match.title,
      }
    }
  }

  // 3. Savings / money.
  if (/\b(sav|money|bill|cost|cheap|payback|worth|roi|return)\b/.test(q)) {
    const payback = portal.systemCost && portal.annualSavings ? Math.round((portal.systemCost / portal.annualSavings) * 10) / 10 : undefined
    return {
      working: ['Reading your system figures'],
      text: `Your ${portal.systemKwp} kWp system is projected to save you about **£${portal.annualSavings.toLocaleString()} a year**${payback ? `, paying for itself in roughly **${payback} years**` : ''}. Most of that comes from using your own solar and storing the rest for the evening.`,
      blocks: [{ type: 'stats', items: [
        { label: 'System size', value: `${portal.systemKwp} kWp` },
        { label: 'Yearly saving', value: `£${portal.annualSavings.toLocaleString()}` },
        ...(payback ? [{ label: 'Payback', value: `${payback} yrs` }] : []),
      ] }],
    }
  }

  // 4. Install day / process.
  if (/\b(install|fit|when|day|process|happen|expect|timeline|survey)\b/.test(q)) {
    return {
      working: ['Checking your install details'],
      text: `On install day our crew arrives around 8am and most homes are done in a day${portal.installDate ? ` — yours was completed on **${portal.installDate}**` : ''}. We fit the panels, inverter and battery, commission the system, and show you the monitoring app before we leave. You don't need to do anything except give us access to the loft/consumer unit.`,
    }
  }

  // 5. General solar knowledge (export, monitoring, EV, battery basics).
  if (/\b(export|feed.?in|monitor|app|solar|panel|battery|ev|charge|grid|generat|storage)\b/.test(q)) {
    return {
      working: ['Pulling together a clear answer'],
      text: `Happy to explain. In short: your panels make electricity when it's light, your home uses what it needs first, the battery stores the extra, and anything left over is exported to the grid (you're paid for that). The monitoring app shows all of this live — generation, what you're using, and what you're saving. Want me to point you to the “Using the monitoring app” video?`,
    }
  }

  // Fallback — scoped to what it can actually do.
  return {
    working: ['Thinking'],
    text: `I'm here to help with your solar system, ${first}. Ask me about your savings, how your system works, install or aftercare, or a problem with a specific part (like your battery or inverter) — I'll find the answer in your manuals and walk you through it.`,
  }
}
