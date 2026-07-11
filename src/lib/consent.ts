// Cookie/consent state for the marketing site. Non-essential analytics must not run until
// the visitor accepts, per PECR.
const KEY = "velox:cookie-consent"; // 'all' | 'essential'

export type Consent = "all" | "essential";

export function getCookieConsent(): Consent | null {
  try {
    return localStorage.getItem(KEY) as Consent | null;
  } catch {
    return null;
  }
}

export function setCookieConsent(v: Consent) {
  try {
    localStorage.setItem(KEY, v);
    if (v !== "all") {
      try {
        localStorage.removeItem("vx_sid");
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

/** True only when the visitor has accepted non-essential (analytics) cookies. */
export function analyticsAllowed(): boolean {
  return getCookieConsent() === "all";
}
