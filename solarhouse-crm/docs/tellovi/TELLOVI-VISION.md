# TellOvi — Vision, Strategy & Full Scope

> **What this is:** the master reference for TellOvi — the product vision, the key idea, the
> differentiator, the full module scope, positioning decisions, and the brand. Refer back to this
> when building. TellOvi is **Simplr, renamed and expanded** — this codebase (`simplr-crm/`) is the
> foundation. Keep this doc in sync as decisions change.
>
> **Rendered assets (in this folder):**
> - `tellovi-plan.html` — the full business plan (Simplr "Slate Rail" light branding).
> - `tellovi-deck.html` — the 13-slide investor pitch deck (dark theme; may be restyled to match).
>
> **Live artifacts (claude.ai):**
> - **Control Room** (interactive hub — maps every lifecycle page + live build tracker + shared notes): https://claude.ai/code/artifact/2b364c01-8b4e-4c88-860c-674e5eed1c05
> - Business plan: https://claude.ai/code/artifact/274ea147-afe7-4129-809e-1852313bae9f
> - Pitch deck: https://claude.ai/code/artifact/7851c61f-0743-41d9-b0bd-cc4ec41d35da
>
> Last updated: 2026-09-09.

---

## The North Star (the goal that shapes everything)

A full **end-to-end system so a business doesn't need 5–10 different subscriptions** to get its work
done — everything in one place, saving **money and time** — and the whole system is **operable by AI
(Ovi)**. Because everything is built on TellOvi, Ovi has **full context across the entire business**:
the finance director asks Ovi for insights and gets them; a manager assigns you a task and you can
**offload it to Ovi** and it does it. Work gets done faster, more efficiently and in more detail — so
**any business can scale its operations**.

**End-to-end scope:** industry-specific AI **lead generation** → **CRM** (manage the customer,
proposals, call tracking/monitoring) → **quoting** → **surveys** → **DNO applications** (solar) →
**installation** → **customer portal** and beyond. **Every step is Ovi-operable.** A built-in
**Teams chat** lets people talk in-app and operate Ovi together to get teamwork done.

**Three pillars — the test for any feature:**
1. **One system, not ten subscriptions** — replace the stack; save money + time.
2. **Everything is Ovi-operable** — full cross-business context; ask for insights, offload tasks.
3. **End-to-end & industry-specific** — lead-gen → install → aftercare; start by replacing the whole
   solar design/monitoring toolchain, then **dominate every sector we can**.

---

## 0. Decisions log (settled so far)

| Decision | Choice | Why |
|---|---|---|
| Primary audience | **Investors / raising** | Deck + plan framed for a raise. |
| Deliverable format | **HTML artifact** (plan is long-form doc; deck is slides) | Premium, iterable, shareable. |
| Positioning | **Focused challenger** (not "bold visionary", not "unique idea") | The space is the most contested in software; honesty survives scrutiny. |
| Competition framing | **Name rivals head-on** | Reads as informed/confident. |
| Branding | **Simplr "Slate Rail"** light system; Ovi mascot as brand character | Product cohesion. |
| Name = command | "TellOvi" — the brand name is also the instruction: **"just tell Ovi"** | Core creative hook. |

**Honesty guardrails:** no invented traction/financials. Numbers we can't know are dashed
placeholders in the artifacts (TAM, pricing, pilots, MRR, raise, team, contact). Product claims
stay truthful to what's actually built (see §11).

---

## 1. The idea (thesis / category)

**TellOvi is an AI-operated Business Operating System** — a new category we call the
**Agentic Business Operating System**.

One platform, on **one shared data spine**, where an AI operator named **Ovi** runs the *entire*
commercial process end-to-end and human teams collaborate on the same records, directing Ovi in
plain language — including **inside the team chat**, where Ovi takes action straight off the
conversation.

> The unit of software is no longer the app you open — it's the operator you instruct.
> Not software you operate; a business that operates itself, on your command.

The lifecycle: **Research → Generate → Engage → Sell → Quote → Order → Fulfil → Deliver → Support → Grow.**

---

## 2. Key differentiator & moat

**The wedge: end-to-end on one spine.** Every rival owns one slice (records, or prospecting, or
quoting, or delivery, or chat) and their fragmented data means their AI can only ever *assist* inside
its box. TellOvi owns the whole thread on one data model, so Ovi acts with **full context from first
research to final delivery** — an *operator*, not an assistant.

**Honesty note (important for the pitch):** no single pillar here is individually unique — the
"AI runs your business" space is crowded and well-funded. Our edge is **focus + architecture**, and
it compounds through four properties:

1. **Context** — one spine, total context; fragmented rivals can't see this far.
2. **Focus** — built for the segment giants ignore: **SMB firms that both sell *and* deliver**
   (installers, trades, agencies, wholesalers). Salesforce won't come down-market; their
   field-service tools aren't AI-native.
3. **Surface** — conversation→action in team chat. A CRM doesn't own your chat; a chat tool doesn't
   own your data. We own both.
4. **Flywheel** — every action (which research converted, which price closed, which route ran on
   time) trains better targeting/scoring/pricing/routing. Point tools never see enough of the journey.

**Positioning statement:** *"The only end-to-end AI operator built for the businesses the giants
ignore — SMBs that both sell and deliver."*

---

## 3. Full scope — the Ovi module suite

Modular (start anywhere), unified (one spine, one Ovi). Each module maps to a lifecycle stage and,
where relevant, to an existing Simplr workspace we build on.

| Module | Stage | What it does | Maps to existing Simplr |
|---|---|---|---|
| **OviResearch** | Research | Market/company/product research; ICP from real signals; buying-trigger detection; product & supplier sourcing research | `lib/intelligence.ts` (new/cross-cutting) |
| **OviLeads** | Find | Research-driven lead gen: right accounts + people + **reason-to-buy**, enriched, scored, de-duped vs the spine | Reach — finders / prospector |
| **OviReach** | Engage · outbound | AI SDR: multichannel (email/LinkedIn/calls) personalised sequences, reply handling, meeting booking | Reach — Outreach operator |
| **OviChat** | Engage · inbound | Website + WhatsApp chatbots that qualify, answer, book, and route to the spine | New (inbound) |
| **OviCRM** | Sell | Self-driving system of record: contacts/deals/pipeline, auto-logged activity, scoring, next-best-action, forecasting | CRM workspace (existing) |
| **OviQuote** | Quote & price | Configurable pricing calculators, quotes, proposals, approvals, e-sign; won quote → order | Studio — pricing/proposal (generalise beyond solar) |
| **OviOrder** | Order | Deal→order, product sourcing + supplier POs, stock/lead-time tracking | Studio — delivery front-half / new |
| **OviDiary** | Schedule | **Location-aware** scheduling: route/postcode clustering, capacity & skills matching, auto-booking surveys/installs | New (scheduling) |
| **OviDeliver** | Fulfil & deliver | Won order → live project: tasks, milestones, field/install workflow, completion sign-off, logistics tracking | Studio — Delivery (`lib/delivery.ts`) |
| **OviTeams** | Collaboration (**the wedge**) | Internal messaging channels where **Ovi is a participant** — answers from live data, takes actions off the conversation | **NEW — biggest new build** |
| **OviAnalytics** | Intelligence | Ask-anything NL analytics over the whole spine; live KPIs; auto board packs; alerts pushed into Teams | Insights + Reach analytics |
| **OviBuild** | Automation platform | Build custom agents/automations from plain-language briefs; integrations/API; industry templates; marketplace | Agents / automations (extend) |

**Architecture (how Ovi operates):** (1) the **data spine** — one shared model of the whole
business; (2) the **agent runtime** — specialised agents (research/outreach/pricing/scheduling)
under a planner; (3) **actions, not answers** — permissioned, auditable, reversible mutations of the
spine; (4) **governance & trust** — RBAC, approval gates for send/spend/delete, audit trail,
"show your work" streaming. Every surface (CRM record, chatbot, quote, delivery board, team channel)
is a view onto the *same* operator.

---

## 4. Deep dive — the research lead engine (our acquisition edge)

A **research loop, not a lookup**. Not a scraped list; a shortlist that already knows why it's on
the list.

1. **Define** — build ICP from real won deals / best accounts.
2. **Scan** — watch the market for buying signals (funding, hiring, expansion, new premises, tech/
   supplier changes, tender activity).
3. **Research** — investigate each candidate; find the right people; understand the situation; draft
   the specific reason it's a fit now.
4. **Qualify** — fit score + timing score + one-line "why now"; de-dupe against the live spine.
5. **Learn** — feed outcomes (converted / stalled / delivered profitably) back into targeting.

---

## 5. Deep dive — OviTeams (the wedge)

Work is decided in conversation. In every other stack the chat is a dead-end; here it's live: Ovi is
in the channel. **Ask** ("Ovi, how many leads this week?") → **Answer** (real number + live chart,
in-thread) → **Act** ("draft follow-ups to the 41 MQLs" → done). Because Ovi sits on the same spine,
an answer is never a guess and an instruction becomes executed work, with the whole team watching.
Hardest surface for an incumbent to enter (CRM co. doesn't own chat; chat co. doesn't own data).

---

## 6. Worked example — domestic solar & battery installer (the beachhead vertical)

The canonical "sell *and* deliver" SMB. One job, roof-Ovi's-never-seen → commissioned exporting system:

1. **OviResearch + OviLeads** — ICP from past jobs; intent signals (high-irradiance postcodes,
   suitable roofs, recent EPC, EV owners, rising bills); queued with fit score + "why now".
2. **OviChat + OviReach** — website chat qualifies (roof type, orientation, bill, ownership, battery
   interest) and books a survey; non-converters get an OviReach nurture.
3. **OviQuote** — size the array (e.g. 4.2 kWp + 5 kWh battery), price (panels/inverter/battery/
   scaffolding/MCS/labour), proposal with savings + SEG export income + payback; discount → Teams
   approval → e-sign.
4. **OviOrder + OviResearch** — quote→order; source panels/inverter/battery vs price/stock/lead-time;
   raise supplier POs; flag anything that slips the install date.
5. **OviDiary** — cluster survey/install by postcode; match MCS-certified team with capacity; book
   scaffolding ahead of the crew; minimise van miles across the route.
6. **OviDeliver** — scaffold → fit → commission; DNO/G99 application, MCS certificate, handover pack
   as milestones; SEG export tariff set up so the customer starts earning.
7. **OviAnalytics + OviTeams** — margin/install-days/route efficiency feed analytics + sharpen
   targeting; owner asks in chat "how many installs booked this month?" → instant answer.

(Ties directly to the existing Simplr **Studio** solar model — `lib/solar.ts`, Google Solar
integration, `lib/delivery.ts`.)

---

## 7. Market · competition · GTM · model · roadmap (condensed)

- **Market:** replaces CRM + sales engagement + BI + CPQ + order/ops + field/scheduling + team chat
  + the manual glue. Beachhead: SMB/mid-market **sell-and-deliver** businesses. TAM/SAM = placeholders.
- **Named competitors & why we win:** Salesforce/Agentforce (enterprise, record-centric, won't go
  down-market); HubSpot Breeze (stops at the sale); Clay/Apollo (top-of-funnel only); 11x/Artisan
  (outbound only); Jobber/ServiceTitan (own delivery but not AI-native, weak at acquisition);
  Slack AI/Copilot (answer in chat but don't own the data → can't take end-to-end action). Pattern:
  each is deep in one box and structurally can't leave it. Our edge is **architecture + focus**.
- **GTM:** land (research lead-gen + CRM + Teams; fast "wow", low switching cost) → expand along the
  lifecycle → deepen into the operating layer. Channels: PLG on the research edge, founder-led sales
  into beachhead verticals, industry templates via OviBuild, partner/agency motion. The demo that
  sells = Ovi answering a real question in Teams.
- **Model:** per-seat SaaS tiered by lifecycle coverage + usage-based AI actions/research/outreach.
  Land-and-expand → NRR > 100%. Illustrative tiers: Starter £19 / Growth £49 / Scale £99 / Enterprise.
- **Roadmap:** P1 connected product (now) → P2 live AI backend + OviTeams (funded) → P3 order→fulfil→
  deliver complete → P4 research lead engine at scale → P5 OviBuild + marketplace.
- **Risks:** incumbents add AI (can't re-unify fragmented data / own chat); AI reliability (approval
  gates, audit, human-in-loop); large scope (land-and-expand); AI cost curve (model routing/caching);
  data/compliance (RBAC, encryption, audit, region controls); adoption (assist first, earn autonomy).

---

## 8. Brand

**Simplr "Slate Rail" design system** (source: `tailwind.config.js` + `src/index.css`):

- **Canvas** `#F6F7F9` · **surface** `#FFFFFF` · **surface-tint** `#FBFCFF`
- **Ink** `#0B1220` / ink-2 `#1B2534` / ink-3 `#3D4757` · **muted** `#5D6878`
- **Accent (royal blue)** `#1D4ED8` · gradient `#3B6BF5 → #1D4ED8` · washes `#EEF2FB` / `#DCE7FC`
- **Deep panel** navy `#1C3A72 → #0C1B38` (used for the in-chat mock)
- **Semantics:** positive `#0E7C66` · warning `#C2410C` · negative `#B01B4F`
- **Border** `#E4E8EE` · divider `#EDF0F4` · control `#F1F3F7`
- **Font:** Instrument Sans · **Radii:** card 12 / control 9 / chip 6 / overlay 16
- **Shadows:** card `0 2px 8px rgba(20,24,40,.05)`; primary blue `0 6px 16px rgba(29,78,216,.22)`

**Ovi mascot / wordmark:** glossy purple-indigo robot with cyan smile-eyes (brand character; kept
purple/cyan even on the blue system). Wordmark = "Tell" (ink) + "O" (purple `#7C3AED`) + "vi"
(accent blue). Tagline: **"Just tell Ovi."** Brand source images are pasted in the originating chat
(not yet saved to disk — if Tony provides the PNGs, embed the real 3D renders in place of the SVG).

---

## 9. Open placeholders / TODO before external use

- [ ] Raise **amount** + use-of-funds split + timeframe
- [ ] **TAM/SAM** figures + sources
- [ ] **Pricing** — confirm real tier prices (currently illustrative)
- [ ] **Traction** — pilots / waitlist / MRR / modules-live
- [ ] **Financials** — ARR targets, gross margin, NRR
- [ ] **Team** — bios/roles + hires this round funds
- [ ] **Contact** — email + confirm domain (tellovi.ai?)
- [ ] Decide whether to restyle the **pitch deck** to the Simplr light theme (currently dark)
- [ ] Optionally embed the real Ovi 3D renders (need PNGs on disk)
