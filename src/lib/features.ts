// Single source of truth for feature copy — mirrors what the Velox House app
// actually does (see velox-house-app: find-leads, campaigns, sequences, pipeline,
// inbox, analytics, deliverability + the app-wide AI: query-planner, score-leads,
// ai-insights, generate-reply). Used by the Features page and homepage so the two
// never drift.

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
  /** Optional flag to highlight newer AI capabilities in the UI. */
  ai?: boolean;
}

export const FEATURES: Feature[] = [
  {
    slug: "velox-ai",
    glyph: "✦",
    eyebrow: "Velox AI",
    name: "Launch a whole campaign from a single prompt.",
    tagline: "Describe who you want to reach. It builds, launches and runs the campaign.",
    ai: true,
    what: "Velox AI is an agent that drives the whole app for you. Tell it who you want to reach in plain English — it scopes the brief with a couple of quick taps, then plans the campaign, finds and verifies the leads, researches each business, writes the email and LinkedIn messages, and — once you approve — launches it and starts sending across both channels.",
    does: [
      "Type one prompt (“find marketing managers at UK SaaS firms”) — Velox AI builds the entire campaign",
      "Plans the ICP, search filters, angle and a multi-step email + LinkedIn sequence for you",
      "Finds and verifies real decision-makers, then researches and writes personalised copy in your voice",
      "One approval launches it live — no manual setup, no engineering the perfect prompt",
      "Goal-seeking autopilot: set a target like “50 replies a week” and it keeps finding and sending daily until it's hit",
      "Only ever launches, sends or spends when you explicitly approve",
    ],
    why: "Setting up outbound is the part that stops people — the searches, the copy, the sequence, the sending schedule. Velox AI does all of it from one sentence, so you go from an idea to a live, self-running campaign in minutes. Nothing else lets you launch outbound from a single prompt.",
  },
  {
    slug: "find-leads",
    glyph: "◉",
    eyebrow: "AI Discovery",
    name: "AI that finds the whole market, not the first 20 results.",
    tagline: "Describe your ideal customer — the AI builds the list.",
    ai: true,
    what: "Tell Velox House who you're after and its AI query-planner expands your ICP into dozens of targeted searches — role variants, industry codes, nearby towns — then builds a universe of hundreds of matching companies and the right people inside them.",
    does: [
      "AI query-planner turns one ICP into diverse, targeted searches",
      "Builds a pool of hundreds of matching companies — not a shallow first page",
      "“Broaden the net”: when a niche or town is thin, the AI proposes adjacent niches and wider geography and searches again",
      "AI fit-scoring on every prospect, with a reason — best matches ranked first",
      "“Find more like this” lookalike search from any strong lead",
      "Company and people modes; filter by role, seniority, department, industry, size and location",
      "Verified email discovery — you only spend a contact on a real address",
    ],
    why: "Most tools hand back the same shallow list everyone else pulls. AI-planned discovery finds your whole addressable market and ranks it by fit — so you spend your time on the best-matched prospects, at real scale.",
  },
  {
    slug: "ai-copilot",
    glyph: "✳",
    eyebrow: "AI Copilot",
    name: "An AI that tells you what to do next.",
    tagline: "Guidance woven through the whole app — not a bolt-on chatbot.",
    ai: true,
    what: "Velox House watches your pipeline and does the thinking with you: what to act on today, why your numbers look the way they do, what to change, and how to reply.",
    does: [
      "Dashboard next-best-actions — 2–3 specific things to do right now",
      "“Explain my numbers” — a plain-English read of your analytics",
      "Campaign autopsy — one click analyses a campaign and suggests next-round tweaks to subject, targeting, timing and copy",
      "Inbox reply suggestions — drafts a reply and reads the objection and tone",
      "Fit-scoring and “best match” ranking across your leads",
      "Runs quietly in the background — no prompts to engineer",
    ],
    why: "Knowing what to do next is the hard part of outbound. Having AI surface the highest-leverage action, explain what's working and draft the tricky reply means you move faster and waste less — even if you've never run outreach before.",
  },
  {
    slug: "ai-research",
    glyph: "✦",
    eyebrow: "AI Research",
    name: "Every prospect researched before you say a word.",
    tagline: "Personalisation at scale, done automatically.",
    ai: true,
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
    ai: true,
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
      "Human-paced, staggered sending inside safe daily windows so it looks natural",
      "See exactly when the next batch sends",
      "Auto-stops the moment a prospect replies",
      "Auto-send or review-and-approve mode",
      "Every enrolled contact's status: scheduled, sent, opened",
      "Sends from your own mailbox — sending is unlimited",
    ],
    why: "Most replies come from the follow-ups people never get around to sending. Automating the cadence — paced naturally, from your real inbox — is where the meetings actually come from.",
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
      "AI reply suggestions read the objection and draft a response",
      "Full lifecycle timestamps: scheduled, sent, opened, replied",
      "One shared workspace so the whole team sees who's been contacted",
    ],
    why: "Without one shared system, leads get dropped or double-contacted and you lose deals to disorganisation. Seeing every conversation and stage in one view keeps momentum on every opportunity.",
  },
  {
    slug: "analytics",
    glyph: "◐",
    eyebrow: "Analytics",
    name: "See exactly what's working — and why.",
    tagline: "Live tracking, with an AI read of the numbers.",
    ai: true,
    what: "Real-time analytics show what your outreach is actually producing — and the AI explains what the numbers mean and what to change.",
    does: [
      "Track opens, replies, meetings booked and pipeline value live",
      "“Explain my numbers” turns the dashboard into plain English",
      "Spot your best-performing messages and campaigns",
      "Engagement scoring surfaces the warmest prospects",
      "Per-campaign numbers, not just aggregate",
    ],
    why: "If you can't see what converts, you can't improve it. Knowing which messages book meetings — and getting the AI to explain why — lets you double down on what works instead of guessing.",
  },
  {
    slug: "deliverability",
    glyph: "⛨",
    eyebrow: "Deliverability",
    name: "Land in the inbox, not the spam folder.",
    tagline: "Domain health and safe, paced sending, built in.",
    what: "Velox House checks your domain, watches your reputation and paces your sending so your emails actually get seen.",
    does: [
      "SPF, DKIM and DMARC checks on your sending domain",
      "Domain reputation and bounce-rate monitoring",
      "Pre-send spam checker before a campaign goes out",
      "Staggered, daily-cap-respecting send pacing so you never spike your domain",
      "Score-banded safe sending volume, with alerts when your score changes",
      "Send from your own warmed mailbox: Gmail, Microsoft 365 or any SMTP",
    ],
    why: "The best-written campaign is worthless in spam. Protecting your domain and pacing sends from your own mailbox is what keeps your reply rate — and your sender reputation — alive long term.",
  },
];

// Cross-cutting things worth stating plainly — they're not one screen, they're
// how the whole product is built.
export const PLATFORM_TRUTHS: { label: string; detail: string }[] = [
  {
    label: "Run it from a single prompt",
    detail: "Velox AI drives the whole app — describe who you want to reach and it builds, launches and runs the campaign, finding and messaging leads across email + LinkedIn every day.",
  },
  {
    label: "Send from your own inbox",
    detail: "Every email goes through your connected mailbox (Gmail, Microsoft 365 or SMTP) — from your domain, never a shared sending service.",
  },
  {
    label: "Unlimited sending, every plan",
    detail: "Because you send from your own mailbox, sending is free and uncapped — you're only ever limited by how many great prospects you find.",
  },
  {
    label: "Two clear meters, no surprises",
    detail: "Contacts (verified discoveries) and AI credits (research, scoring & writing) — that's it. Top up contacts any time; sending never costs a credit.",
  },
];
