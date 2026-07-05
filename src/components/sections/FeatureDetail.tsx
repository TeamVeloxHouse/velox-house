import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import { inViewport, SIGNUP_URL } from "../../lib/utils";
import type { Feature } from "../../lib/features";
import FeatureVisual from "./FeatureVisual";

export default function FeatureDetail({
  feature,
  index,
}: {
  feature: Feature;
  index: number;
}) {
  const reverse = index % 2 === 1;

  const copy = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={inViewport}
      className={reverse ? "lg:order-2" : ""}
    >
      <div className="flex items-center gap-3">
        <span className="icon-chip flex h-11 w-11 items-center justify-center rounded-xl text-lg text-[#FF6A4D]">
          {feature.glyph}
        </span>
        <span className="text-sm font-semibold uppercase tracking-wider text-[#DA291C]">
          {feature.eyebrow}
        </span>
      </div>

      <h2 className="mt-5 font-display text-3xl font-bold tracking-[-0.02em] text-white md:text-4xl">
        {feature.name}
      </h2>
      <p className="mt-3 text-lg text-[#B0B0B0]">{feature.tagline}</p>

      {/* What it is */}
      <p className="mt-6 leading-relaxed text-[#9A9A9A]">{feature.what}</p>

      {/* What it does */}
      <div className="mt-7">
        <div className="text-xs font-semibold uppercase tracking-wider text-[#666]">
          What it does
        </div>
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {feature.does.map((d) => (
            <li key={d} className="flex items-start gap-2.5">
              <Check size={16} className="mt-0.5 shrink-0 text-[#DA291C]" />
              <span className="text-sm text-[#D0D0D0]">{d}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Why it matters */}
      <div className="mt-7 rounded-xl border-l-2 border-[#DA291C] bg-gradient-to-r from-[#DA291C]/[0.07] to-transparent p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-[#FF6A4D]">
          Why it matters
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[#D8D8D8]">{feature.why}</p>
      </div>
    </motion.div>
  );

  const visual = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={inViewport}
      transition={{ delay: 0.1 }}
      className={reverse ? "lg:order-1" : ""}
    >
      <FeatureVisual slug={feature.slug} />
    </motion.div>
  );

  return (
    <div
      id={feature.slug}
      className="scroll-mt-24 grid items-center gap-12 md:grid-cols-2 lg:gap-20"
    >
      {copy}
      {visual}
    </div>
  );
}

/* Small anchor CTA used at the foot of the feature list */
export function FeatureListCTA() {
  return (
    <div className="text-center">
      <a
        href={SIGNUP_URL}
        className="inline-flex items-center gap-2 rounded-md bg-[#DA291C] px-6 py-3.5 text-sm font-semibold text-white shadow-cta transition-all hover:bg-[#FF3B2D] hover:shadow-glow-lg"
      >
        Start free — every feature, no card <ArrowRight size={16} />
      </a>
    </div>
  );
}
