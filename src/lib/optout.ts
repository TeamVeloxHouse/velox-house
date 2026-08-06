// Self-exclusion from analytics.
//
// The owner browsing their own site is not a visitor, and their traffic swamped the
// numbers — of the seven sessions that ever reached the sign-up page, five were the
// owner's own. Analytics you have to mentally subtract yourself from is analytics you
// can't read.
//
// Turn it on by visiting any page with `?vx_optout=1` (and off again with
// `?vx_optout=0`). The flag is per-browser and permanent, so it needs doing once on
// each device — phone included. The app sets the same flag automatically when an owner
// account signs in; this URL switch is what covers browsing the marketing site, where
// nobody is signed in.

const KEY = "vx_optout";

/** Read `?vx_optout=` and persist the choice. Call once, before the first page_view. */
export function adoptOptOutParam(): void {
  try {
    const v = new URLSearchParams(location.search).get(KEY);
    if (v === null) return;
    if (v === "1" || v === "true") localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);

    // Strip it so the flag isn't accidentally shared when the URL is copied.
    const p = new URLSearchParams(location.search);
    p.delete(KEY);
    const qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? `?${qs}` : "") + location.hash);
  } catch { /* ignore */ }
}

/** True when this browser has excluded itself — no event of any kind should be sent. */
export function isOptedOut(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}
