import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { FEATURES, PLATFORM_TRUTHS } from "../lib/features";
import { inViewport, SIGNUP_URL } from "../lib/utils";
import { track } from "../lib/track";
import FeatureDetail, { FeatureListCTA } from "../components/sections/FeatureDetail";
import FinalCTA from "../components/sections/FinalCTA";

function FeaturesHero() {
  return (
    <section className="relative overflow-hidden bg-[#0A0A0A] pt-32 pb-20 md:pt-40 md:pb-24">
      <div className="glow-top pointer-events-none absolute inset-0 opacity-90" />
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative mx-auto max-w-7xl px-6 md:px-12">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-[#222] bg-[#141414] px-3 py-1.5 text-xs text-[#A0A0A0]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#DA291C]" />
          The whole platform, in detail
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-8 max-w-4xl font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.02em] text-white md:text-6xl"
        >
          Everything you need to turn cold contacts into{" "}
          <span className="text-gradient-red">booked meetings.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-6 max-w-2xl text-lg leading-relaxed text-[#A8A8A8]"
        >
          Velox House isn't a single trick — it's the full outbound workflow, from
          finding the right people to landing the reply. Here's exactly what each
          part does, and why it moves the needle.
        </motion.p>

        {/* Jump menu */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-10 flex flex-wrap gap-2.5"
        >
          {FEATURES.map((f) => (
            <a
              key={f.slug}
              href={`#${f.slug}`}
              className="flex items-center gap-2 rounded-full border border-[#1F1F1F] bg-[#0F0F0F] px-4 py-2 text-sm text-[#B8B8B8] transition-colors hover:border-[#DA291C]/40 hover:text-white"
            >
              <span className="text-[#DA291C]">{f.glyph}</span>
              {f.eyebrow}
            </a>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-10"
        >
          <a
            href={SIGNUP_URL}
            onClick={() => track("cta_click", { label: "Features hero — Start free" })}
            className="inline-flex items-center gap-2 rounded-md bg-[#DA291C] px-6 py-3.5 text-sm font-semibold text-white shadow-cta transition-all hover:bg-[#FF3B2D] hover:shadow-glow-lg"
          >
            Start free trial <ArrowRight size={16} />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

function PlatformTruths() {
  return (
    <section className="surface-raised relative overflow-hidden border-y border-[#161616] py-24 md:py-28">
      <div className="glow-corner pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-7xl px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={inViewport}
          className="mb-14 max-w-3xl"
        >
          <span className="text-sm font-semibold text-[#DA291C]">How it's built</span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.02em] text-white md:text-4xl">
            The decisions that make it different.
          </h2>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2">
          {PLATFORM_TRUTHS.map((t, i) => (
            <motion.div
              key={t.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inViewport}
              transition={{ delay: i * 0.08 }}
              className="card-depth rounded-xl p-7"
            >
              <h3 className="font-display text-lg font-semibold text-white">{t.label}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#9A9A9A]">{t.detail}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Features() {
  return (
    <>
      <FeaturesHero />

      <section className="bg-[#0A0A0A] py-24 md:py-28">
        <div className="mx-auto max-w-7xl space-y-28 px-6 md:px-12">
          {FEATURES.map((f, i) => (
            <FeatureDetail key={f.slug} feature={f} index={i} />
          ))}
          <div className="divider-glow" />
          <FeatureListCTA />
        </div>
      </section>

      <PlatformTruths />
      <FinalCTA />
    </>
  );
}
