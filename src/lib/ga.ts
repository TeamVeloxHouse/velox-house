// Google Analytics 4 for the marketing site.
//
// Nothing reaches Google until the visitor accepts non-essential cookies: Consent
// Mode v2 denies every storage type on boot, and gtag.js is only injected once
// consent is granted (from the banner, or on load if the choice was already made).
//
// Set VITE_GA4_ID to the Measurement ID (G-XXXXXXXXXX). With it unset GA4 is simply
// off and the first-party analytics in track.ts carry on alone.

import { analyticsAllowed } from "./consent";

export const GA_ID = ((import.meta.env.VITE_GA4_ID as string | undefined) ?? "").trim();

// Domains that share this GA4 property, so a visitor crossing from the marketing site
// into the app stays one session (gtag decorates the outbound link with _gl).
const LINKER_DOMAINS = ["veloxhouse.co.uk", "www.veloxhouse.co.uk", "hub.veloxhouse.co.uk"];

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

// gtag.js expects the raw `arguments` object on the queue, not an array.
// eslint-disable-next-line @typescript-eslint/no-unused-vars, prefer-rest-params
function gtag(..._args: unknown[]) {
  (window.dataLayer ??= []).push(arguments);
}

let loaded = false;

/** True once gtag.js has actually been injected (i.e. consent granted + ID present). */
export function gaReady(): boolean {
  return loaded;
}

/**
 * Queue the Consent Mode v2 defaults. Must run before anything else touches the
 * dataLayer, so call it as early as possible on boot.
 */
export function gaInit() {
  if (!GA_ID) return;
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    functionality_storage: "granted",
    security_storage: "granted",
  });
  if (analyticsAllowed()) gaLoad(false);
}

/**
 * Inject gtag.js and flip analytics_storage on. Safe to call repeatedly.
 * `sendPageView` is true when consent arrives mid-visit — the route's own page_view
 * has already been and gone by then, so we replay it.
 */
export function gaLoad(sendPageView = true) {
  if (!GA_ID || loaded || !analyticsAllowed()) return;
  loaded = true;

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);

  gtag("js", new Date());
  gtag("consent", "update", { analytics_storage: "granted" });
  gtag("config", GA_ID, {
    // The SPA sends its own page_view on every route + hash change.
    send_page_view: false,
    linker: { domains: LINKER_DOMAINS, accept_incoming: true },
  });

  if (sendPageView) gaPageView();
}

/** Withdraw consent mid-visit — gtag stops using storage from here on. */
export function gaDeny() {
  if (!GA_ID) return;
  gtag("consent", "update", { analytics_storage: "denied" });
}

export function gaEvent(name: string, params: Record<string, unknown> = {}) {
  if (!loaded) return;
  gtag("event", name, params);
}

export function gaPageView(path?: string) {
  if (!loaded) return;
  gtag("event", "page_view", {
    page_location: path ? location.origin + path : location.href,
    page_title: document.title,
    page_referrer: document.referrer || undefined,
  });
}
