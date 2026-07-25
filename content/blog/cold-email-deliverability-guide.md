---
title: "Cold Email Deliverability: The Complete 2026 Guide to Inbox Placement"
description: "Why cold emails land in spam and how to fix it: SPF, DKIM and DMARC in plain English, warm-up, volume ramping and a pre-launch checklist you can run today."
date: 2026-07-25
category: Deliverability
---
Cold emails go to spam for three main reasons: your domain isn't properly authenticated (SPF, DKIM and DMARC), your sending domain has a weak or damaged reputation, or your sending behaviour looks like a spammer's — sudden volume spikes, high bounce rates and messages nobody opens. Fix authentication first, warm up gradually, keep your spam-complaint rate under 0.3%, and send genuinely relevant emails, and the vast majority of your outreach will land in the inbox. You can check your domain's SPF, DKIM and DMARC records right now with our [free deliverability checker](/tools) — no signup needed.

This guide explains how spam filtering actually works in 2026, walks through each DNS record in plain English, and finishes with a pre-launch checklist you can work through in an afternoon.

## How spam filtering actually works now

Ten years ago, spam filters were mostly about content: trigger words, dodgy links, too many images. That era is over. Modern filtering at Gmail, Microsoft 365 and Yahoo is driven by **who is sending**, not what the email says. The big inputs, roughly in order of weight:

1. **Authentication.** Does the email cryptographically prove it came from your domain? Unauthenticated bulk mail is now rejected or junked outright by Google and Yahoo.
2. **Domain and IP reputation.** Providers keep a running score for your domain based on bounces, spam complaints, spam-trap hits and sending history. A new domain has no reputation — almost as risky as a bad one.
3. **Engagement signals.** Replies are the strongest positive signal there is; deletes-without-reading and spam reports are the strongest negatives.
4. **Sending behaviour.** Consistent daily volume from a warmed domain looks human. A brand-new domain firing 2,000 emails on day one looks like a compromised account.
5. **Content.** Still a factor, but a distant one — mostly a tiebreaker for domains with thin reputation.

The practical takeaway: deliverability is a reputation game played over weeks, not a copywriting trick applied per email.

### The Google and Yahoo bulk-sender requirements

Since early 2024, Google and Yahoo have enforced formal requirements on anyone sending meaningful volume to their users (Google's stated threshold is 5,000+ messages a day to Gmail, but the rules are best practice at any volume):

- **SPF and DKIM** must both pass, and the domain must publish a **DMARC** policy (at minimum `p=none`).
- The From: domain must **align** with the domain that passes SPF or DKIM.
- **Spam-complaint rate** must stay below 0.3% (ideally below 0.1%) as measured in Google Postmaster Tools.
- Bulk marketing mail needs **one-click unsubscribe** headers; even for cold outreach, a clear opt-out is expected.

Fail these and your mail doesn't get a warning — it gets silently junked or rejected. This is the single biggest reason "my open rates collapsed overnight" threads exist.

## SPF, DKIM and DMARC in plain English

These three DNS records are the foundation of everything else. Each answers a different question a receiving mail server asks.

### SPF — "is this server allowed to send for this domain?"

SPF (Sender Policy Framework) is a TXT record on your domain listing the servers permitted to send email on its behalf. When Gmail receives a message claiming to be from `you@yourcompany.co.uk`, it checks whether the sending server appears in that record. A typical record for a Microsoft 365 sender:

```
v=spf1 include:spf.protection.outlook.com -all
```

Two things trip people up. You can only have **one** SPF record per domain — every service that sends for you goes in the same record as an `include:`. And SPF has a **10 DNS lookup limit**; stack too many includes and the record fails entirely.

### DKIM — "was this email actually signed by the domain, and is it untampered?"

DKIM (DomainKeys Identified Mail) adds a cryptographic signature to every outgoing email. Your mail provider holds a private key; you publish the matching public key in DNS. Receiving servers verify the signature, proving the message really came from your domain and wasn't altered in transit.

DKIM matters even more than SPF because it **survives forwarding** (SPF breaks when a message is forwarded). You enable it in your provider's admin console — Google Workspace and Microsoft 365 both generate the record; you just paste it into DNS. If you've never done this, there's a fair chance DKIM is not enabled on your domain right now. It takes ten minutes.

### DMARC — "what should receivers do when SPF/DKIM fail, and tell me about it"

DMARC (Domain-based Message Authentication, Reporting and Conformance) ties the other two together. It's a TXT record at `_dmarc.yourdomain.co.uk` that tells receiving servers: check the From: address aligns with whichever of SPF/DKIM passed, apply this policy if neither does, and send me aggregate reports. A sensible starting record:

```
v=DMARC1; p=none; rua=mailto:dmarc-reports@yourdomain.co.uk
```

`p=none` means "don't punish failures yet, just report them" — enough to satisfy Google and Yahoo's minimum requirement. Once your reports show all legitimate mail passing, tighten to `p=quarantine` and eventually `p=reject`, which also stops other people spoofing your domain.

| Record | What it proves | Where it lives | Common mistake |
|---|---|---|---|
| SPF | Sending server is authorised | TXT record on root domain | Two SPF records, or >10 lookups |
| DKIM | Message signed by domain, untampered | TXT record at a selector subdomain | Never enabled at all |
| DMARC | From: domain aligns; sets failure policy | TXT record at `_dmarc.` subdomain | Missing entirely, or `p=reject` before checking reports |

Not sure what your domain currently publishes? The [Velox House deliverability checker](/tools) reads your SPF, DKIM and DMARC records and tells you what's missing in plain English — free, no signup.

## Warm-up, done sensibly

A domain (or mailbox) with no sending history is treated with suspicion. Warm-up is simply building history gradually.

- **Start tiny.** 10–20 cold emails per mailbox per day in week one is plenty. Real replies during this phase are gold — they teach providers that people want your mail.
- **Ramp gradually.** Increase by roughly 10–20% every few days, not double overnight. A sensible ceiling for one mailbox is around 30–50 cold sends a day even fully warmed — the reasoning is in [how many cold emails you should send per day](/blog/how-many-cold-emails-per-day/).
- **Send some genuinely engaged mail.** Emailing colleagues, partners and existing contacts from the same mailbox is the best warm-up there is.
- **Keep sending consistently.** Reputation decays with silence; a mailbox that goes quiet for three weeks then blasts 200 emails looks worse than one sending 25 every weekday.

**Be careful with automated warm-up networks** — pools of accounts that open, reply to and "rescue" each other's emails. Google has explicitly discouraged artificial engagement schemes, and several major sending platforms have withdrawn their warm-up pools. A short, modest warm-up plus real conversations is safer than months of fake engagement that providers are actively learning to detect.

## Volume ramping and sending behaviour

Once warmed, how you send matters as much as how much:

- **Spread sends across the day.** 40 emails trickled between 9am and 4pm looks human; 40 in one minute looks like a script. Good sending tools stagger automatically.
- **Cap per-mailbox volume, scale with mailboxes.** For more reach, add mailboxes (and eventually domains) rather than pushing one address to 200 a day.
- **Stop on reply.** Continuing a sequence after someone answers is the fastest route to a spam complaint. Any serious platform halts the sequence the moment a prospect replies.
- **Verify before you send.** A hard-bounce rate above ~2% starts damaging reputation, and sustained bounces can get a domain blocklisted. Verify every address at SMTP level — not just syntax — before it enters a campaign. This is why Velox House SMTP-verifies every contact before import; unverified lists are the most common self-inflicted deliverability wound there is.

## Content triggers: less important than you think, not irrelevant

"Spam words" lists are mostly folklore in 2026 — reputation and engagement dominate. But content still influences the margins, especially for domains with thin reputation:

- **Plain text beats HTML.** No tracking-heavy templates, no image-only messages.
- **Go easy on links** — one is fine, five is not, and never use shorteners. Skip attachments in a first email entirely.
- **Write like a person.** Short, specific, personalised emails get replies, and replies are the best deliverability signal available. If your copy needs work, start with [cold email templates that actually get replies](/blog/cold-email-templates-that-get-replies/).
- **Include an opt-out.** A simple "not relevant? tell me and I won't email again" line reduces spam reports — the metric that matters most. It's also expected under UK rules; see [is cold email legal in the UK](/blog/is-cold-email-legal-uk/) for the PECR details.

## Monitor the numbers that matter

You can't manage what you don't measure. Three numbers deserve a weekly look:

| Metric | Healthy | Warning | Action if breached |
|---|---|---|---|
| Hard bounce rate | <2% | 2–5% | Stop, re-verify the list, remove bad addresses |
| Spam-complaint rate | <0.1% | 0.1–0.3% | Tighten targeting, check opt-out visibility |
| Reply rate | >2–3% | <1% | Rework targeting and copy — low engagement erodes reputation |

Set up **Google Postmaster Tools** (free) for complaint-rate and domain-reputation data on mail to Gmail. Watch open rates for *trends* rather than absolutes — bot-opens and privacy features make the raw number unreliable, but a sudden drop across the board usually means a placement problem.

## When to use a secondary sending domain

Serious cold emailers don't send outreach from their main company domain. They buy one or more close variants — `yourcompany-hq.co.uk`, `tryyourcompany.com` — set up authentication and mailboxes there, and keep the primary domain pristine for customer and transactional mail. Use a secondary domain when you're sending more than ~50 cold emails a day, when your main domain also sends invoices or support email you can't afford to jeopardise, or when you want to scale across multiple mailboxes without concentrating risk.

Set each one up properly (SPF, DKIM, DMARC, a redirect to your main site), warm it like a new domain — because it is one — and retire it if its reputation ever takes damage you can't repair. Domains are cheap; a burned primary domain is not.

## Pre-launch deliverability checklist

Run through this before your first campaign — most of it is one-time setup:

| # | Check | How |
|---|---|---|
| 1 | SPF record published, single record, under 10 lookups | Free check at [/tools](/tools) |
| 2 | DKIM enabled and signing | Provider admin console, then verify at [/tools](/tools) |
| 3 | DMARC published (at least `p=none` with reporting) | Add TXT at `_dmarc.`, verify at [/tools](/tools) |
| 4 | Secondary sending domain bought and authenticated (if >50/day) | Registrar + steps 1–3 on the new domain |
| 5 | Mailbox warmed 2–3 weeks, ramped gradually | Start 10–20/day, +10–20% every few days |
| 6 | Every contact SMTP-verified | Verification tool or a platform that verifies pre-import |
| 7 | Sequence stops automatically on reply | Platform setting |
| 8 | Opt-out line in every email | Template |
| 9 | Google Postmaster Tools connected | postmaster.google.com |
| 10 | Test send to your own Gmail/Outlook — check headers show SPF, DKIM, DMARC all pass | "Show original" in Gmail |

If you'd rather not manage all this by hand, this is the layer Velox House handles for you: it checks your SPF/DKIM/DMARC, runs a pre-send spam check on every email, verifies every contact before import, and sends at a naturally paced daily cadence from your own Google, Microsoft 365 or SMTP inbox. Plans start at £19.99/month with a 21-day free trial ([pricing](/#pricing)), and the [deliverability checker](/tools) is free either way. For a wider look at tooling, see the [best cold email software for 2026](/blog/best-cold-email-software-2026/) roundup.

## Frequently asked questions

### Why are my cold emails suddenly going to spam?

The usual culprits: a recent volume spike, a bad list causing bounces, broken authentication (a DNS change can silently break SPF or DKIM), or spam complaints crossing Google's 0.3% threshold. Check authentication first with a [free deliverability test](/tools), then review recent bounce and complaint data in Google Postmaster Tools.

### Do I need SPF, DKIM and DMARC for cold email?

Yes — all three. Google and Yahoo's bulk-sender requirements, enforced since 2024, expect SPF and DKIM to pass with an aligned From: domain, plus a published DMARC policy. Mail failing these is junked or rejected regardless of how good the email is, and even below the formal 5,000/day threshold, unauthenticated bulk-ish mail is treated with heavy suspicion.

### How long should I warm up a new domain before cold outreach?

Two to four weeks is a sensible window. Start at 10–20 emails per mailbox per day, increase by 10–20% every few days, and mix in real correspondence with people who will reply. A new domain with zero history sending hundreds of emails on day one is the fastest way to start life on a blocklist.

### What spam-complaint rate is safe?

Keep it under 0.1%, and never let it cross 0.3% — Google's hard threshold for bulk senders, above which Gmail placement deteriorates sharply. In practice that means tight targeting and a clear opt-out line so annoyed recipients reply "no thanks" instead of hitting the spam button.

### Should I send cold email from my main company domain?

Not at meaningful volume. Use a lookalike secondary domain for outreach so any reputation damage is contained, while your primary domain stays clean for customer and transactional email. Authenticate and warm the secondary domain exactly as you would your main one.

### Do spam trigger words still matter in 2026?

Far less than domain reputation and engagement, but they're not entirely dead. Content acts as a tiebreaker: a trusted domain can say "free" without issue, while a cold domain gets less benefit of the doubt. Fix authentication and list quality first; a pre-send spam check catches the genuinely risky content patterns.
