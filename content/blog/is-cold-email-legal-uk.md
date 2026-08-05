---
title: Is Cold Email Legal in the UK? PECR and GDPR Rules Explained
description: Yes — B2B cold email is legal in the UK under PECR. Learn the corporate vs individual subscriber rule, your UK GDPR duties, and get a compliance checklist.
date: 2026-07-25
category: Legal
---
Yes — cold email is legal in the UK for business-to-business outreach. Under the Privacy and Electronic Communications Regulations (PECR), the consent rule for marketing emails only protects "individual subscribers", so you can email corporate subscribers — limited companies, LLPs and PLCs — without prior consent. Sole traders and ordinary partnerships are treated like individuals, so they need consent or an existing customer relationship. UK GDPR still applies to the personal data you use (a name, a work email address), which means you need a lawful basis — usually legitimate interests — plus honest sender details and an easy opt-out that you honour promptly.

> **This is not legal advice.** It's a plain-English explainer written for founders and sales teams, based on PECR, UK GDPR and published ICO guidance. If you're making decisions with real legal exposure, speak to a solicitor.

## The two laws that govern cold email in the UK

UK cold email sits at the intersection of two laws, and most of the confusion comes from mixing them up:

**PECR (Privacy and Electronic Communications Regulations 2003)** deals specifically with electronic marketing. Regulation 22 is the part that matters for cold email: you must not send unsolicited marketing email to an *individual subscriber* without consent (or the "soft opt-in", which only covers existing customers). Crucially, that rule does not extend to *corporate subscribers*.

**UK GDPR** is the general data protection law. It doesn't ban cold email — it regulates how you handle *personal data*. A prospect's name and work email address are personal data even in a business context, so UK GDPR applies whenever you collect, store or use them.

PECR answers "am I allowed to send this email at all?"; UK GDPR answers "am I handling this person's data properly while I do it?". For B2B cold email to a limited company, the PECR answer is yes — but you still have to pass the GDPR test.

## Corporate vs individual subscribers: the distinction that decides everything

PECR's consent requirement hinges on who the "subscriber" is — that is, who contracts for the email service — not on whether the message is B2B or B2C in tone.

| Recipient type | PECR status | Consent needed before emailing? |
|---|---|---|
| Limited company (Ltd or PLC) | Corporate subscriber | No |
| Limited liability partnership (LLP) | Corporate subscriber | No |
| Scottish partnership | Corporate subscriber | No |
| Government body / public sector | Corporate subscriber | No |
| Sole trader | Individual subscriber | Yes (or soft opt-in) |
| Ordinary partnership (England, Wales, NI) | Individual subscriber | Yes (or soft opt-in) |
| Consumer / personal address (e.g. @gmail.com) | Individual subscriber | Yes (or soft opt-in) |

Two practical consequences follow:

**You can cold email people at limited companies.** An email to `jane.smith@acmeltd.co.uk` about your product is lawful under PECR without prior consent, because the subscriber is Acme Ltd — a corporate body. The ICO's own business-to-business guidance confirms the Regulation 22 consent rule does not apply to corporate subscribers.

**You cannot cold email sole traders and ordinary partnerships as if they were companies.** A plumber trading under their own name, a freelancer, an unincorporated partnership — PECR treats them like consumers, and emailing them without consent is likely to breach Regulation 22 even though your pitch is business-related. If your market includes very small businesses, check the legal form before you send: an unincorporated one comes off the cold list.

One nuance: even for corporate subscribers, the ICO says it's good practice to honour opt-outs from individual employees, and some commentators treat named work addresses more cautiously than generic ones (`info@`, `sales@`). The safe policy is to treat every opt-out as final, whoever it comes from.

## UK GDPR: what you owe the person behind the email address

Passing the PECR test gets your email out of the door. UK GDPR governs everything around it, because a named work address identifies a person — and that makes it personal data. In practice you need:

**A lawful basis — almost always legitimate interests.** You don't need consent under UK GDPR to process business contact data for B2B marketing; legitimate interests is the recognised route. But it isn't a magic phrase: record a Legitimate Interests Assessment (LIA), a short three-part test covering what your interest is, whether the processing is necessary, and whether it's overridden by the individual's rights. Targeted, relevant outreach to decision-makers whose role matches your offer passes far more comfortably than scraping and blasting tens of thousands of addresses.

**Transparency.** When you haven't collected data from the person directly, UK GDPR expects you to provide privacy information — who you are, why you have their data, where you got it — at the latest when you first contact them. A privacy policy link in your email footer is the standard way to handle this.

**Accuracy and data minimisation.** Keep only the data you need, keep it accurate, and don't hoard stale lists. Bought lists of unknown provenance are a GDPR risk as well as a deliverability disaster — see our [cold email deliverability guide](/blog/cold-email-deliverability-guide/) for why verification matters as much as compliance.

**An absolute right to object.** Under Article 21, anyone can object to direct marketing at any time and you must stop — no exceptions. Maintain a suppression list so an opted-out contact never resurfaces when you import a new batch.

## What a compliant UK cold email actually looks like

PECR Regulation 23 adds two hard requirements to every marketing email: don't disguise or conceal your identity, and provide a valid address the recipient can use to opt out. Layer the GDPR duties on top and you get a practical checklist:

| Requirement | What it means in practice | Source |
|---|---|---|
| Identify yourself | Real name, real company, no spoofed sender details | PECR Reg 23 |
| Valid contact address | A working reply-to or postal address for opt-outs | PECR Reg 23 |
| Honest subject line | No misleading subjects ("Re:" on a first touch, fake invoices) | PECR / CAP Code |
| Easy opt-out, honoured promptly | One-step unsubscribe or "reply to opt out"; suppress permanently | PECR / UK GDPR Art 21 |
| Lawful basis + recorded LIA | Legitimate interests assessment on file before you send | UK GDPR Art 6 |
| Privacy information available | Footer link to a privacy policy explaining the processing | UK GDPR Art 14 |
| Right recipients | Corporate subscribers only; sole traders and ordinary partnerships excluded unless consented | PECR Reg 22 |
| Accurate, relevant data | Verified addresses, role-relevant targeting, no stale bought lists | UK GDPR Art 5 |

None of this conflicts with writing emails that get replies — quite the opposite. Clear identity, relevant targeting and low volume are what good outreach looks like anyway; our guide to [cold email templates that get replies](/blog/cold-email-templates-that-get-replies/) and the numbers in [how many cold emails per day](/blog/how-many-cold-emails-per-day/) both point the same direction as the law.

Tooling helps too. Velox House, a UK-built AI outreach platform, bakes several of these requirements into the workflow: every contact is SMTP-verified before import (accuracy), sending happens from your own Google, Microsoft 365 or SMTP inbox under your real identity (Regulation 23), replies stop the sequence automatically, and the free [deliverability checker](/tools) confirms your SPF, DKIM and DMARC are in order — which Google and Yahoo now require of bulk senders in any case.

## ICO enforcement: what actually happens to rule-breakers

The Information Commissioner's Office enforces both PECR and UK GDPR. The realistic picture for B2B senders:

- Historically, PECR fines were capped at £500,000, and the ICO's marketing enforcement has overwhelmingly targeted mass consumer spam — not measured B2B outreach to companies.
- That cap is changing. The Data (Use and Access) Act 2025 aligns PECR penalties with UK GDPR levels — up to £17.5 million or 4% of global turnover — with the new fining powers commencing in phases. Electronic marketing breaches are being taken more seriously, not less.
- Complaints drive enforcement. A sender doing relevant, honest, low-volume B2B outreach with working opt-outs is simply not the profile that attracts attention; a sender blasting bought lists with no unsubscribe is.

Compliance and deliverability fail together: the behaviours that breach PECR — hidden identity, no opt-out, indiscriminate volume — are the same ones that get you spam-foldered. Fixing one fixes the other.

## How the UK compares with the EU and the US

**The UK is one of the more permissive B2B regimes in Europe.** The EU's ePrivacy Directive lets each member state choose whether to extend the consent requirement to corporate subscribers, and several — Germany and Austria among them — effectively require consent even for B2B email. If you're prospecting into the EU, check the rules country by country rather than assuming the UK position travels.

**The US is more permissive still.** CAN-SPAM is an opt-out regime: no prior consent is required, but you must avoid deceptive headers and subject lines, include a physical postal address, and honour unsubscribes within ten business days.

Your home market allows compliant cold outreach at meaningful scale — partly why cold email remains such a strong UK channel; see [cold email vs LinkedIn outreach](/blog/cold-email-vs-linkedin-outreach/) for how the two compare.

## The bottom line

B2B cold email is legal in the UK — but "legal" assumes you do it properly: corporate subscribers only, honest identity, working opt-out, a recorded legitimate-interests basis, and accurate, relevant data. That happens to be the exact recipe for outreach that lands in inboxes and gets replies.

If you'd rather have the compliant mechanics handled for you — verified contacts, own-inbox sending, automatic reply-stopping, deliverability checks — [Velox House](/features) runs the whole workflow from a single prompt, with a [plans from £19.99/month](https://hub.veloxhouse.co.uk/signup) and plans from £19.99/month.

## Frequently asked questions

### Is cold email illegal in the UK?

No. Cold email to corporate subscribers — limited companies, LLPs, PLCs and public bodies — is legal in the UK without prior consent under PECR Regulation 22. Cold email to individual subscribers, which includes consumers, sole traders and ordinary partnerships, does require consent or the soft opt-in. UK GDPR applies to the personal data either way, so you still need a lawful basis, honest sender details and a working opt-out.

### Do I need consent to email someone's work email address?

Not if their employer is a corporate subscriber such as a limited company — PECR's consent rule doesn't apply to emails sent to corporate bodies, including named work addresses. You still owe the individual their UK GDPR rights: a legitimate-interests basis, access to privacy information, and an absolute right to object to marketing, honoured immediately.

### Can I cold email sole traders in the UK?

Not without consent. PECR treats sole traders and ordinary (non-LLP, non-Scottish) partnerships as individual subscribers, the same as consumers, so unsolicited marketing email to them is likely to breach Regulation 22 unless they've consented or qualify under the soft opt-in. If your market includes micro-businesses, check whether each one is incorporated before adding it to a cold list.

### What is the soft opt-in?

The soft opt-in is a PECR exception letting you email individual subscribers without fresh consent if you collected their details during a sale or sales negotiation, you're marketing your own similar products, and you offered an opt-out at collection and in every message since. It only covers existing customers and genuine sales prospects — it never applies to cold contacts you've researched or bought.

### Can the ICO fine me for cold emailing businesses?

The ICO can fine for PECR breaches — historically up to £500,000, and the Data (Use and Access) Act 2025 raises the maximum to UK GDPR levels of £17.5 million or 4% of global turnover as its provisions commence. In practice, enforcement has focused on large-scale unlawful marketing to consumers, not targeted B2B outreach to companies. Honest, relevant, opt-out-respecting B2B email is not the profile that attracts regulatory action.

### Does GDPR ban cold email?

No — this is the most common misconception. UK GDPR doesn't prohibit cold email; it regulates the personal data behind it. You can rely on legitimate interests rather than consent, provided you record an LIA, keep data accurate and minimal, make privacy information available, and stop the moment someone objects.
