---
title: "What Is an AI SDR? A Plain-English Guide for UK Founders (2026)"
description: "AI SDRs automate prospecting, research and personalised outreach. What they actually do well, what's hype, costs vs hiring, and how to buy one wisely."
date: 2026-07-25
category: AI
---

An AI SDR is software that automates the top-of-funnel work a human sales development representative does: finding prospects that match your ideal customer profile, researching them, writing personalised outreach, sending email and LinkedIn sequences, and handling initial replies. It does not close deals — it fills your calendar and inbox with warm conversations so a human can. For a small B2B team, a good AI SDR replaces the repetitive 80% of outbound (list building, research, first drafts, follow-ups) while you keep the 20% that actually needs a person.

This guide cuts through the noise: what AI SDRs genuinely do well today, how they work under the hood, what they cost compared with hiring, the risks nobody's landing page mentions, and how to choose one.

## What an AI SDR actually does

A human SDR's week is mostly not selling — it's list building, email checking, profile reading, first-touch writing and follow-up chasing. An AI SDR takes over exactly that layer:

- **Prospecting** — searching business databases, company registries and the web to find companies and decision-makers matching your ideal customer profile (ICP).
- **Verification** — checking each email address actually exists before anything is sent, which protects your [deliverability](/blog/cold-email-deliverability-guide/).
- **Research** — reading each prospect's website, recent activity and public signals to find something specific worth mentioning.
- **Writing** — drafting personalised cold emails and LinkedIn messages per prospect, not mail-merged templates with a `{{first_name}}` token.
- **Sequencing** — sending multi-step follow-ups over days or weeks, across [email and LinkedIn](/blog/cold-email-vs-linkedin-outreach/), and stopping the moment someone replies.
- **Initial reply handling** — categorising responses (interested, not now, wrong person, unsubscribe) and drafting suggested replies for a human to approve.

What it does *not* do: run discovery calls, negotiate, handle objections in a live conversation, or close. The handoff point is the moment a prospect becomes a real conversation.

## What AI SDRs do well — and where the hype outruns reality

**Genuinely good today:**

- **Research at scale.** An LLM can read a prospect's website, note they've just opened a second location, and reference it in the first line — for every prospect, every day. A human doing that properly manages perhaps 10–15 prospects a day.
- **Consistency.** Software doesn't skip follow-up three because it's Friday afternoon — and follow-up discipline is where most human-run outbound quietly dies.
- **First-draft quality.** Given real research to work from, modern models write competent, specific first-touch copy — routinely better than a junior SDR's first six months.
- **Volume without headcount.** One person with an AI SDR can run outbound that previously needed a small team — within [sensible daily sending limits](/blog/how-many-cold-emails-per-day/), which the good tools enforce for you.

**Still hype:**

- **"Fully autonomous revenue."** No AI closes complex B2B deals. Vendors claiming their agent "books meetings while you sleep" are describing top-of-funnel automation with a human still doing every call.
- **Nuanced conversations.** When a prospect replies with a sharp question about your pricing model or a competitor comparison, you want a human answering. AI reply *drafting* helps; AI reply *sending* without review is how brands embarrass themselves.
- **Judgement about who not to contact.** AI is enthusiastic. Left unsupervised, it will happily email your existing customers, competitors, or people who opted out last quarter. Human-set guardrails matter.

The honest framing: an AI SDR is a very good junior teammate that never sleeps, needs clear instructions, and should not be left alone with the send button until you trust it.

## How AI SDRs work under the hood

Every AI SDR is roughly the same four-layer stack. Understanding it helps you ask better questions of vendors.

**1. Data layer.** Where prospects come from: B2B contact databases, company registries like Companies House, web scraping, LinkedIn, and email-finding services. Quality varies enormously — this layer determines whether you're emailing real decision-makers or dead addresses. Verification (SMTP-checking each address before import) is the difference between a 2% bounce rate and a 15% one that torches your sender reputation.

**2. Intelligence layer.** Large language models do two jobs: *research* (reading each prospect's site and public footprint, extracting what's relevant to your pitch) and *writing* (turning that research into a personalised message in your voice). Better products separate these steps so the writing is grounded in verified facts about the prospect rather than plausible-sounding invention.

**3. Sending layer.** How messages actually go out. This is the layer buyers skip and regret. Two models exist: platforms that send from their own shared infrastructure, and platforms that send from *your* inbox (Google Workspace, Microsoft 365 or SMTP). Own-inbox sending means your reputation is yours — you're not sharing an IP with whoever else signed up this month. Since Google and Yahoo's bulk-sender requirements (SPF, DKIM and DMARC authentication, spam-complaint rates under 0.3%), sending infrastructure is a survival question, not a detail. Our [deliverability guide](/blog/cold-email-deliverability-guide/) covers the full picture.

**4. Orchestration layer.** The agent logic: deciding who to contact next, which channel, when to follow up, when to stop, and — in newer goal-seeking systems — whether the campaign is on track to hit a target and what to adjust if not.

## Human SDR vs AI SDR

| | Human SDR | AI SDR |
|---|---|---|
| **Cost (UK)** | Roughly £30–40k base salary, plus commission, tools, management time and 3–6 months ramp | Software from roughly £20–£180/month depending on tier and volume |
| **Prospects researched per day** | 10–15 done properly | Hundreds, with consistent depth |
| **Follow-up discipline** | Variable; drops when busy | Every sequence, every day |
| **Personalisation quality** | Excellent when fresh; degrades with volume | Consistent; good with real research inputs, generic without |
| **Handles nuanced replies** | Yes — this is where humans shine | Drafts only; needs human review |
| **Runs discovery calls / closes** | Yes | No |
| **Ramp time** | 3–6 months to full productivity | Days |
| **Scales with** | Headcount | A pricing tier |
| **Best at** | Conversations, judgement, relationships | Volume, research, consistency |

The economics are stark, but read them carefully. An AI SDR doesn't replace a great SDR — it replaces the *activity* a team would otherwise hire a junior for. If you were about to make your first SDR hire purely to "do outbound", try software first: the downside is a month's subscription, not a mis-hire.

## What it costs vs hiring

Hiring a UK SDR realistically means a £30–40k base salary before commission, plus the data and sequencing tools they need, plus a manager's time, plus several months before they're productive. All-in, the first year of a single SDR seat comfortably exceeds £45–50k for most teams.

AI SDR software spans a wide price range. At the top end, "AI employee" products aimed at funded startups run to hundreds or thousands of pounds a month. In the mid-market, most credible tools land between £50 and £200/month. At the accessible end, [Velox House](/features) starts at £19.99/month for an email-only plan with 300 verified contacts, rising to £49.99/month for multichannel email + LinkedIn — with no contract. (See how that compares with [Instantly](/blog/instantly-alternatives/), [Lemlist](/blog/lemlist-alternatives/) and [Apollo](/blog/apollo-alternatives-uk/).)

The right comparison isn't "AI SDR vs SDR salary" — it's "what does a qualified conversation cost me each way?" For most small UK teams, software wins that maths by an order of magnitude at low volumes. Humans win it back the moment conversations need judgement, which is exactly where you should spend the salary budget.

## Buying criteria: what separates good AI SDRs from expensive spam machines

Work through these before trusting any vendor demo:

| Criterion | What to look for | Why it matters |
|---|---|---|
| **Own-inbox sending** | Sends from your Google/Microsoft 365/SMTP mailbox | Your sender reputation stays under your control |
| **Email verification** | Every contact verified before import; bounce rate visible | Bounces above ~2% damage deliverability fast |
| **Human approval gates** | Review messages before send; approve replies before they go | Protects brand voice; catches AI mistakes |
| **Multichannel** | Email + LinkedIn in one sequence, paced within platform norms (LinkedIn tolerates roughly 100 invites/week) | Replies come from channel switching, not more volume on one |
| **Deliverability tooling** | SPF/DKIM/DMARC checks, spam testing, enforced daily limits | Non-negotiable under Google/Yahoo bulk-sender rules |
| **Transparent per-contact pricing** | Clear cost per verified contact; no opaque "credits" that vanish | Lets you calculate cost per conversation honestly |
| **Compliance fit** | UK GDPR/PECR-aware defaults (B2B legitimate interest, easy opt-out) | [Cold email is legal in the UK](/blog/is-cold-email-legal-uk/) — done properly |
| **Reply handling** | Categorises replies, drafts responses for approval, stops sequences instantly on reply | The fastest way to lose a warm lead is a follow-up after they replied |

If a vendor can't answer "whose inbox does this send from?" and "what happens when someone replies?" crisply, walk away.

## The risks: deliverability, brand voice, and the backlash problem

**Deliverability is the big one.** AI SDRs make it trivially easy to send a lot of email, and volume without infrastructure discipline lands you in spam. Mailbox providers now enforce authentication and complaint thresholds mechanically. Before running any AI outbound, check your domain's SPF, DKIM and DMARC — Velox House has a [free deliverability checker](/tools) that takes a minute and needs no signup.

**Brand voice drift.** An unsupervised AI will eventually write something off-brand, over-familiar, or factually wrong about your product. Approval gates exist for a reason; use them heavily in the first weeks, then loosen as trust builds.

**Spray-and-pray backlash.** Because AI makes volume cheap, some operators have flooded inboxes with thinly-personalised slop — and prospects have noticed. The counterintuitive lesson: AI SDRs reward *smaller, better-researched* lists. Two hundred genuinely relevant prospects beat five thousand generic sends every time. Good [templates and structure](/blog/cold-email-templates-that-get-replies/) still matter; the AI fills them with substance, not glitter.

## Where Velox House fits

Velox House is an AI SDR you run from a single prompt. Describe your ideal customer in plain English — "operations directors at UK logistics firms with 20–200 staff" — and Velox AI plans the campaign, finds and SMTP-verifies matching decision-makers before import, researches each business individually, and writes personalised cold emails and LinkedIn messages for your approval. Once approved, it sends daily on autopilot from your own inbox, staggered within safe sending windows, and stops the moment a prospect replies.

The goal-seeking autopilot is the part that behaves most like a rep: set a target such as "50 replies a week" and it keeps sourcing leads and sending until the goal is hit, while the AI Copilot explains your analytics in plain English, runs campaign autopsies, and drafts replies in your inbox. Plans start at £19.99/month with no contract — [get started](https://hub.veloxhouse.co.uk/signup) or see [pricing](/#pricing).

## Frequently asked questions

### What does an AI SDR actually do?

An AI SDR automates the top-of-funnel work a human sales development rep does: finding prospects matching your ideal customer profile, verifying their contact details, researching each one, writing personalised email and LinkedIn outreach, sending follow-up sequences, and triaging initial replies. It hands warm conversations to a human rather than closing deals itself.

### Can an AI SDR fully replace a human SDR?

No. AI SDRs excel at research, personalisation and follow-up consistency at scale, but humans still handle nuanced replies, discovery calls, objections and closing. The realistic framing is that an AI SDR replaces the repetitive activity you'd hire a junior for, while humans keep the conversations that need judgement.

### How much does an AI SDR cost compared with hiring?

A UK SDR typically costs £30–40k in base salary before commission, tools, management time and a 3–6 month ramp. AI SDR software mostly runs from roughly £20 to a few hundred pounds per month depending on volume and channels — Velox House starts at £19.99/month with no contract. For small teams, the cost per qualified conversation is usually far lower with software.

### Are AI SDRs legal in the UK?

Yes, when used properly. B2B cold email is lawful in the UK under legitimate interest, provided you identify yourself, make opting out easy, and honour opt-outs — the rules apply identically whether a human or an AI wrote the message. See our full guide to [UK cold email law](/blog/is-cold-email-legal-uk/) for the PECR and UK GDPR detail.

### Will an AI SDR hurt my email deliverability?

Only if it's badly built or badly used. The risks are unverified lists (bounces), excessive volume, and shared sending infrastructure. Choose a tool that verifies every email before sending, sends from your own inbox with SPF, DKIM and DMARC configured, and enforces sensible daily limits. You can check your domain free at [/tools](/tools).

### Should the AI send messages without my approval?

Not at first. Start with human approval gates on both outbound messages and replies, review everything for the first few weeks, and loosen supervision as the AI proves it matches your voice and targeting. Good AI SDR platforms make approval-first the default and let you graduate to autopilot deliberately.
