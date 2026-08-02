// Engagement tracking: how long people actually stay, how far down they get, which
// parts of the page they linger on, and every click that heads into the app.
//
// Time is *active* time only — the clock pauses when the tab is hidden, so a page
// left open in a background tab doesn't read as an hour of rapt attention.
//
// Sections opt in with data-vx-section="name" on their root element. A section counts
// as "being read" while it sits under the middle band of the viewport.
//
// Everything is collected per page view and sent as ONE beacon when the visitor
// leaves (or changes route) — see trackBatch in track.ts.

import { track, trackBatch, sessionId, firstTouch, type TrackEvent } from "./track";
import { analyticsAllowed } from "./consent";
import { APP_URL } from "./utils";

const SECTION_ATTR = "data-vx-section";
const MIN_SECTION_MS = 2000; // ignore sections that merely scrolled past
const MILESTONES = [25, 50, 75, 100];
// Only the middle 10% band of the viewport counts, so "in view" means "being looked at".
const BAND = "-45% 0px -45% 0px";

const APP_HOST = (() => {
  try { return new URL(APP_URL).host; } catch { return "hub.veloxhouse.co.uk"; }
})();

let path = "";
let activeMs = 0;
let activeSince = 0; // 0 while paused
let maxScroll = 0;
const reached = new Set<number>(); // every milestone hit on this page
const milestones = new Set<number>(); // …and the ones not yet sent
const dwell = new Map<string, number>(); // section → unsent milliseconds
const inBand = new Map<string, number>(); // section → timestamp it entered the band
let io: IntersectionObserver | null = null;
let bound = false;
let scrollQueued = false;

const now = () => Date.now();

/* ─────────────────────────── active-time accounting ─────────────────────────── */

function pause() {
  if (activeSince) { activeMs += now() - activeSince; activeSince = 0; }
  const t = now();
  for (const [id, since] of inBand) { dwell.set(id, (dwell.get(id) ?? 0) + (t - since)); inBand.set(id, 0); }
}

function resume() {
  if (!activeSince) activeSince = now();
  const t = now();
  for (const [id, since] of inBand) if (!since) inBand.set(id, t);
}

/* ────────────────────────────────── scroll ─────────────────────────────────── */

function measureScroll() {
  scrollQueued = false;
  try {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    const pct = scrollable <= 0 ? 100 : Math.round((window.scrollY / scrollable) * 100);
    maxScroll = Math.min(100, Math.max(maxScroll, pct));
    for (const m of MILESTONES) if (maxScroll >= m && !reached.has(m)) { reached.add(m); milestones.add(m); }
  } catch { /* ignore */ }
}

function onScroll() {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(measureScroll);
}

/* ───────────────────────────── section observation ─────────────────────────── */

function observeSections() {
  io?.disconnect();
  if (typeof IntersectionObserver === "undefined") return;
  io = new IntersectionObserver(
    (entries) => {
      const t = now();
      for (const entry of entries) {
        const id = entry.target.getAttribute(SECTION_ATTR);
        if (!id) continue;
        if (entry.isIntersecting) {
          if (!inBand.has(id)) inBand.set(id, document.visibilityState === "visible" ? t : 0);
        } else if (inBand.has(id)) {
          const since = inBand.get(id) ?? 0;
          if (since) dwell.set(id, (dwell.get(id) ?? 0) + (t - since));
          inBand.delete(id);
        }
      }
    },
    { rootMargin: BAND, threshold: 0 }
  );
  document.querySelectorAll(`[${SECTION_ATTR}]`).forEach((el) => io!.observe(el));
}

/* ──────────────────────────────── page lifecycle ───────────────────────────── */

/**
 * Send everything measured since the last send. Deliberately incremental and safe to
 * call repeatedly: a visitor who backgrounds the tab and comes back keeps being
 * measured, and nothing is counted twice. The dashboard sums the parts per session +
 * path to get true time on page.
 */
export function flush() {
  if (!path) return;
  pause();

  const seconds = Math.round(activeMs / 1000);
  const events: TrackEvent[] = [];

  if (seconds >= 1) {
    events.push({ event: "page_time", path, props: { seconds, scroll_max: maxScroll } });
    activeMs = 0;
  }
  for (const m of [...milestones].sort((a, b) => a - b)) {
    events.push({ event: "scroll_depth", path, label: String(m) });
  }
  milestones.clear();
  for (const [id, ms] of [...dwell.entries()].sort((a, b) => b[1] - a[1])) {
    if (ms < MIN_SECTION_MS) continue;
    events.push({ event: "section_time", path, label: id, props: { seconds: Math.round(ms / 1000) } });
    dwell.delete(id);
  }

  if (events.length) trackBatch(events);
}

/** Start (or restart, on a route change) engagement measurement for a page. */
export function startPage(nextPath: string) {
  flush();
  path = nextPath;
  activeMs = 0;
  activeSince = document.visibilityState === "visible" ? now() : 0;
  maxScroll = 0;
  reached.clear();
  milestones.clear();
  dwell.clear();
  inBand.clear();
  // Sections mount with the route; wait a frame so they're in the DOM and the new
  // scroll position has settled (a short page is 100% scrolled the moment it loads).
  requestAnimationFrame(() => { measureScroll(); observeSections(); });
}

/* ───────────────────────── app-bound links (the funnel) ────────────────────── */

function appAnchor(e: Event): HTMLAnchorElement | null {
  const el = e.target as Element | null;
  const a = el?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a) return null;
  try { return new URL(a.href).host === APP_HOST ? a : null; } catch { return null; }
}

function sectionOf(el: Element | null): string {
  return el?.closest(`[${SECTION_ATTR}]`)?.getAttribute(SECTION_ATTR) ?? "";
}

/**
 * Carry the visit across to the app: the same anonymous session id, the consent the
 * visitor already gave, and the campaign that brought them in. Without this the
 * marketing visit and the signup are two unrelated strangers on two domains.
 */
function decorate(a: HTMLAnchorElement) {
  if (!analyticsAllowed()) return; // no identifier without consent
  try {
    const u = new URL(a.href);
    if (u.host !== APP_HOST) return;
    if (!u.searchParams.has("vx_sid")) u.searchParams.set("vx_sid", sessionId());
    u.searchParams.set("vx_c", "all");
    const ft = firstTouch();
    for (const k of ["utm_source", "utm_medium", "utm_campaign"] as const) {
      if (ft[k] && !u.searchParams.has(k)) u.searchParams.set(k, ft[k] as string);
    }
    a.href = u.toString();
  } catch { /* leave the link exactly as it was */ }
}

function onPointerDown(e: Event) {
  const a = appAnchor(e);
  if (a) decorate(a); // decorate before the browser starts the navigation
}

function onClick(e: Event) {
  const a = appAnchor(e);
  if (!a) return;
  decorate(a);
  try {
    const u = new URL(a.href);
    const destination = u.pathname.startsWith("/signup") ? "signup" : u.pathname.startsWith("/login") ? "login" : "app";
    const section = sectionOf(a);
    const text = (a.getAttribute("aria-label") || a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);
    track("cta_click", {
      label: section ? `${section} — ${text}` : text || u.pathname,
      props: { destination, section, text, scroll_at: maxScroll },
    });
  } catch { /* ignore */ }
}

/* ────────────────────────────────── wiring ─────────────────────────────────── */

/** Bind the global listeners. Call once, on app boot. */
export function initEngagement() {
  if (bound || typeof window === "undefined") return;
  bound = true;
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { flush(); } else { resume(); }
  });
  // pagehide is the one unload-ish event that fires reliably on mobile Safari.
  window.addEventListener("pagehide", flush);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("click", onClick, true);
}
