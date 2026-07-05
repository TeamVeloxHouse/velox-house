import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { inViewport } from "../../lib/utils";
import FeatureVisual from "./FeatureVisual";

// The differentiator: AI isn't one button, it runs through the whole workflow.
// Each item maps to a real capability shipped in the app (query-planner,
// score-leads, ai-insights dashboard/analytics/campaign, generate-reply).
const CAPABILITIES = [
  {
    step: "Find",
    title: "AI-planned discovery",
    desc: "Expands your ICP into dozens of searches and builds a market of hundreds — not a first page of 20.",
  },
  {
    step: "Rank",
    title: "AI fit-scoring",
    desc: "Every prospect scored and ranked by fit, with a reason — so you work the best matches first.",
  },
  {
    step: "Write",
    title: "Researched, personalised copy",
    desc: "Reads each business and drafts personalised emails and LinkedIn messages that sound like you.",
  },
  {
    step: "Act",
    title: "Next-best-actions",
    desc: "Tells you the 2–3 highest-leverage things to do right now, straight on your dashboard.",
  },
  {
    step: "Learn",
    title: "Explain my numbers",
    desc: "Turns your analytics into plain English and autopsies each campaign with tweaks for the next round.",
  },
  {
    step: "Reply",
    title: "Inbox reply suggestions",
    desc: "Reads the objection and tone of a reply and drafts your response, ready to edit and send.",
  },
];

export default function AiEverywhere() {
  return (
    <section className="surface-sunken relative overflow-hidden border-y border-[#161616] py-24 md:py-32">
      <div className="glow-top pointer-events-none absolute inset-0 opacity-70" />
      <div className="glow-corner pointer-events-none absolute inset-0" />

      <div className="relative mx-auto max-w-7xl px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={inViewport}
          className="mb-16 max-w-3xl"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-[#DA291C]/40 bg-[#DA291C]/10 px-3 py-1.5 text-xs font-semibold text-[#FF6A4D]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#DA291C]" />
            New · App-wide AI
          </span>
          <h2 className="mt-5 font-display text-4xl font-bold tracking-[-0.02em] text-white md:text-5xl">
            AI isn't a button here.{" "}
            <span className="text-gradient-red">It runs the whole workflow.</span>
          </h2>
          <p className="mt-4 text-lg text-[#A8A8A8]">
            From finding the right companies to drafting the reply, Velox House does
            the thinking with you at every step — so outbound works even if you've
            never run it before.
          </p>
        </motion.div>

        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Capability grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {CAPABILITIES.map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={inViewport}
                transition={{ delay: i * 0.06 }}
                className="card-depth rounded-xl p-5"
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-[#DA291C]">
                  {c.step}
                </div>
                <h3 className="mt-2 font-display text-base font-semibold text-white">
                  {c.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#9A9A9A]">{c.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Copilot visual + link */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={inViewport}
            transition={{ delay: 0.1 }}
            className="lg:sticky lg:top-24"
          >
            <FeatureVisual slug="ai-copilot" />
            <Link
              to="/features#ai-copilot"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#DA291C] transition-colors hover:text-[#FF3B2D]"
            >
              See how the AI Copilot works <ArrowRight size={16} />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
