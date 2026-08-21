# Simplr CRM — Feature Roadmap

Benchmark of the best 2026 CRMs (Attio, Salesforce/Einstein/Agentforce, HubSpot/Breeze,
Pipedrive, Gong, Apollo, Clay) → a staged plan to make Simplr the flexible, effortless,
autonomous CRM. Visual version: published artifact "Simplr CRM Roadmap".

**The 2026 bar:** (1) AI that *acts*, not suggests; (2) a data model that flexes (custom
objects/fields); (3) connected, fresh data (enrichment + dedupe); (4) zero-friction adoption.

Impact = business leverage · Effort = relative build size in this codebase (S/M/L).

## Phase 1 — Flexible & frictionless
- [ ] **Custom fields & objects** — schema layer in store + field renderer on record pages. `Attio/Salesforce` · High · L
- [ ] **Saved views, inline & bulk edit, column chooser** — upgrade shared `Table` + views slice. `Attio/Pipedrive` · High · M
- [ ] **Global search + notifications centre** — extend CommandPalette index + TopBar bell. `HubSpot` · Med · M
- [ ] **Onboarding checklist + CSV import wizard** — new `/setup` + field-mapping import modal. `HubSpot/Pipedrive` · Med · M
- [ ] **Duplicate detection & merge** — matcher in store + merge modal on People/Orgs. `Salesforce` · Med · S
- [ ] **Data completeness meter / health score** — derived selector + meter on record headers. `Attio` · Med · S

## Phase 2 — AI everywhere (Simplr's differentiator — pull forward)
- [ ] **Predictive deal & lead scoring w/ reasons** — scoring in `lib/ai`, shown on cards/lists. `Einstein` · High · M
- [ ] **Next-best-action on every record** — reusable NextBestAction block → store mutations. `Agentforce/Breeze` · High · M
- [ ] **Ask-AI on any record + AI record summaries** — reuse AiChat w/ record context + summary card. `Breeze Copilot` · High · S
- [ ] **Agent inbox / run log w/ approve-undo** — `/agents` feed of autonomous activity. `Agentforce` · High · M
- [ ] **Conversation intelligence** — talk-ratio/topics/risk from transcripts → deal coaching. `Gong` · Med · M
- [ ] **AI health & risk badges on the board** — derived risk selector → DealsBoard cards. `Gong/Einstein` · Med · S

## Phase 3 — Grow & engage
- [ ] **Sequences & cadences (multichannel)** — sequence builder + enrolment behind `/campaigns`. `Apollo/Outreach` · High · L
- [ ] **Auto-enrichment + company hierarchy (waterfall)** — enrichment action + hierarchy view. `Clay/Attio` · High · M
- [ ] **No-code workflow automation (editable)** — editable rule model + runner dispatching store actions. `Salesforce Flow` · High · L
- [ ] **Custom report & dashboard builder** — build-your-own over relational data, replaces static Insights. `Attio/HubSpot` · Med · L

## Phase 4 — Scale & collaborate
- [ ] **Roles, teams & permissions** — users/roles model + visibility gating in Settings. `Salesforce` · Med · M
- [ ] **Goals, quota & leaderboards** — goals slice + pacing widgets on Home/Insights. `HubSpot` · Med · S
- [ ] **Collaboration: comments, @mentions, follow** — comments model + mention notifications. `Attio/monday` · Med · M
- [ ] **Integrations marketplace, API/webhooks + mobile/PWA** — flesh out Settings→Connected + responsive. `HubSpot/Salesforce` · Med · M

## Recommended first release
Ship **Phase 1** (flexible & easy) **+ the top AI items from Phase 2** together, so the first
cut is a CRM that bends to your process *and* an operator that scores, explains and acts:
Custom fields → Saved views/inline edit → Deal/lead scoring w/ reasons → Next-best-action →
Ask-AI-on-record + summaries → Agent inbox.
