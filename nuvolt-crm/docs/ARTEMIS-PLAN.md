# Simplr × Artemis — Energy & Roofing Platform Plan

Business direction: build an **artemispower.com-style** platform — address → AI 3D solar
design → priced, lender-financed proposal → close (Sales Mode) → deliver to PTO — on top
of Simplr. Our edge vs Artemis: we also **find the site** (Reach Solar finder) and **reach
the owner** (AI operator), so we own the whole funnel. Visual plan: artifact "The Artemis Playbook".

(Note: helloartemis.com is a *different* company — an AI outreach agent. artemispower.com is
the energy/roofing design-and-sell platform, which is the one this plan targets.)

## Phase 0 — have it
Reach Solar finder, AI operator, full CRM, Midas Solar House (Google Solar API + proposal/deck),
multichannel outreach, marketing-site lead capture.

## Phases
1. **Instant design engine** (L) — ✅ **BUILT (simulated)** at `/reach/design` (Design Studio):
   address → roof-plane detection → panel layout → kWp + production + savings + bill offset +
   payback + CO₂ + live price; editable panel slider recomputes everything; "Generate proposal"
   creates a real solar deal. Model in `src/lib/solar.ts` (deterministic; swap `analyseRoof()` for
   Google Solar API roof segments + NREL PVWatts production behind a backend — same return shape).
   Still TODO to go LIVE: backend + Google Solar API key + real address geocoding.
2. **Interactive proposal & Sales Mode** (M) — ✅ **BUILT** at `/reach/proposal/:id` (`pages/Proposal.tsx`):
   Design Studio "Generate proposal" attaches the design to the deal and opens a presentable, live-editable
   Sales Mode — roof render, panel tuner that recomputes + persists to the deal, cumulative-savings-vs-cost
   chart w/ break-even, inclusions, price + finance teaser, Accept & sign → deal won. Deal detail links to it.
   Still TODO: real e-sign + deposit (Stripe/Dropbox Sign), shareable public link + view tracking.
3. **Integrated financing** (M) — cash/loan/lease/PPA, live monthly payment, soft-credit prequal.
   Data: GoodLeap/Sunlight/Dividend/Sungage (each a partnership integration).
4. **Storefronts** (M) — embeddable widget: homeowner self-designs on contractor's site → pre-qualified
   lead into `/leads`. Reuse Velox lead-capture pattern + public design API.
5. **Operations → PTO** (M) — Sold→Design→Permit→Install→Inspect→PTO pipeline; SolarAPP+ permitting;
   crew scheduling; customer portal. Maps: reuse Projects board grammar.
6. **Multi-product + AI operator everywhere** (L) — battery/HVAC/roofing on same engine; operator
   extends from prospecting/outreach to design/quote/ops ("Artie" equivalent). Needs Claude API + backend.

## Data stack (start-with)
Imagery: Google Solar API · Production: PVWatts · Tariffs: OpenEI (free) · Finance: one lender ·
E-sign/pay: Stripe + Dropbox Sign · Permitting: SolarAPP+ · Operator: Claude API + backend runner.

## Recommended first move
Phase 1 on the Google Solar API — we're closest to it (Reach Solar finder + Midas already use it).
Turn it into address → editable design → savings → price. Everything else bolts on.
