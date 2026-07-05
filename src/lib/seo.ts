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
    title: "Velox House — AI Cold Email & Outreach Software for B2B Teams",
    description:
      "AI cold email & outreach software for B2B teams. Find prospects, write personalised emails, and run email + LinkedIn follow-up sequences from your own inbox. Free forever plan — no card.",
    path: "/",
  },
  "/features": {
    title: "Features — Find, Research, Write & Send | Velox House",
    description:
      "Every Velox House feature in detail: find B2B leads, AI research and messaging, multichannel email + LinkedIn sequences, pipeline, inbox, analytics and deliverability — all from your own inbox.",
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
