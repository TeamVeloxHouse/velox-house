// Per-route <title>/description/canonical for this SPA. index.html carries the
// homepage defaults (and the structured data); this only swaps the tags that
// should differ per route, so /tools isn't indexed under the homepage title.
const SITE = "https://veloxhouse.co.uk";

interface RouteMeta {
  title: string;
  description: string;
  path: string;
}

const ROUTE_META: Record<string, RouteMeta> = {
  "/": {
    title: "Velox House — Launch Lead-Gen Campaigns From a Single Prompt | AI Cold Email & Outreach",
    description:
      "The AI outreach platform you run from a single prompt. Describe your ideal customer and Velox AI finds the leads, writes personalised email + LinkedIn messages, and sends them every day on autopilot — from your own inbox. 21-day free trial, then plans from £19.99/mo.",
    path: "/",
  },
  "/features": {
    title: "Features — Velox AI, Discovery, Messaging & Autopilot Sequences | Velox House",
    description:
      "Every Velox House feature in detail: Velox AI that builds and launches a full campaign from one prompt, AI-planned lead discovery, per-prospect research and messaging, multichannel email + LinkedIn sequences on autopilot, pipeline, analytics and deliverability — all from your own inbox.",
    path: "/features",
  },
  "/tools": {
    title: "Free Email Deliverability Checker — Velox House",
    description:
      "Free tools for cold outreach: check your domain's email deliverability (SPF, DKIM, DMARC) and get a personalised Velox House plan recommendation. No sign-up required.",
    path: "/tools",
  },
};

function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setProperty(property: string, content: string) {
  const el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (el) el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/** Update document title + description + canonical + OG for the given path. */
export function applyRouteMeta(pathname: string) {
  const meta = ROUTE_META[pathname] ?? ROUTE_META["/"];
  const url = `${SITE}${meta.path}`;
  document.title = meta.title;
  setMeta("description", meta.description);
  setCanonical(url);
  setProperty("og:title", meta.title);
  setProperty("og:description", meta.description);
  setProperty("og:url", url);
  setMeta("twitter:title", meta.title);
  setMeta("twitter:description", meta.description);
}
