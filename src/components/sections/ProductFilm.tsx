import { motion } from "framer-motion";
import { inViewport } from "../../lib/utils";
import HeroVideo from "./HeroVideo";

// The Remotion product film, moved out of the hero (the interactive Velox AI demo
// lives there now) into its own section directly below.
export default function ProductFilm() {
  return (
    <section className="border-t border-[#1A1A1A] bg-[#0A0A0A] py-24">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={inViewport}
          className="max-w-3xl"
        >
          <span className="text-sm font-semibold text-[#DA291C]">See it for real</span>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.02em] text-white md:text-5xl">
            The actual product, in 25 seconds.
          </h2>
        </motion.div>
        <HeroVideo />
      </div>
    </section>
  );
}
