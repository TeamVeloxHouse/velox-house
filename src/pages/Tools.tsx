import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Calculator, Compass } from "lucide-react";
import DeliverabilityWidget from "../components/DeliverabilityWidget";

/**
 * Free tools hub. Each tool also lives on its own route so it can rank for its
 * own intent; this page is the index that links them together, with the
 * flagship deliverability checker inline so /tools stays useful on its own
 * (it's the URL the nav, blog and llms.txt have always pointed at).
 */

const TOOLS = [
  {
    to: "/tools/cold-email-roi-calculator",
    icon: Calculator,
    title: "Cold email ROI calculator",
    blurb:
      "Turn your volume, reply rate and deal size into a monthly forecast of conversations, deals and pipeline.",
  },
  {
    to: "/tools/plan-finder",
    icon: Compass,
    title: "Plan finder",
    blurb:
      "Five questions to the right Velox House plan for your volume, budget and goals — no guesswork.",
  },
];

export default function Tools() {
  return (
    <section
      data-vx-section="tools-hub"
      className="relative overflow-hidden bg-[#0A0A0A] pt-32 pb-24 md:pt-40 md:pb-32"
    >
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-50" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(218,41,28,0.10), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="flex items-center justify-center gap-4 text-xs font-semibold uppercase tracking-[0.25em] text-[#DA291C]">
            <span className="hidden h-px w-12 bg-[#DA291C]/40 sm:block" />
            Free tools · No sign-up
            <span className="hidden h-px w-12 bg-[#DA291C]/40 sm:block" />
          </div>

          <h1 className="mx-auto mt-6 font-display text-5xl font-extrabold leading-[1.0] tracking-[-0.02em] text-white md:text-6xl">
            Free tools for cold outreach
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#A0A0A0] md:text-lg">
            Practical tools we built for ourselves and opened up: check whether your
            domain can reach the inbox, forecast what outbound is worth to you, and
            find the plan that fits. Free, instant, no card.
          </p>
        </motion.div>

        {/* Flagship tool, inline */}
        <div className="mx-auto mt-14 max-w-2xl">
          <div className="mb-5 flex items-center gap-3">
            <ShieldCheck size={20} className="text-[#DA291C]" />
            <div>
              <h2 className="text-lg font-semibold text-white">
                Email deliverability check
              </h2>
              <div className="text-xs text-[#666]">SPF · DKIM · DMARC · MX</div>
            </div>
          </div>
          <DeliverabilityWidget source="deliverability_check" showHeader={false} />
          <Link
            to="/tools/email-deliverability-check"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#A0A0A0] transition-colors hover:text-white"
          >
            What each of these records does <ArrowRight size={14} />
          </Link>
        </div>

        {/* The rest */}
        <div className="mx-auto mt-20 grid max-w-4xl gap-5 md:grid-cols-2">
          {TOOLS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="group rounded-2xl border border-[#1A1A1A] bg-[#0F0F0F] p-7 transition-colors hover:border-[#DA291C]/50"
            >
              <t.icon size={20} className="text-[#DA291C]" />
              <h2 className="mt-4 font-display text-xl font-bold text-white">
                {t.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#A0A0A0]">
                {t.blurb}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#FF5A3C]">
                Open the tool
                <ArrowRight
                  size={14}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
