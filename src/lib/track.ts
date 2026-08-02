// Analytics for the marketing site. Every event goes two places:
//
//   1. First-party — posted to the Velox app's public `track` edge function, which is
//      what powers the owner command-centre at hub.veloxhouse.co.uk/admin.
//   2. GA4 — via gtag, when VITE_GA4_ID is set and consent allows it (see ga.ts).
//
// Fire-and-forget, keepalive, and wrapped in try/catch throughout: telemetry must
// never break the site or delay a navigation.

import { analyticsAllowed } from "./consent";
import { gaEvent, gaPageView } from "./ga";

const TRACK_URL =
  ((import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ||
    "https://qmzfuadxcnweiwbrsutn.supabase.co") + "/functions/v1/track";

/** The anonymous, consent-only session identifier. Shared with the app via CTA links. */
export function sessionId(): string {
  try {
    let id = localStorage.getItem("vx_sid");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("vx_sid", id);
    }
    return id;
  } catch {
    return "anon";
  }
}

// The campaign that brought this visitor in, captured on the first page of the visit
// and remembered for the rest of it — so a signup started 6 pages later is still
// attributable to the ad/post that earned it.
const FIRST_TOUCH_KEY = "vx_first_touch";

export type FirstTouch = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  landing?: string;
};

export function firstTouch(): FirstTouch {
  try {
    const stored = sessionStorage.getItem(FIRST_TOUCH_KEY);
    if (stored) return JSON.parse(stored) as FirstTouch;
    const p = new URLSearchParams(location.search);
    let referrer = "";
    try {
      if (document.referrer && new URL(document.referrer).host !== location.host)
        referrer = new URL(document.referrer).host;
    } catch {
      /* ignore */
    }
    const t: FirstTouch = {
      utm_source: p.get("utm_source") ?? "",
      utm_medium: p.get("utm_medium") ?? "",
      utm_campaign: p.get("utm_campaign") ?? "",
      referrer,
      landing: location.pathname,
    };
    sessionStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(t));
    return t;
  } catch {
    return {};
  }
}

// Traffic-source + device context, attached to page_view events.
function context(): Record<string, string> {
  try {
    const ua = navigator.userAgent;
    const device = /Mobi|Android|iPhone/i.test(ua) ? "mobile" : /iPad|Tablet/i.test(ua) ? "tablet" : "desktop";
    const browser = /Edg/.test(ua) ? "Edge" : /OPR|Opera/.test(ua) ? "Opera" : /Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "Other";
    const p = new URLSearchParams(location.search);
    let referrer = "";
    try { if (document.referrer && new URL(document.referrer).host !== location.host) referrer = new URL(document.referrer).host; } catch { /* ignore */ }
    const ft = firstTouch();
    return {
      device,
      browser,
      referrer,
      // Per-hit campaign if this URL carries one, otherwise the visit's first touch.
      utm_source: p.get("utm_source") ?? ft.utm_source ?? "",
      utm_medium: p.get("utm_medium") ?? ft.utm_medium ?? "",
      utm_campaign: p.get("utm_campaign") ?? ft.utm_campaign ?? "",
    };
  } catch { return {}; }
}

export type TrackEvent = {
  event: string;
  path?: string;
  label?: string;
  props?: Record<string, unknown>;
};

function post(body: string, beacon: boolean) {
  // sendBeacon survives page unload where fetch (even keepalive) can be cut short.
  if (beacon) {
    try {
      if (navigator.sendBeacon?.(TRACK_URL, new Blob([body], { type: "application/json" }))) return;
    } catch {
      /* fall through to fetch */
    }
  }
  fetch(TRACK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

export function track(
  event: string,
  opts: { path?: string; label?: string; props?: Record<string, unknown> } = {}
) {
  // No analytics or identifier until the visitor accepts non-essential cookies (PECR).
  if (!analyticsAllowed()) return;
  try {
    const path = opts.path ?? (typeof location !== "undefined" ? location.pathname + location.hash : undefined);
    const props = event === "page_view" ? { ...context(), ...(opts.props ?? {}) } : opts.props;
    post(
      JSON.stringify({
        source: "marketing",
        event,
        path,
        label: opts.label,
        sessionId: sessionId(),
        props,
      }),
      false
    );
    // GA4 collects device/browser/campaign itself, so it only needs our own dimensions.
    if (event === "page_view") gaPageView(path);
    else gaEvent(event, { ...(opts.props ?? {}), ...(opts.label ? { label: opts.label } : {}), page_path: path });
  } catch {
    /* telemetry must never break the site */
  }
}

/**
 * Send several events in one request — used by the page-leave beacon, where each
 * extra request is a request the browser may never get around to making.
 * GA4 gets them individually; gtag does its own batching.
 */
export function trackBatch(events: TrackEvent[]) {
  if (!analyticsAllowed() || !events.length) return;
  try {
    const sid = sessionId();
    post(
      JSON.stringify({
        events: events.slice(0, 50).map((e) => ({
          source: "marketing",
          event: e.event,
          path: e.path ?? location.pathname + location.hash,
          label: e.label,
          sessionId: sid,
          props: e.props,
        })),
      }),
      true
    );
    for (const e of events.slice(0, 50)) {
      gaEvent(e.event, { ...(e.props ?? {}), ...(e.label ? { label: e.label } : {}), page_path: e.path });
    }
  } catch {
    /* never break the site on the way out of it */
  }
}

export function trackPageView(path?: string) {
  track("page_view", { path });
}
