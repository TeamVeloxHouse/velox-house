import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getCookieConsent, setCookieConsent } from "../lib/consent";

// PECR-compliant consent banner: non-essential (analytics) cookies stay OFF until the
// visitor accepts. Choice is remembered.
export default function CookieConsent() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(getCookieConsent() === null);
  }, []);
  if (!show) return null;

  function choose(v: "all" | "essential") {
    setCookieConsent(v);
    setShow(false);
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
