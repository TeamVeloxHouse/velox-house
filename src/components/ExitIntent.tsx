import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { X, ShieldCheck } from "lucide-react";
import { getCookieConsent } from "../lib/consent";
import { track } from "../lib/track";
import DeliverabilityWidget from "./DeliverabilityWidget";

/**
 * Last-chance capture. Offers the free deliverability check to visitors who are
 * about to leave without taking any other route into the funnel.
 *
 * Deliberately restrained: once per visitor (ever), never on the pages that
 * already show the checker, never while the cookie banner is still up, and not
 * within the first 20 seconds of the visit. Desktop triggers on the mouse
 * leaving through the top of the viewport; touch devices have no exit intent,
 * so they get a scroll-depth + dwell trigger instead.
 */

const SEEN_KEY = "velox:exit-intent-seen";
const MIN_DWELL_MS = 20_000;

function alreadySeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* private mode — worst case they see it again next visit */
  }
}

export default function ExitIntent() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // Suppressed where the checker is already on the page.
  const suppressed = pathname.startsWith("/tools");

  useEffect(() => {
    if (suppressed || alreadySeen()) return;

    const mountedAt = Date.now();
    let done = false;

    const show = (trigger: string) => {
      if (done) return;
      // Don't stack an overlay on top of the cookie banner.
      if (!getCookieConsent()) return;
      if (Date.now() - mountedAt < MIN_DWELL_MS) return;
      done = true;
      markSeen();
      setOpen(true);
      track("exit_intent_shown", { label: trigger });
      cleanup();
    };

    const onMouseOut = (e: MouseEvent) => {
      // Only a genuine exit through the top of the window (towards tabs/address bar).
      if (e.clientY <= 0 && !e.relatedTarget) show("mouse_out");
    };

    const onScroll = () => {
      const scrolled =
        window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight);
      if (scrolled > 0.55) show("scroll_depth");
    };

    const isTouch = window.matchMedia("(hover: none)").matches;
    if (isTouch) {
      window.addEventListener("scroll", onScroll, { passive: true });
    } else {
      document.addEventListener("mouseout", onMouseOut);
    }

    function cleanup() {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseout", onMouseOut);
    }
    return cleanup;
  }, [suppressed]);

  // Escape to dismiss, and lock the page behind the modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  // Deliberately no exit animation: dismissing unmounts immediately, so a
  // half-finished fade can never leave an invisible full-screen overlay
  // swallowing clicks on the page underneath.
  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Free email deliverability check"
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        data-vx-section="exit-intent"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#2A2A2A] bg-[#0F0F0F] p-6 md:p-8"
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute right-4 top-4 text-[#666] transition-colors hover:text-white"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#DA291C]">
          <ShieldCheck size={15} />
          Free · 10 seconds
        </div>

        <h2 className="mt-4 font-display text-2xl font-bold leading-tight tracking-[-0.02em] text-white md:text-3xl">
          Before you go — are your emails even reaching the inbox?
        </h2>
        <p className="mt-3 text-sm text-[#A0A0A0]">
          We'll check your domain's SPF, DKIM, DMARC and mail records live and
          score them out of 100. No sign-up, no card.
        </p>

        <div className="mt-6">
          <DeliverabilityWidget source="exit_intent" compact />
        </div>

        <button
          onClick={() => setOpen(false)}
          className="mt-5 w-full text-center text-xs text-[#666] transition-colors hover:text-white"
        >
          No thanks, I'll pass
        </button>
      </motion.div>
    </motion.div>
  );
}
