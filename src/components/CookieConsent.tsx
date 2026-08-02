import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getCookieConsent, setCookieConsent } from "../lib/consent";
import { trackPageView } from "../lib/track";
import { startPage } from "../lib/engagement";
import { gaDeny, gaLoad } from "../lib/ga";

// Re-open the banner from anywhere (the "Cookie settings" link in the footer).
const REOPEN = "velox:cookie-settings";
export function openCookieSettings() {
  window.dispatchEvent(new Event(REOPEN));
}

// PECR-compliant consent banner: non-essential (analytics) cookies stay OFF until the
// visitor accepts. Choice is remembered. Accepting starts analytics immediately —
// GA4 loads, and the page view they're on is backfilled rather than lost.
export default function CookieConsent() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(getCookieConsent() === null);
    const onReopen = () => setShow(true);
    window.addEventListener(REOPEN, onReopen);
    return () => window.removeEventListener(REOPEN, onReopen);
  }, []);
  if (!show) return null;

  function choose(v: "all" | "essential") {
    setCookieConsent(v);
    setShow(false);
    if (v === "all") {
      gaLoad(false); // GA4 gets the page view from trackPageView below
      trackPageView();
      startPage(location.pathname + location.hash);
    } else {
      gaDeny();
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-4">
      <div className="flex w-full max-w-3xl flex-col gap-3 rounded-xl border border-[#222] bg-[#0F0F0F] p-4 shadow-2xl sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-[#A0A0A0]">
          We use essential cookies to run this site, and — with your consent —
          analytics cookies to understand traffic.{" "}
          <Link to="/legal/cookies" className="text-[#FF5A3C] hover:underline">
            Cookie Policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => choose("essential")}
            className="flex-1 rounded-lg border border-[#2A2A2A] px-3 py-2 text-sm font-medium text-white transition-colors hover:border-[#444] sm:flex-none"
          >
            Reject non-essential
          </button>
          <button
            onClick={() => choose("all")}
            className="flex-1 rounded-lg bg-[#DA291C] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D] sm:flex-none"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
