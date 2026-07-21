import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { inViewport } from "../../lib/utils";
import FeatureVisual from "./FeatureVisual";

// The differentiator: you run the whole campaign from one prompt. Each step maps
// to a real capability of the Velox AI operator (generate_campaign_plan,
// launch_campaign → discover, autopilot goal-seeking, analyze_analytics).
const CAPABILITIES = [
  {
    step: "Prompt",
    title: "One line to a full plan",
    desc: "Describe who you want to reach. A couple of quick taps to scope it, and Velox AI builds the entire campaign.",
  },
  {
    step: "Find",
    title: "AI-planned discovery",
    desc: "Finds and verifies real decision-makers that match — with a working email behind every one.",
  },
  {
    step: "Write",
    title: "Researched, personalised copy",
    desc: "Researches each business and drafts the emails and LinkedIn messages — personalised, in your voice.",
  },
  {
    step: "Send",
    title: "Launches across both channels",
    desc: "One approval and it goes live, sending email + LinkedIn on a natural, inbox-safe schedule.",
  },
  {
    step: "Autopilot",
    title: "Runs to your goal",
    desc: "Set a target like ‘50 replies a week’ and it keeps finding and sending until it's hit — every day.",
  },
  {
    step: "Learn",
    title: "Explains your numbers",
    desc: "Reads your analytics back in plain English and tells you exactly what to change next.",
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
            New · Velox AI
          </span>
          <h2 className="mt-5 font-display text-4xl font-bold tracking-[-0.02em] text-white md:text-5xl">
            Type one prompt.{" "}
            <span className="text-gradient-red">It builds and runs the whole campaign.</span>
          </h2>
          <p className="mt-4 text-lg text-[#A8A8A8]">
            Velox AI is the first outreach tool you run from a single prompt. Tell it
            who you want to reach and it finds the leads, writes the messages, and sends
            across email and LinkedIn — every day, without you. Nothing else does this.
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
