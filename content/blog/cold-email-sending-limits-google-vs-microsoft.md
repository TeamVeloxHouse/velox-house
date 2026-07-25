---
title: Cold Email Sending Limits – Google Workspace vs Microsoft 365 (2026)
description: Google Workspace caps you at 2,000 recipients a day, Microsoft 365 at 10,000. Here are the real limits, the safe cold volumes, and which to pick.
date: 2026-07-25
category: Deliverability
---
Google Workspace lets each mailbox send to 2,000 recipients in a rolling 24-hour period (500 for free Gmail, 500 for Workspace trial accounts), while Microsoft 365 allows 10,000 recipients per day at a maximum of 30 messages per minute. Those are the hard caps — but they are not cold email budgets. Both providers will throttle, junk or suspend accounts that push anywhere near those numbers with unsolicited mail, and in practice a safe cold email volume is around 30–50 sends per mailbox per day on either platform. The right way to scale is more mailboxes, not more volume per mailbox.

## The official limits at a glance

| Limit | Free Gmail | Google Workspace (paid) | Microsoft 365 / Exchange Online |
|---|---|---|---|
| Recipients per 24 hours | ~500 | 2,000 (500 on trial) | 10,000 |
| Unique recipients per day | ~500 | 3,000 (max 2,000 external) | 10,000 (no separate external cap) |
| Recipients per single message | ~500 | 2,000 (max 500 external) | Customisable, up to 1,000 |
| Rate limit | — | — | 30 messages per minute |
| Via SMTP client (per message) | 100 | 100 | Counts toward the same limits |
| Reset window | Rolling 24 hours | Rolling 24 hours | Rolling 24 hours |
| Penalty for exceeding | Sending blocked up to 24h | Sending blocked up to 24h | Sending blocked until usage drops below the cap |

Two things worth stressing before we go deeper. First, these are anti-abuse ceilings, not recommendations — Google's own documentation tells bulk senders to use a dedicated email service, and Microsoft says the same. Second, both providers count *recipients*, not messages: one email to 20 people burns 20 of your daily allowance.

## Google Workspace limits in detail

The headline number for a paid Google Workspace mailbox is **2,000 messages per rolling 24 hours**. But several sub-limits matter more for cold outreach:

- **Unique external recipients: 2,000 per day.** You can contact up to 3,000 unique recipients daily, but only 2,000 of them can be outside your organisation. For cold email, this is the binding cap.
- **Per-message counting.** Every address in To, Cc and Bcc counts individually against your daily totals. Mail-merge sends are capped lower still, at 1,500 per day.
- **Trial and new accounts get much less.** Trial Workspace accounts are limited to 500 messages a day, and the limits are not raised during the trial. Even after converting to a paid plan, Google keeps limits reduced until the account has accumulated roughly $100 in payments, and lifting them can take up to 75 days after that threshold. A brand-new Workspace domain simply cannot send at full quota on day one — which conveniently matches what good [warm-up practice](/blog/does-email-warmup-still-work/) tells you to do anyway.
- **Exceed the cap and you're locked out.** Gmail blocks sending from the account for up to 24 hours. You keep inbox access, but your campaign stops dead.

Free @gmail.com accounts sit around 500 recipients per day and lack the domain-level authentication (your own SPF, DKIM and DMARC records) that cold email requires — they are not a serious option for outreach, and Google's bulk-sender rules effectively rule them out anyway.

## Microsoft 365 limits in detail

Exchange Online's limits are the same across essentially every business plan — Microsoft 365 Business Basic, Standard and Premium, and the Enterprise E1/E3/E5 tiers all get:

| Feature | Limit |
|---|---|
| Recipient rate limit | 10,000 recipients per day, per mailbox |
| Message rate limit | 30 messages per minute (SMTP submission above this is rejected for retry) |
| Recipients per message | Customisable by the admin, up to 1,000 |
| External recipient cap | None (a planned 2,000/day limit was cancelled) |

That last row deserves a note, because you will still find articles citing it as fact. In 2024 Microsoft announced a **mailbox external recipient rate limit of 2,000 external recipients per 24 hours**, intended to bring Exchange Online closer to Google's model. After sustained customer pushback the rollout was postponed, and in January 2026 Microsoft cancelled the feature entirely. As of mid-2026, the per-mailbox cap remains 10,000 recipients per day with no separate external ceiling.

The limits are hard limits enforced at the service level — Microsoft support cannot raise them. And as with Google, Microsoft's documentation is explicit that bulk commercial email should go through a specialist service, not Exchange Online mailboxes. On paper Microsoft gives you five times Google's allowance; in practice, for cold email, that difference is irrelevant — as we'll see next.

## Official caps vs safe cold email volumes

Hitting provider limits is almost never what kills a cold email programme. What kills it is inbox providers' filtering — which reacts to your volume patterns, spam complaints and engagement long before you approach 2,000 sends a day.

| | Official daily cap | Realistic safe cold volume |
|---|---|---|
| Google Workspace mailbox | 2,000 recipients | ~30–50 cold sends/day |
| Microsoft 365 mailbox | 10,000 recipients | ~30–50 cold sends/day |

Why so much lower? A normal human sends a few dozen emails a day at irregular intervals and gets replies. A mailbox firing hundreds of identical-length messages at strangers looks like exactly what it is, and both providers profile sending behaviour per mailbox and per domain. The full reasoning — warm-up curves, ramp schedules, recovery when reputation dips — is in our guide to [how many cold emails you can send per day](/blog/how-many-cold-emails-per-day/); the short version is to treat 50 per mailbox per day as a ceiling and never let the provider cap fool you into thinking thousands from one inbox is survivable.

## Bulk-sender rules: authentication is no longer optional

Both providers now enforce formal requirements on high-volume senders, and they matter even if you never send 5,000 emails a day, because they describe what the filters reward.

**Google** announced its bulk-sender rules in October 2023 and began enforcing them in February 2024. Anyone sending 5,000+ messages a day to Gmail addresses must authenticate with SPF, DKIM and DMARC, offer one-click unsubscribe on marketing mail, and keep spam complaint rates below 0.3% (ideally under 0.1%). Below that threshold you still need SPF or DKIM at minimum — unauthenticated mail to Gmail is increasingly rejected outright.

**Microsoft followed in 2025**, announcing that from May 2025 senders of 5,000+ messages a day to its consumer domains (outlook.com, hotmail.com, live.com) must have SPF, DKIM and DMARC in place, with non-compliant mail routed to junk and eventually rejected.

The practical takeaway for a UK sales team: SPF, DKIM and DMARC on your sending domain are table stakes on both platforms, and your spam complaint rate is the metric that ends careers. You can check your domain's records in about a minute with the free deliverability checker at [/tools](/tools) — no signup needed. For the full setup walkthrough, see the [cold email deliverability guide](/blog/cold-email-deliverability-guide/).

## Gmail or Outlook: which is better for cold email?

Honestly: both are fine, and neither gives you a meaningful edge once your domain is authenticated and your volume is sane. The decision usually follows what your business already runs:

- **Already on Google Workspace or Microsoft 365?** Stay there. Your primary domain has established reputation, and adding secondary sending domains alongside it is straightforward on either.
- **Sending mostly to Microsoft-hosted companies?** Filtering is driven far more by authentication, content and engagement than by provider affinity, so don't switch platforms chasing an Outlook-to-Outlook edge — but if you're starting from zero and your market is heavily corporate UK (which skews Microsoft 365), it's a reasonable tiebreaker.
- **Admin friction** differs slightly: Google's new-account throttling means fresh Workspace tenants ramp slower; Microsoft's 30 messages/minute rate limit means your sending tool must pace sends — any competent platform does.

What actually matters is the layer on top: verified lists, gradual ramp-up, staggered human-like sending, and stopping when someone replies. This is where tooling earns its keep — Velox House, for instance, connects Google, Microsoft 365 or any SMTP mailbox, checks your SPF/DKIM/DMARC before you send, and automatically staggers daily sends inside safe windows so no mailbox ever behaves like a blaster, whichever provider it lives on.

## Scaling: more mailboxes, not more volume

Since the safe cold ceiling (~50/day) sits far below either provider's cap, scaling volume means adding mailboxes, not pushing one inbox harder:

1. **Buy 1–3 secondary domains** similar to your brand (yourcompany-hq.co.uk, tryyourcompany.co.uk). Never send cold from your primary domain — it's the one you can't afford to burn.
2. **Set up 2–3 mailboxes per domain**, each with SPF, DKIM and DMARC configured.
3. **Warm each mailbox for 2–4 weeks**, ramping from ~10 to ~50 sends a day.
4. **Rotate sending across mailboxes** so each stays within its safe budget while total daily reach grows: six mailboxes × 40 sends is 240 quality emails a day — more than most SMB teams can handle replies for.

If a mailbox's reputation degrades, you pause it and let the others carry on, rather than watching your entire outbound channel go dark. This is also why every serious [cold email platform](/blog/best-cold-email-software-2026/) supports multiple connected mailboxes — Velox House includes 2 mailboxes on its £19.99 Starter plan and up to 25 on Agency, with sends distributed across them on autopilot once you've approved the campaign.

## A brief note on SMTP vs API sending

How your tool connects changes some sub-limits but not the daily caps. On Google, the Gmail API allows up to 500 recipients per message while SMTP/IMAP submission allows 100 — both irrelevant for one-to-one cold email, where every send has a single recipient. On Microsoft, SMTP AUTH submission is subject to the 30 messages/minute rate limit, so tools must queue and pace; API sending is throttled separately, but the 10,000 recipients/day cap applies either way. And if you connect a generic SMTP mailbox from another host, the limits are whatever that host imposes — often stricter than Google or Microsoft, so check before building a campaign on one.

## Frequently asked questions

### What is the Google Workspace email sending limit?

A paid Google Workspace mailbox can send to 2,000 recipients per rolling 24-hour period, with a sub-limit of 2,000 unique external recipients per day. Trial accounts are capped at 500, and new paid accounts keep reduced limits until roughly $100 of cumulative billing, which can take up to 75 days to clear. Exceeding the cap blocks sending from that mailbox for up to 24 hours.

### What is the Microsoft 365 email sending limit?

Exchange Online mailboxes on all business and enterprise plans can send to 10,000 recipients per day, at a maximum rate of 30 messages per minute, with up to 1,000 recipients on a single message (admin-configurable). These are hard service-level limits that Microsoft support cannot increase.

### Did Microsoft introduce a 2,000 external recipient limit?

No — it was announced but never shipped. Microsoft planned a mailbox external recipient rate limit of 2,000 external recipients per 24 hours, postponed it after customer feedback, and cancelled it entirely in January 2026. The per-mailbox limit remains 10,000 recipients per day with no separate external cap.

### How many cold emails can I safely send per day from one mailbox?

Around 30–50 per mailbox per day, on either Google or Microsoft, after a 2–4 week warm-up ramp. The provider caps (2,000 and 10,000) are anti-abuse ceilings, not safe operating levels — mailboxes sending hundreds of cold emails daily get filtered or suspended long before reaching them. Scale by adding warmed mailboxes on secondary domains, not by pushing one inbox harder.

### Is Gmail or Outlook better for cold email?

Neither has a decisive deliverability advantage once your domain has SPF, DKIM and DMARC configured and your volume stays in the safe range. Most teams should simply use whichever platform their business already runs, since the existing domain reputation and admin setup carry over. Tools like Velox House work identically with Google, Microsoft 365 or any SMTP mailbox.

### Do Google's bulk-sender rules apply to cold email?

The formal thresholds (one-click unsubscribe, sub-0.3% spam rate) apply to senders of 5,000+ daily messages to Gmail, which a properly run cold campaign never approaches per domain. But the underlying requirements — SPF, DKIM and DMARC authentication and a low complaint rate — are effectively mandatory at any volume, because both Google and Microsoft filter unauthenticated mail aggressively. Check your domain free at /tools.
