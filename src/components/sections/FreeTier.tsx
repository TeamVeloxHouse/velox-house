import { motion } from "framer-motion";
import { Check, Infinity as InfinityIcon } from "lucide-react";
import { inViewport, SIGNUP_URL } from "../../lib/utils";
import { track } from "../../lib/track";

// The free plan is a real acquisition lever, so it gets its own section that
// makes the "actually usable, forever" case — not a 7-day trial. Numbers mirror
// the app's `trial` tier in credits.ts (100 contacts, 50 AI credits, unlimited send).
const INCLUDED = [
  "100 new contacts every month",
  "50 AI credits for research & writing",
  "Unlimited email sending — never metered",
  "Full AI research on every prospect",
  "AI-written emails and follow-ups",
  "Multi-step sequences from your own inbox",
  "Pipeline, inbox and live analytics",
  "Deliverability checks to stay inbox-safe",
];

export default function FreeTier() {
  return (
    <section id="free" className="surface-sunken relative overflow-hidden py-24 md:py-32">
      {/* Atmospherics */}
      <div className="glow-top pointer-events-none absolute inset-0 opacity-80" />
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-30" />

      <div className="relative mx-auto max-w-7xl px-6 md:px-12">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={inViewport}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-[#DA291C]/40 bg-[#DA291C]/10 px-3 py-1.5 text-xs font-semibold text-[#FF6A4D]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#DA291C]" />
              Free forever · No credit card
            </span>

            <h2 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-white md:text-5xl">
              Not a trial.{" "}
              <span className="text-gradient-red">A free plan that books meetings.</span>
            </h2>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#B0B0B0]">
              Most tools give you 7 days, then a paywall. Velox House gives you a
              free plan you can run real outreach on — every month, with no expiry
              and no card on file. Find prospects, let the AI research and write,
              send from your own inbox, and watch the replies come in. Upgrade only
              when it's already working.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href={SIGNUP_URL}
                onClick={() => track("cta_click", { label: "Free tier — Start free" })}
                className="rounded-md bg-[#DA291C] px-6 py-3.5 text-sm font-semibold text-white shadow-cta transition-all hover:bg-[#FF3B2D] hover:shadow-glow-lg"
              >
                Start free — no card →
              </a>
              <span className="flex items-center gap-2 text-sm text-[#888]">
                <InfinityIcon size={16} className="text-[#DA291C]" />
                Unlimited sending on the free plan
              </span>
            </div>
          </motion.div>

          {/* What you get card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={inViewport}
            transition={{ delay: 0.1 }}
            className="card-ember rounded-2xl p-8"
          >
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-sm font-semibold text-[#FF6A4D]">Free plan</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-display text-5xl font-bold text-white">£0</span>
                  <span className="text-sm text-[#888]">/forever</span>
                </div>
              </div>
              <span className="rounded-full border border-[#DA291C]/40 px-3 py-1 text-xs font-medium text-[#FF6A4D]">
                No expiry
              </span>
            </div>

            <div className="divider-glow my-6" />

            <ul className="space-y-3">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#DA291C]/15">
                    <Check size={12} className="text-[#FF6A4D]" />
                  </span>
                  <span className="text-sm text-white">{item}</span>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-xs text-[#777]">
              Need more reach? Paid plans add LinkedIn, more contacts and team seats
              from £19.99/mo — same product, bigger allowances.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
