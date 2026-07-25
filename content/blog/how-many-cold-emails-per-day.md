---
title: "How Many Cold Emails Can I Send Per Day? Safe Limits for 2026"
description: "Safe cold email sending limits explained: start at 10-20/day per new mailbox, ramp to ~50 over 3-4 weeks. Week-by-week warm-up schedule inside."
date: 2026-07-25
category: Deliverability
---
From a brand-new domain and mailbox, start at roughly 10–20 cold emails per day and ramp up gradually over three to four weeks towards a sustainable ceiling of around 50 cold emails per mailbox per day. Established mailboxes with strong engagement history can safely send more, but the reliable way to scale volume is adding more mailboxes and domains — not pushing one inbox harder. Provider limits (Google Workspace allows 2,000 recipients a day, Microsoft 365 around 10,000) are technical caps, not safe cold-email volumes: your real limit is sender reputation, and it sits far below what your provider will physically let you send.

## The short answer, by situation

| Your situation | Safe daily cold email volume |
|---|---|
| Brand-new domain and mailbox (week 1) | 10–20 per day |
| New mailbox, weeks 2–4 (ramping) | 20–50 per day, increasing gradually |
| Warmed mailbox, 1–3 months old | 30–50 per day |
| Established mailbox with strong reply rates | 50–100 per day (with caution above 50) |
| Any mailbox, ever | Never your provider's technical cap |

These numbers are per mailbox. If you need to reach 500 prospects a day, the answer is not one mailbox sending 500 emails — it's ten mailboxes sending 50 each, spread across two or three domains. More on that below.

## Provider caps are not sending limits

The numbers people usually find when they search for sending limits are the providers' technical caps:

| Provider | Technical daily cap | Safe for cold email? |
|---|---|---|
| Google Workspace | 2,000 recipients/day | No — treat ~50/day as the practical cold ceiling |
| Microsoft 365 | ~10,000 recipients/day | No — same practical ceiling applies |
| Free Gmail | 500 recipients/day | Don't send cold email from free Gmail at all |

These caps exist to stop compromised accounts spewing spam. They tell you nothing about what you can send *cold* without damage. A Google Workspace mailbox can technically email 2,000 people today — and if even 1% of cold recipients mark it as spam, that's 20 complaints in a day, which is catastrophic for a mailbox with no reputation. Under the Google and Yahoo bulk-sender rules, sustained spam-complaint rates need to stay under 0.3% (ideally under 0.1%) or your mail starts going to junk wholesale.

So the question isn't "what will Google let me send?" It's "what can this mailbox send before recipients' mail servers stop trusting it?" That number, for cold outreach to people who've never heard of you, is much smaller.

## Reputation is the real limit

Mailbox providers score every sender continuously on signals like:

- **Bounce rate** — sending to dead addresses is the fastest way to look like a spammer. Keep it under 2–3%; under 1% is where you want to live. Verify every address before sending (this is why Velox House SMTP-verifies every contact before it ever enters a campaign).
- **Spam complaints** — the 0.3% threshold in Google and Yahoo's bulk-sender requirements is a hard line. In practice, aim well under 0.1%. At 50 emails a day, a single complaint puts you at 2% for that day, which is why small daily volumes are inherently safer: one bad day averages out.
- **Engagement** — opens, replies, and messages moved out of spam all build reputation. Replies are the strongest positive signal cold email can generate, which is another argument for smaller, better-targeted sends.
- **Sending patterns** — a mailbox that fires 200 identical emails at 9:00:00 looks like a bot. One that sends 40 varied messages spread across the working day looks like a person.
- **Authentication** — SPF, DKIM and DMARC are now mandatory for bulk senders under the Google/Yahoo rules. Without them, volume is irrelevant; you're going to spam anyway. Our [cold email deliverability guide](/blog/cold-email-deliverability-guide/) covers the full setup, and you can check your domain free at [/tools](/tools) — no signup needed.

None of these signals care about your provider's cap. All of them punish sudden volume from an unproven sender. Which is why warm-up matters.

## The week-by-week ramp schedule

If your domain and mailbox are new (or the mailbox has never sent cold email), ramp like this:

| Week | Daily cold sends per mailbox | What else to do |
|---|---|---|
| Week 0 (before any cold sends) | 0 | Set up SPF/DKIM/DMARC. Send genuine 1:1 emails to colleagues, suppliers, contacts — get replies |
| Week 1 | 10–15 | Only verified addresses. Watch bounces daily |
| Week 2 | 15–25 | Increase by ~5/day every few days if bounces stay under 2% |
| Week 3 | 25–40 | Add a second sending window (morning + afternoon) |
| Week 4 | 40–50 | You're at cruising altitude. Hold here |
| Ongoing | ~50 | Scale further with more mailboxes, not more per mailbox |

Three rules make the ramp work:

1. **Never jump.** Going from 20 to 60 overnight is exactly the pattern spam filters are trained to catch. Increase in small steps and hold each level for a few days.
2. **If metrics wobble, drop back.** Bounces above 2–3% or any spam complaint: halve your volume, fix the list quality, and re-ramp. Pushing through a reputation dip makes it permanent.
3. **A new domain needs age as well as volume.** Even a perfect ramp can't fully compensate for a domain registered last Tuesday. If you can, register domains two to four weeks before you need them and let authenticated, human email flow first.

## What about warm-up tools?

Automated warm-up services — networks of inboxes that send each other emails, open them, and rescue them from spam — were standard practice for years. Two things have changed.

First, Google has publicly discouraged third-party automated warm-up, and its bulk-sender guidance targets artificial engagement patterns. Providers have become good at spotting warm-up networks: the same pool of inboxes exchanging templated messages is a detectable fingerprint, and mail from accounts identified as part of one can be penalised rather than helped.

Second, they were always a proxy for the real thing. Genuine engagement — actual prospects opening and replying — builds reputation that no simulated network can fake.

The pragmatic position for 2026: automated warm-up is a diminishing-returns, non-zero-risk tactic. The safer substitutes are the boring ones — a gradual manual ramp, real 1:1 email in the mailbox's early weeks, ruthless list verification, and copy that earns replies (see our [templates that get replies](/blog/cold-email-templates-that-get-replies/) for what that looks like). If you do use warm-up tooling, treat it as a supplement to a slow ramp, never a licence to skip it.

## Scaling: more mailboxes beats more volume

Once a mailbox is cruising at ~50/day, resist the urge to push it to 100. Instead, add capacity horizontally:

- **Multiple mailboxes per domain.** Two or three sending mailboxes on one domain is fine (e.g. tom@, sales@, hello@). Each ramps independently.
- **Secondary domains.** For real scale, buy lookalike domains (yourcompany-hq.co.uk, tryyourcompany.co.uk) and send cold outreach from those, keeping your primary domain's reputation pristine for deliverable transactional and reply traffic. Each new domain gets its own full warm-up.
- **Do the maths from your goal backwards.** Want 20 meetings a month? At typical cold reply and conversion rates that's usually a few thousand sends a month — 3–4 mailboxes at 50/day covers it comfortably. You rarely need as much volume as you think if targeting and copy are good.

This is the model Velox House is built around: every plan includes unlimited email sending with multiple mailboxes (from 2 on Starter up to 25 on Agency), and the platform staggers sends naturally across the day in safe windows rather than blasting, so each mailbox stays inside human-looking patterns while total volume scales. You describe your ideal customer in one prompt; Velox AI finds and verifies the leads, writes the personalised emails, and drips them out daily from your own Google, Microsoft 365 or SMTP inbox.

## Send like a human, on human hours

Two habits keep a mailbox looking like a person regardless of volume:

- **Spread sends across the day.** 50 emails between 8:30 and 17:00 with irregular gaps, not a batch at 9am. Randomised intervals of a few minutes between sends are ideal.
- **Send in the recipient's working hours, on working days.** Tuesday–Thursday mid-morning is the classic window; the more important point is *not* sending at 3am on a Sunday, which both hurts engagement and flags automation.

Pace matters on other channels too — LinkedIn enforces its own norms, with connection requests capped around 100 per week for most accounts. If you're weighing up where to put your daily allowance, our [cold email vs LinkedIn outreach](/blog/cold-email-vs-linkedin-outreach/) comparison breaks down when each channel wins.

## Signs you're sending too much

Watch these numbers weekly, and act on them immediately:

- **Bounce rate above 2–3%.** Your list quality is the problem. Stop, verify everything, remove catch-all and role addresses you can't confirm.
- **Spam complaint rate approaching 0.1–0.3%.** You're over the Google/Yahoo line or heading for it. Cut volume, tighten targeting, and make sure every email has a working opt-out. (Cold email to business recipients is lawful in the UK if you do it properly — see [is cold email legal in the UK](/blog/is-cold-email-legal-uk/).)
- **Open rates falling off a cliff.** A sudden drop from healthy to near-zero usually means you've hit the spam folder, not that your subject lines got worse overnight.
- **Replies drying up while sends stay constant.** Same signal, softer version.
- **Gmail "unusual activity" warnings or provider throttling.** The provider is telling you directly. Listen.

The recovery playbook is always the same: halve volume (or pause), fix the underlying cause, send only to your most engaged, best-verified segment for two weeks, then re-ramp slowly.

## Frequently asked questions

### How many cold emails can I send per day from a new Gmail or Google Workspace account?

Start at 10–20 per day and increase gradually over three to four weeks to around 50 per day. Google Workspace technically allows 2,000 recipients a day, but that is an anti-abuse cap, not a safe cold-email volume — a new account sending hundreds of cold emails will be flagged long before reaching it.

### How long does it take to warm up a new email domain?

Plan for three to four weeks of gradual ramping before a new domain and mailbox reach a sustainable ~50 cold emails per day, and ideally register the domain two to four weeks before you start so it has some age. Set up SPF, DKIM and DMARC before sending anything, and begin with genuine one-to-one emails that get replies.

### Can I just use a warm-up tool instead of ramping manually?

It's risky to rely on one. Google has discouraged automated warm-up networks and providers can detect pools of inboxes artificially engaging with each other, which can hurt rather than help. A manual ramp with verified lists and reply-worthy copy builds real reputation; if you use warm-up tooling at all, treat it as a supplement, not a shortcut.

### What's the maximum safe cold email volume per mailbox?

Around 50 cold emails per mailbox per day is the widely used ceiling for sustained cold outreach; well-established mailboxes with strong engagement can stretch towards 100, but returns diminish and risk rises. To send more, add mailboxes and secondary domains — ten mailboxes at 50/day is far safer than one at 500.

### What bounce rate and spam complaint rate are acceptable?

Keep bounces under 2–3% (under 1% is the real target) and spam complaints under 0.1%, staying well clear of the 0.3% threshold in Google and Yahoo's bulk-sender requirements. Verifying every address before sending is the single biggest lever on bounces, which is why verification-first platforms exist.

### Does sending time of day affect deliverability?

Indirectly, yes. Sending during the recipient's working hours improves engagement, and engagement builds sender reputation; blasting at identical times or in the middle of the night looks automated and earns fewer opens. Spread sends across the working day with irregular gaps rather than batching them.
