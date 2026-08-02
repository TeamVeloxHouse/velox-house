// Cloudflare Web Analytics — the honest traffic total.
//
// The first-party analytics (track.ts) and GA4 (ga.ts) both need consent, so they only
// ever see the visitors who accept cookies. This beacon is the counterweight: it sets no
// cookies, writes nothing to the device, and identifies nobody, so it can count everyone
// who lands on the site. Use it for "how many people came"; use the other two for what
// those people did.
//
// Because it stores/accesses nothing on the visitor's device, PECR consent isn't engaged
// and it deliberately runs before any banner interaction. It's still disclosed in the
// Cookie Policy.
//
// LEAVE VITE_CF_BEACON_TOKEN UNSET while the Cloudflare site is on "Automatic setup"
// (Web Analytics → Manage site → RUM). Automatic setup injects the beacon at the edge,
// so setting the token here would load a SECOND beacon and double every page view.
//
// This exists for the other case: if automatic injection is ever turned off — or the
// site moves off Cloudflare's proxy — set the token from Web Analytics → your site →
// "JS snippet" and measurement continues uninterrupted. Unset = nothing loads.

const TOKEN = ((import.meta.env.VITE_CF_BEACON_TOKEN as string | undefined) ?? "").trim();

let loaded = false;

export function cfAnalyticsInit() {
  if (!TOKEN || loaded || typeof document === "undefined") return;
  loaded = true;
  const s = document.createElement("script");
  s.defer = true;
  s.src = "https://static.cloudflareinsights.com/beacon.min.js";
  // beacon.min.js reads this off its own script element at execution time.
  s.setAttribute("data-cf-beacon", JSON.stringify({ token: TOKEN }));
  document.head.appendChild(s);
}
