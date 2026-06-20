import { motion } from "framer-motion";
import FreeTools from "../components/FreeTools";
import StackBuilder from "../components/sections/StackBuilder";
import { inViewport } from "../lib/utils";

export default function Tools() {
  return (
    <>
      {/* Interactive free-tools hub (its own hero + 6 live tools) */}
      <FreeTools />

      {/* Stack builder questionnaire */}
      <StackBuilder />

      {/* More tools teaser */}
      <section className="border-t border-[#1A1A1A] bg-[#0A0A0A] py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6 md:px-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={inViewport}
            className="max-w-3xl"
          >
            <span className="text-sm font-semibold text-[#DA291C]">Coming soon</span>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.02em] text-white md:text-5xl">
              More free tools on the way.
            </h2>
            <p className="mt-4 text-[#A0A0A0]">
              ROI calculators, deliverability checkers, and pipeline forecasters —
              all free, all built for ambitious UK businesses.
            </p>
            <a
              href="/#seat"
              className="mt-8 inline-block rounded-md bg-[#DA291C] px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D]"
            >
              Get notified →
            </a>
          </motion.div>
        </div>
      </section>
    </>
  );
}
