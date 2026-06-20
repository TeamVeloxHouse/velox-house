import { motion } from "framer-motion";

const STATS = [
  { value: "72h", label: "Deployment time" },
  { value: "0", label: "Contract length" },
  { value: "1", label: "Unified system" },
  { value: "24/7", label: "Visibility" },
];

export default function Hero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-[#0A0A0A] pt-16">
      {/* Dot grid texture */}
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-50" />
      {/* Subtle red radial at top */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(218,41,28,0.10), transparent 70%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-7xl px-6 py-24 md:px-12">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-[#222] bg-[#141414] px-3 py-1.5 text-xs text-[#A0A0A0]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#DA291C]" />
          For ambitious UK businesses · No contract ever
        </motion.div>

        {/* H1 */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="mt-8 max-w-4xl font-display text-5xl font-extrabold leading-[0.98] tracking-[-0.02em] text-white md:text-7xl lg:text-[88px]"
        >
          Build the system that grows your business.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.18 }}
          className="mt-8 max-w-2xl text-lg leading-relaxed text-[#A0A0A0] md:text-xl"
        >
          A complete marketing operation — website, CRM, outreach, content,
          analytics — deployed in 72 hours. No agency markup. No 12-month
          contract. Just results you can see.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28 }}
          className="mt-10 flex flex-wrap gap-3"
        >
          <a
            href="#seat"
            className="rounded-md bg-[#DA291C] px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D]"
          >
            Get Started — Free →
          </a>
          <a
            href="#how"
            className="rounded-md border border-[#2A2A2A] bg-transparent px-6 py-3.5 text-sm font-medium text-white transition-colors hover:border-[#444]"
          >
            See How It Works
          </a>
        </motion.div>

        {/* Stats grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-20 max-w-4xl overflow-hidden rounded-xl border border-[#1A1A1A]"
        >
          <div className="grid grid-cols-2 gap-px bg-[#1A1A1A] md:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="bg-[#0A0A0A] p-6">
                <div className="text-3xl font-bold text-white md:text-4xl">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-[#A0A0A0]">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
