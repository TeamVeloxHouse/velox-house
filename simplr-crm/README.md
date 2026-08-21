# Nuvolt CRM

A sales CRM built to replace Pipedrive, in the **Slate Rail** design language: fixed dark
icon rail, white working surfaces, a single blue accent (`#1D4ED8`), light neutral canvas,
Instrument Sans. Desktop-first, data-dense.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS (design tokens mapped in `tailwind.config.js`)
- React Router (all 18 screens routed)

## Run

```bash
npm install
npm run dev      # http://localhost:3010
npm run build    # production build to dist/
```

## Screens

All 18 screens from the design handoff are implemented as routes:

| Route | Screen |
|---|---|
| `/` | Home / dashboard |
| `/deals` | Deals board (kanban, drag between stages) |
| `/deals/:id` | Deal detail (stage bar, composer, timeline) |
| `/leads` | Leads inbox (saved filters, bulk select) |
| `/people` · `/people/:id` | People list · Person detail (conversation) |
| `/organisations` | Organisations |
| `/activities` | Week calendar |
| `/inbox` | Email inbox (list + reading pane) |
| `/insights` | Insights / reporting |
| `/forecast` | Forecast |
| `/products` | Products catalogue |
| `/projects` | Projects (post-sale delivery board) |
| `/campaigns` | Campaigns |
| `/automation` | Automation builder |
| `/documents` | Documents & quotes (with quote preview) |
| `/settings` | Settings + users |

Press **⌘K / Ctrl+K** anywhere for the command palette.

## Notes

- All data in `src/data/mock.ts` is placeholder sample data — swap for real data bindings.
- Design tokens (colour, type scale, spacing, radii, shadows) live in `tailwind.config.js`
  and `src/index.css`, mapped from the design handoff. Don't hard-code hexes in components;
  use the token classes.
- Shared primitives are in `src/components/ui.tsx` (Button, Chip, Avatar, Kpi, Segmented,
  Card, Progress) and `src/components/Table.tsx`.
