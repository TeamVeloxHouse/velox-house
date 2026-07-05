// Single source of truth for feature copy — mirrors what the Velox House app
// actually does (see velox-house-app routes: find-leads, campaigns, sequences,
// pipeline, inbox, analytics, deliverability). Used by the Features page and the
// homepage product grid so the two never drift.

export interface Feature {
  slug: string;
  glyph: string;
  eyebrow: string;
  name: string;
  tagline: string;
  /** What it is — one plain-English sentence. */
  what: string;
  /** What it does — concrete, real capabilities. */
  does: string[];
  /** Why it's impactful — the outcome that matters. */
  why: string;
}

export const FEATURES: Feature[] = [
  {
    slug: "find-leads",
    glyph: "◉",
    eyebrow: "Find Leads",
    name: "A live prospecting database, not a stale list.",
    tagline: "Find the exact decision-makers who match your ideal customer.",
    what: "Search real UK companies and the people inside them, and build a targeted list in minutes instead of buying a generic CSV that's out of date the day it lands.",
    does: [
      "Toggle between company-first and people-first search",
      "Filter people by job title, seniority and department",
      "Filter companies by industry, headcount size and location",
      "Searchable, multi-select filters — stack as many as you need",
      "Relevance ranking and sorting so the best-fit prospects rise to the top",
      "Verified email discovery — you only spend a contact on a real, deliverable address",
      "Control how many people you pull per company",
    ],
    why: "The right list is half the battle. Targeting your exact ICP — instead of guessing or buying stale data — is what turns cold outreach from spray-and-pray into a predictable pipeline.",
  },
  {
    slug: "ai-research",
    glyph: "✦",
    eyebrow: "AI Research",
    name: "Every prospect researched before you say a word.",
    tagline: "Personalisation at scale, done automatically.",
    what: "For every prospect you add, the AI reads their business and works out what actually matters to them — so your outreach speaks to their world, not a mail-merge field.",
    does: [
      "Automatic research on each prospect's company and role",
      "Surfaces pain points, relevant angles and why you're a fit",
      "Batch-researches a whole list in one go",
      "Feeds straight into the messaging so drafts arrive pre-personalised",
    ],
    why: "Generic cold emails get deleted; personalised ones get replies. Real per-prospect research is the difference — and doing it by hand for hundreds of leads is impossible without this.",
  },
  {
    slug: "ai-messaging",
    glyph: "◆",
    eyebrow: "AI Messaging",
    name: "The AI writes it. You just hit send.",
    tagline: "Personalised emails, LinkedIn notes and follow-ups, written for you.",
    what: "Turn research into ready-to-send copy — personalised cold emails, LinkedIn connection notes and follow-ups — that sound like you, not a robot.",
    does: [
      "Drafts personalised first-touch emails and LinkedIn messages",
      "Writes the whole follow-up sequence, not just the opener",
      "Editable preview with your own signature before anything sends",
      "Reusable templates for angles that work",
    ],
    why: "Writing good cold email is slow and most people are bad at it. Getting a strong, personalised first draft in seconds means you actually send — consistently — instead of staring at a blank page.",
  },
  {
    slug: "sequences",
    glyph: "▶",
    eyebrow: "Sequences",
    name: "Follow up automatically. Never drop a lead.",
    tagline: "Multi-step email + LinkedIn cadences that run themselves.",
    what: "Build a multi-step follow-up once and it runs on schedule from your own inbox, stopping the instant someone replies.",
    does: [
      "Multi-step cadences across email and LinkedIn in one flow",
      "Run multichannel, or LinkedIn-only, per campaign",
      "Delays down to sub-day timing between steps",
      "Auto-stops the moment a prospect replies",
      "Auto-send or review-and-approve mode",
      "See every enrolled contact's status: scheduled, sent, opened",
      "Bulk enrol and remove contacts",
      "Sends from your own mailbox — sending is unlimited",
    ],
    why: "Most replies come from the follow-ups people never get around to sending. Automating the cadence — while it still comes from your real inbox — is where the meetings actually come from.",
  },
  {
    slug: "pipeline-inbox",
    glyph: "■",
    eyebrow: "Pipeline & Inbox",
    name: "Every reply and every deal, in one place.",
    tagline: "A lightweight CRM and unified inbox built for outreach.",
    what: "Replies land in one shared inbox and every prospect moves through a visual pipeline, so nothing gets lost between first touch and closed.",
    does: [
      "Person-focused kanban pipeline from first touch to won",
      "Unified inbox for every reply across your campaigns",
      "Full lifecycle timestamps: scheduled, sent, opened, replied",
      "One shared workspace so the whole team sees who's been contacted",
    ],
    why: "Without one shared system, leads get dropped or double-contacted and you lose deals to disorganisation. Seeing every conversation and stage in one view keeps momentum on every opportunity.",
  },
  {
    slug: "analytics",
    glyph: "◐",
    eyebrow: "Analytics",
    name: "See exactly what's working.",
    tagline: "Live tracking from first send to booked meeting.",
    what: "Real-time analytics show what your outreach is actually producing — not just sends, but replies, meetings and pipeline value.",
    does: [
      "Track opens, replies, meetings booked and pipeline value live",
      "Spot your best-performing messages and campaigns",
      "Engagement scoring to surface the warmest prospects",
      "Know your numbers per campaign, not just in aggregate",
    ],
    why: "If you can't see what converts, you can't improve it. Knowing which messages book meetings lets you double down on what works and cut what doesn't — instead of sending into the dark.",
  },
  {
    slug: "deliverability",
    glyph: "⛨",
    eyebrow: "Deliverability",
    name: "Land in the inbox, not the spam folder.",
    tagline: "Domain health and safe sending, built in.",
    what: "Velox House checks your domain, watches your reputation and paces your sending so your emails actually get seen.",
    does: [
      "SPF, DKIM and DMARC checks on your sending domain",
      "Domain reputation and bounce-rate monitoring",
      "Pre-send spam checker before a campaign goes out",
      "Score-banded safe sending volume so you don't over-send",
      "Alerts when your deliverability score changes",
      "Send from your own warmed mailbox: Gmail, Microsoft 365 or any SMTP",
    ],
    why: "The best-written campaign is worthless in spam. Protecting your domain and sending from your own mailbox is what keeps your reply rate — and your sender reputation — alive long term.",
  },
];

// Cross-cutting things worth stating plainly — they're not one screen, they're
// how the whole product is built.
export const PLATFORM_TRUTHS: { label: string; detail: string }[] = [
  {
    label: "Send from your own inbox",
    detail: "Every email goes through your connected mailbox (Gmail, Microsoft 365 or SMTP) — from your domain, never a shared sending service.",
  },
  {
    label: "Unlimited sending, every plan",
    detail: "Because you send from your own mailbox, sending is free and uncapped — you're only ever limited by how many great prospects you find.",
  },
  {
    label: "One workspace for your team",
    detail: "Shared contacts, pipeline and sequences with seats for each member — everyone sees the same source of truth.",
  },
  {
    label: "Two clear meters, no surprises",
    detail: "Contacts (verified discoveries) and AI credits (research & writing) — that's it. Top up contacts any time; sending never costs a credit.",
  },
];
