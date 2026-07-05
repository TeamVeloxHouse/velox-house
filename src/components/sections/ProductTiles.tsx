import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { inViewport } from "../../lib/utils";

const TILES = [
  {
    icon: "◉",
    title: "Find Leads",
    href: "/features#find-leads",
    desc: "Discover decision-makers by role, industry, company size and location.",
  },
  {
    icon: "✦",
    title: "AI Research",
    href: "/features#ai-research",
    desc: "Every prospect researched automatically — pain points, angles and fit.",
  },
  {
    icon: "◆",
    title: "AI Messaging",
    href: "/features#ai-messaging",
    desc: "Personalised cold emails, LinkedIn notes and follow-ups, written for you.",
  },
  {
    icon: "▶",
    title: "Sequences",
    href: "/features#sequences",
    desc: "Multi-step email + LinkedIn follow-up that runs until they reply.",
  },
  {
    icon: "■",
    title: "Pipeline & Inbox",
    href: "/features#pipeline-inbox",
    desc: "Every reply and deal stage in one place, from first touch to closed.",
  },
  {
    icon: "◐",
    title: "Analytics & Deliverability",
    href: "/features#analytics",
    desc: "Track opens, replies and meetings. Keep your domain inbox-safe.",
  },
];

export default function ProductTiles() {
  return (
    <section id="product" className="surface-sunken relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        {/* Heading block */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={inViewport}
          className="mb-16 flex flex-col gap-6 md:flex-row md:items-end md:justify-between"
        >
          <div className="max-w-3xl">
            <span className="text-sm font-semibold text-[#DA291C]">The platform</span>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.02em] text-white md:text-5xl">
              One platform.{" "}
              <span className="text-[#A0A0A0]">Everything your outreach needs.</span>
            </h2>
          </div>
          <Link
            to="/features"
            className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-[#DA291C] transition-colors hover:text-[#FF3B2D]"
          >
            Explore every feature <ArrowRight size={16} />
          </Link>
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
              >
                <Link
                  to={tile.href}
                  className="group relative block h-full bg-[#0A0A0A] p-8 transition-colors hover:bg-[#131313]"
                >
                  {/* hover sheen */}
                  <div className="glow-top pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-60" />
                  <div className="relative">
                    <div className="icon-chip mb-6 flex h-11 w-11 items-center justify-center rounded-xl text-xl text-[#FF6A4D]">
                      {tile.icon}
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-white">
                      {tile.title}
                    </h3>
                    <p className="text-sm text-[#A0A0A0]">{tile.desc}</p>
                    <div className="mt-6 flex items-center gap-1.5 text-sm text-[#DA291C] opacity-0 transition-opacity group-hover:opacity-100">
                      Learn more <ArrowRight size={14} />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
