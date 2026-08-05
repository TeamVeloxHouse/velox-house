---
title: Legitimate Interest Assessment Template for Cold Email (UK Guide)
description: A practical LIA template for UK cold email — the three-part test in plain English, example answers you can copy, and what the ICO expects if they ask.
date: 2026-07-25
category: Legal
---

A legitimate interest assessment (LIA) is a short written document showing you have applied the three-part test in UK GDPR Article 6(1)(f) — purpose, necessity and balancing — before processing someone's personal data without their consent. If you send B2B cold email in the UK, legitimate interest is almost certainly the lawful basis you are relying on, and the ICO expects you to have done the assessment and kept the outcome on file. This guide explains the test in plain English and gives you a complete worked LIA template you can copy, adapt and store today.

*This article is general information, not legal advice. If you process data at scale or in unusual ways, speak to a data protection professional.*

## What a legitimate interest assessment actually is

UK GDPR requires a lawful basis for any processing of personal data — and a work email address like `jane.smith@company.co.uk` is personal data, because it identifies a person. Of the six lawful bases, the one that fits B2B cold outreach is **legitimate interests** (Article 6(1)(f)): processing necessary for your legitimate business interests, provided those interests are not overridden by the rights and freedoms of the person concerned.

The catch is the word *provided*. Legitimate interest is flexible, but it comes with a built-in obligation to weigh your interest against the individual's — and the LIA is how you show you did that weighing. The ICO breaks it into three parts:

1. **Purpose test** — are you pursuing a legitimate interest?
2. **Necessity test** — is the processing necessary for that purpose?
3. **Balancing test** — do the individual's interests, rights and freedoms override yours?

Strictly, UK GDPR does not name the LIA as a mandatory document. But the accountability principle (Article 5(2)) requires you to be able to *demonstrate* compliance, and the ICO's guidance is blunt: do the three-part test and record the outcome. An LIA that took twenty minutes to write is the difference between "we considered this properly" and "we hoped nobody would ask."

Note that the LIA covers the **data protection** side only. Whether you can lawfully *send* the email is a separate question governed by PECR — covered in our full guide to [whether cold email is legal in the UK](/blog/is-cold-email-legal-uk/). You need both to line up.

## The three-part test in plain English

### 1. Purpose test — is your interest legitimate?

Almost any genuine commercial interest can qualify. Recital 47 of the GDPR says explicitly that direct marketing "may be" a legitimate interest, and introducing a relevant product to companies that might buy it is a textbook example — you do not need a noble purpose, just a real one.

Where this fails: interests that are themselves unlawful, or purposes too vague to articulate. "Marketing" is not a purpose; "introducing our payroll software to finance leads at UK firms with 20–200 staff" is.

### 2. Necessity test — do you need this data for that purpose?

Necessity does not mean "absolutely essential"; it means the processing is a targeted, proportionate way of achieving the purpose, with no less intrusive alternative that would work as well. For cold email the honest answer is usually yes: to contact a decision-maker about a business matter, you need their name, role and work email. What you do *not* need is their home address, personal mobile, or data about their private life — collecting more than the outreach requires is where necessity arguments collapse.

### 3. Balancing test — do their rights override your interest?

This is the part that does the work. You weigh the impact on the individual against your interest, considering:

- **Reasonable expectations.** Would a marketing director be surprised by a relevant B2B email at their work address? Generally not. A consumer receiving marketing at their personal Gmail is a different story.
- **Nature of the data.** Public-facing business contact details are low-sensitivity. Special category data (health, politics, religion) can never ride on a standard legitimate interest.
- **Likely impact.** One relevant, easily-declined email is minimal intrusion. Daily follow-ups for six weeks after silence is not.
- **Safeguards.** Easy opt-out, suppression lists, verified data, limited retention — every safeguard tips the balance further in your favour.

Fail the balancing test and you cannot use legitimate interest: either add safeguards until the balance changes, or fall back to consent — which for cold outreach defeats the point.

## Worked LIA template for B2B cold email

Copy the structure below into a document, replace the example answers with your own, date it, and store it. The scenario is fictional but deliberately realistic: **Harborline Analytics Ltd**, a small UK software company selling compliance reporting tools, emailing finance directors at mid-sized UK accountancy practices.

### Part 1 — Purpose test

**What is the purpose of the processing?**
To identify and contact finance directors and partners at UK accountancy practices (20–200 staff) by work email, to introduce Harborline's compliance reporting software, which is directly relevant to their professional role.

**Whose interests does it serve?**
Harborline's commercial interest in winning customers; arguably also the recipient's professional interest in learning about a tool relevant to their job.

**Is the interest lawful and clearly articulated?**
Yes. Direct marketing to relevant business contacts is a recognised legitimate interest (GDPR Recital 47). The target audience, product relevance and channel are all defined.

### Part 2 — Necessity test

**What data will be processed?**
Name, job title, company name, business email address, and publicly available company information used to personalise the message. No personal addresses, no personal email accounts, no special category data.

**Is the processing necessary to achieve the purpose?**
Yes. Contacting a named decision-maker requires their name, role and work email. We cannot achieve the same result with anonymised data.

**Is there a less intrusive way?**
Paid advertising and inbound content reach a broader, less targeted audience at far higher cost and cannot reliably reach this specific role. Direct, relevant one-to-one contact at a work address is proportionate to the purpose.

### Part 3 — Balancing test

**Would recipients reasonably expect this contact?**
Yes. Recipients are senior professionals contacted at corporate work addresses about a product relevant to their role. Sole traders and unincorporated partnerships are excluded from lists, because under PECR they are treated as individual subscribers requiring consent (see [is cold email legal in the UK?](/blog/is-cold-email-legal-uk/)).

**What is the likely impact on the individual?**
Minimal: a small number of short, relevant emails, capped at three to four touches, stopped immediately on any reply or opt-out. No automated decisions, no profiling with legal effect, no data sharing with third parties.

**What safeguards are in place?**
Every email identifies Harborline and includes a working one-click opt-out; opt-outs go onto a permanent suppression list checked before every send; email addresses are verified before import so we only hold accurate, current business contacts; data for non-responders is deleted after 12 months; sending is paced within normal business volumes.

**Outcome:**
The balancing test is passed. Harborline's legitimate interest in relevant B2B marketing is not overridden by the minimal, expected, easily-declined impact on recipients.

**Assessed by:** [Name, role] · **Date:** [date] · **Review due:** [date + 12 months]

That is the whole document — one to two pages. Tools that build in these safeguards make the answers honest rather than aspirational: Velox House, for example, SMTP-verifies every contact before import, paces sending in safe windows and applies suppression automatically on any reply or opt-out — exactly the mechanics the balancing test wants to see.

## When legitimate interest fails for cold email

| Situation | Can you rely on legitimate interest? |
|---|---|
| Named contact at a limited company or LLP, work address | Yes, with a passed LIA |
| Sole trader or unincorporated partnership | No for the *send* — PECR treats them as individual subscribers; consent required |
| Personal email address (Gmail, Hotmail) | Effectively no — fails reasonable expectations for B2B outreach |
| Consumer marketing lists | No — PECR requires consent (or the soft opt-in) for consumers |
| Special category data (health, politics, etc.) | Never on legitimate interest alone |
| Bought list with no provenance or verification | Very hard — you cannot evidence accuracy or expectations |

The pattern: legitimate interest works when the contact is a business role, at a business address, with a message relevant to that role and a trivial opt-out. It fails when any of those breaks.

## How to document, store and review your LIA

- **Keep it written.** A one-page document, dated and signed off by whoever owns compliance — in a small company, usually a founder.
- **Store it findably.** With your privacy notice and records of processing, not in someone's inbox.
- **Reference it in your privacy notice.** If you rely on legitimate interests, your notice must say so and describe the interest.
- **Review annually, or when anything material changes** — new data sources, new audience, new channel, a spike in complaints.
- **Keep the operational evidence too.** Suppression lists, opt-out logs and verification records prove the safeguards in your LIA actually exist.

If the ICO ever asks — typically triggered by a complaint — they want exactly this: a dated LIA, a privacy notice that matches it, and evidence that opt-outs are honoured. The ICO's email-marketing enforcement history is overwhelmingly about consumer spam, ignored opt-outs and bought consumer lists — not measured, well-documented B2B outreach.

## LIA vs DPIA — don't confuse them

A **DPIA** (data protection impact assessment) is a longer, mandatory assessment required when processing is *likely to result in high risk* — large-scale profiling, special category data at scale, systematic monitoring. Ordinary B2B cold outreach to verified business contacts is not high-risk processing, so a DPIA is normally not required; the LIA is the document that fits. If you operate at very large scale or combine outreach data with intrusive profiling, take advice on whether a DPIA is triggered.

Compliance on paper also has to match practice in the inbox: an LIA doesn't help if your sending behaviour looks like spam. Pair it with sensible [daily volumes](/blog/how-many-cold-emails-per-day/), proper [deliverability foundations](/blog/cold-email-deliverability-guide/) (you can check yours free with the [deliverability checker](/tools) — no signup), and [messages worth replying to](/blog/cold-email-templates-that-get-replies/). If you'd rather have the operational safeguards — verified contacts, automatic suppression, paced own-inbox sending — handled by default, that's how [Velox House](/features) runs every campaign, from £19.99/month with no contract.

## Frequently asked questions

### Is a legitimate interest assessment legally required for cold email?

UK GDPR does not name the LIA as a mandatory document, but if you rely on legitimate interests you must be able to demonstrate you applied the three-part test, and the ICO's guidance says to document the outcome. Without a written LIA you cannot evidence compliance if challenged.

### How long does an LIA take to write?

Twenty to forty minutes for a typical B2B cold email operation, using a template like the one in this article. It is one to two pages covering purpose, necessity and balancing, plus a recorded outcome, owner and review date.

### Do I need a separate LIA for every campaign?

No. One LIA covers a defined type of processing — for example, "B2B email outreach to verified decision-makers at UK limited companies." You only need a new or updated assessment when something material changes: a new audience type, a new data source, a new channel, or evidence (like complaints) that the balance has shifted.

### What is the difference between an LIA and a DPIA?

An LIA is the short assessment you do whenever you rely on legitimate interests as your lawful basis. A DPIA is a longer, mandatory assessment triggered only by likely high-risk processing such as large-scale profiling or special category data. Standard B2B cold outreach normally needs an LIA but not a DPIA.

### Can legitimate interest cover emailing sole traders?

Not on its own. Legitimate interest covers the UK GDPR data-processing side, but PECR governs the sending and treats sole traders and unincorporated partnerships as individual subscribers, who need consent. Limited companies and LLPs are corporate subscribers, where PECR's consent rule does not apply and legitimate interest can carry the outreach.

### What happens if the ICO asks to see my LIA and I don't have one?

An absent LIA is not an automatic fine, but it undermines your lawful basis: you are asserting legitimate interests without evidence you ever weighed the balancing test. The ICO's response depends on the underlying conduct, but you would be starting the conversation on the back foot. Writing the LIA before anyone asks is the cheap option.
