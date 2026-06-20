import { motion } from "framer-motion";
import { inViewport } from "../../lib/utils";

const COMPANIES = [
  "NORTHWIND",
  "ACME CO",
  "HELIOS",
  "MERIDIAN",
  "AURORA",
  "BLACKBIRD",
  "VERTEX",
  "ATLAS",
];

export default function SocialProof() {
  return (
    <section className="border-y border-[#1A1A1A] bg-[#0A0A0A] py-20">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={inViewport}
          className="text-center text-sm text-[#A0A0A0]"
        >
          Trusted by 200+ growing UK businesses
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={inViewport}
          transition={{ delay: 0.1 }}
          className="mt-12 grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4 lg:grid-cols-8"
        >
          {COMPANIES.map((name) => (
            <div
              key={name}
              className="cursor-default text-center text-sm font-semibold uppercase tracking-[0.2em] text-[#555] transition-colors hover:text-[#888]"
            >
              {name}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
