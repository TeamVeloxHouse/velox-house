// Marketing → app hand-off of the details someone has ALREADY given us.
//
// When a visitor fills in a lead form here (final CTA, ROI calculator, deliverability
// checker) and then clicks "Get started", they used to arrive at hub.veloxhouse.co.uk/signup
// facing an empty form and had to type their name and email a second time. That re-typing
// is exactly where people give up.
//
// The hand-off rides on a cookie scoped to `.veloxhouse.co.uk` — shared by the marketing
// site and the app — rather than a query string, so an email address never appears in a URL,
// a browser history entry, a referrer header or an edge log.

const COOKIE = "vx_prefill";
const MAX_AGE = 60 * 60 * 24 * 7; // a week — long enough to come back and finish

export type Prefill = { name?: string; email?: string };

/** Remember what they've told us, for the signup form to pick up on the other domain. */
export function setPrefill(data: Prefill): void {
  try {
    const clean: Prefill = {};
    if (data.name?.trim()) clean.name = data.name.trim().slice(0, 120);
    if (data.email?.trim()) clean.email = data.email.trim().slice(0, 254);
    if (!clean.email && !clean.name) return;

    // encodeURIComponent-then-btoa so non-ASCII names survive the cookie round trip.
    const value = btoa(encodeURIComponent(JSON.stringify(clean)));
    const domain = location.hostname.endsWith("veloxhouse.co.uk") ? "; domain=.veloxhouse.co.uk" : "";
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE}=${value}; path=/; max-age=${MAX_AGE}; SameSite=Lax${domain}${secure}`;
  } catch { /* a form that can't prefill is still a form that works */ }
}
