import { motion } from "framer-motion";
import { inViewport } from "../../lib/utils";

const TILES = [
  {
    icon: "◆",
    title: "CRM & Pipeline",
    desc: "Every lead tracked. Every stage visible. One source of truth.",
  },
  {
    icon: "◉",
    title: "AI Outreach",
    desc: "Personalised email and LinkedIn sequences that actually convert.",
  },
  {
    icon: "▲",
    title: "Lead Generation",
    desc: "Qualified prospects sourced and scored, delivered weekly.",
  },
  {
    icon: "■",
    title: "Content Engine",
    desc: "On-brand posts, articles and assets published on autopilot.",
  },
  {
    icon: "✦",
    title: "Analytics Dashboard",
    desc: "Live war room. See every result. No more agency PDFs.",
  },
  {
    icon: "▶",
    title: "72-Hour Deployment",
    desc: "Live within three days. Not three months.",
  },
];

export default function ProductTiles() {
  return (
    <section id="product" className="bg-[#0A0A0A] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        {/* Heading block */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={inViewport}
          className="mb-16 max-w-3xl"
        >
          <span className="text-sm font-semibold text-[#DA291C]">The product</span>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.02em] text-white md:text-5xl">
            One system.{" "}
            <span className="text-[#A0A0A0]">Everything your marketing needs.</span>
          </h2>
        </motion.div>

        {/* Tiles grid */}
        <div className="overflow-hidden rounded-xl border border-[#1A1A1A]">
          <div className="grid grid-cols-1 gap-px bg-[#1A1A1A] sm:grid-cols-2 lg:grid-cols-3">
            {TILES.map((tile, i) => (
              <motion.div
                key={tile.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={inViewport}
                transition={{ delay: i * 0.05 }}
                className="group bg-[#0A0A0A] p-8 transition-colors hover:bg-[#141414]"
              >
                <div className="mb-6 text-2xl text-[#DA291C]">{tile.icon}</div>
                <h3 className="mb-2 text-lg font-semibold text-white">
                  {tile.title}
                </h3>
                <p className="text-sm text-[#A0A0A0]">{tile.desc}</p>
                <div className="mt-6 text-sm text-[#DA291C] opacity-0 transition-opacity group-hover:opacity-100">
                  Learn more →
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
