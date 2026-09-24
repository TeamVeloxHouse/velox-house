# TellOvi Marketing — Module Spec

> **What this is:** the buildable spec for the **TellOvi Marketing** workspace — its own top-level
> workspace (peer of CRM / Reach / Studio), not a department dashboard. Part of the TellOvi suite;
> see [`TELLOVI-VISION.md`](./TELLOVI-VISION.md) for the whole product. Keep in sync as we build.
>
> Last updated: 2026-08-27.

---

## 1. What it is (and isn't)

**TellOvi Marketing is the brand & content operations hub — the library, the planner, and the
operator.** It is deliberately **not** a design tool and **not** an ad-buyer.

> The one-liner: *Ovi is the marketing librarian + chief-of-staff.* When someone says "hi, I need
> the logo / the deck template / last month's numbers," Ovi finds it and hands it over. When someone
> says "plan next week's posts," Ovi drafts and schedules them.

**The boundary is the product.** Design happens in Canva / Figma / Claude Design; the finished asset
**lands back here** auto-tagged. We own the *source of truth, the plan, and the orchestration* — not
the easel.

## 2. Benchmark — who we're replicating

No single incumbent does all of this; the vision is a fusion of three leaders:

| Job | Leader | What we take from it |
|---|---|---|
| Brand hub: logos, guidelines, templates, "hand me X" | **Frontify** | DAM + guidelines + templates in one place; an AI assistant that enforces guidelines & retrieves approved assets |
| Plan / schedule / repurpose content | **HubSpot Content Hub** + **CoSchedule** | AI brand voice, Content Remix (one asset → many), a campaign calendar |
| Connect socials, schedule, unified analytics + inbox | **Sprout Social** | Multi-network scheduling, one engagement inbox, cross-channel analytics, approval workflow |
| Make the designs | **Canva / Figma / Claude Design** | The boundary — connect out, pull finished work back in |

**Our edge over all three:** Marketing sits on the **same TellOvi spine** as CRM/Reach/Deliver, so a
piece of content traces to the lead and the deal it created. Frontify/Sprout/HubSpot can't see that far.

## 3. The workspace map (pillars → screens)

| Screen | Route | Pillar | What it does |
|---|---|---|---|
| **Overview** | `/marketing` | — | KPIs, Ovi operator strip, live requests, what's scheduled, brand health |
| **Brand Hub** | `/marketing/brand` | Brand | Logos (all variants/formats), colour + type tokens, guidelines, templates (headers, letterheads, deck/PDF), **tone-of-voice / messaging library**. Versioned, "single latest". **The "hand me X" surface.** |
| **Assets** | `/marketing/assets` | Media | Photo/video/graphic library — tagged, searchable, with source (upload/Canva/Claude Design) + licence/expiry |
| **Content** | `/marketing/content` | Plan | Calendar + pipeline (Idea → Brief → Draft → Review → Approved → Scheduled → Published), by channel/campaign |
| **Campaigns** | `/marketing/campaigns` | Plan | Multichannel + email campaigns (reuses Reach data) |
| **Social** | `/marketing/social` | Channels | Connected accounts, scheduled queue, per-network analytics, engagement inbox |
| **Reviews** | `/marketing/reviews` | Channels | Reputation — respond with Ovi |
| **Requests** | `/marketing/requests` | Intake | The "hi I need X" queue. Ovi triages: **exists → hand over**; **new → brief + route** |
| **Connectors** | `/marketing/connectors` | Connect | Canva, Figma, Google Drive, **Claude Design**, social APIs, GA4 — connect + round-trip |
| **Reports** | `/marketing/reports` | Measure | Monthly performance, case studies, generated collateral |

## 4. Ovi as the marketing operator

The AI layer over all of it. On every screen Ovi can: **find** an asset, **draft** copy in brand
voice, **plan** the calendar, **repurpose** one piece into many, **respond** to reviews, **report**
on performance, and **answer** brand questions ("what's our brand blue?" → `#1D4ED8`). Same visible
streaming pattern as the rest of the app (spinner → ✓ with real counts).

## 5. The design boundary — connectors (incl. Claude Design)

Design tools are **connected, not embedded**. The round-trip:

1. **Connect** Canva / Figma / Drive / Claude Design (OAuth in the real build).
2. **Brand → out:** Ovi hands a marketer a template that opens in the tool with the TellOvi brand kit applied.
3. **Finished → back:** the completed design **syncs into Assets**, auto-tagged + versioned.

**Can we embed Claude Design?** *Not as a live in-app editor today* — Claude Design runs as Claude
artifacts / inside Claude Code and has no third-party embed SDK yet. What we **can** do now, and what
this spec builds toward:
- **Deep-link out** ("Open in Claude Design") + **pull the output back** as an asset.
- **Render its outputs natively** — Claude Design emits `.dc.html` artboards / HTML / PNG / PDF, all of
  which we own and can preview inline in the Assets library.
- If/when Anthropic ships an embeddable Design SDK, we swap the deep-link for a true embed behind the
  **same connector contract** — no other screen changes.

So: **embed the *outputs* now, embed the *editor* if/when a Design SDK exists.**

## 6. Data model (store additions)

New top-level state keys (new keys auto-merge from seed — no `KEY` version bump needed):

- `brandAssets: BrandAsset[]` — logos, templates, headers, deck/PDF templates, guideline docs.
  `{ id, name, type: 'logo'|'template'|'header'|'deck'|'pdf'|'guideline'|'font', format, tags[], version, updatedAt, note?, latest }`
- `messaging: MessagingSnippet[]` — tone of voice + boilerplate + value props.
  `{ id, label, category: 'tagline'|'boilerplate'|'value-prop'|'tone'|'banned', text }`
- `mediaAssets: MediaAsset[]` — image/video/graphic library.
  `{ id, name, type: 'image'|'video'|'graphic', tags[], source: 'upload'|'canva'|'claude-design'|'figma', when, license?, expiry? }`
- `contentItems: ContentItem[]` — richer content pipeline (superset of `socialPosts`).
  `{ id, title, channel, campaign?, status: 'idea'|'brief'|'draft'|'review'|'approved'|'scheduled'|'published', owner, date, note? }`
- `mktRequests: MarketingRequest[]` — the intake queue.
  `{ id, from, ask, status: 'new'|'found'|'in-progress'|'done', assetId?, when, note? }`
- `mktConnectors: MarketingConnector[]` — design/social/storage/analytics connectors.
  `{ id, name, kind: 'design'|'social'|'storage'|'analytics'|'email', connected, account?, note? }`

**Reuses (no new type):** `brandKit`, `brandDocs`, `docTemplates`, `socialPosts`, `reviews`,
`reachCampaigns`, `emailCampaigns`, `leads`.

New actions: `fulfilRequest(id)`, `advanceContent(id, status)`, `addContentItem(...)`,
`toggleMktConnector(id)`, `saveBrandAsset(...)` (the "save from Canva/Claude Design" round-trip).

## 7. Real vs simulated (be honest)

- **Real & persistent:** everything CRUD — assets, messaging, content pipeline moves, request
  fulfilment, connector toggles — hits the store and persists.
- **Simulated:** files are placeholder cards (no real binary storage yet); connectors don't leave the
  app; social analytics are seeded; Ovi is the deterministic engine.
- **To make live later:** R2/S3 for real files, Canva Connect + Figma REST + social APIs + GA4,
  UTM/link tracking for attribution, a real LLM behind Ovi.

## 8. Build order

1. ✅ Spec (this doc) · nav rail → full workspace · store types + seed + actions.
2. Brand Hub (the flagship), Assets, Content planner, Requests, Connectors, Social, Overview.
3. Reuse Campaigns / Reviews / Reports.
4. Later: real connectors, file storage, attribution loop back to CRM.
