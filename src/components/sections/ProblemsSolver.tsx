import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { inViewport } from "../../lib/utils";

interface Problem {
  tile: string;
  headline: string;
  body: string;
  solutions: string[];
  chip: string;
}

const PROBLEMS: Problem[] = [
  {
    tile: "I have no consistent flow of new leads",
    headline: "Your pipeline is empty because your outreach isn't running.",
    body: "We deploy a personalised outreach operation contacting 500+ ideal clients every month. Messages reference real, specific things about each business. Response rates run 3–5× higher than generic cold email.",
    solutions: ["Outreach Engine", "LinkedIn Signal", "War Room Dashboard"],
    chip: "Red Chip from £1,500/mo",
  },
  {
    tile: "My website isn't converting visitors into enquiries",
    headline: "Your website is leaking leads every single day.",
    body: "We build websites around your ideal client's journey — clear messaging, specific CTAs, conversion elements. Live in 72 hours. Tracked from day one.",
    solutions: ["Custom Website", "War Room Dashboard"],
    chip: "White Chip from £750/mo",
  },
  {
    tile: "I'm paying an agency but don't know what I'm getting",
    headline: "If you can't see exactly what your agency did last week, that's the problem.",
    body: "We replace your agency with a full stack you own and see in real time. Every message sent, every post published, every lead — visible in your war room. No monthly PDF reports.",
    solutions: ["War Room Dashboard", "Outreach Engine", "Content Machine"],
    chip: "Red Chip from £1,500/mo",
  },
  {
    tile: "I have no CRM or pipeline visibility",
    headline: "You're running your business on guesswork and a spreadsheet.",
    body: "We build a custom CRM around how your business actually works. Your pipeline stages, your lead sources, your follow-up process. Every lead tracked from first touch to closed deal.",
    solutions: ["AI-Powered CRM", "War Room Dashboard"],
    chip: "White Chip from £750/mo",
  },
  {
    tile: "Marketing is taking too much of my time",
    headline: "You're running a business, not a marketing agency.",
    body: "We take the entire marketing operation off your plate — content scheduled, outreach running, leads tracked. Most clients spend less than 20 minutes a week on their marketing after we set it up.",
    solutions: ["Content Machine", "Outreach Engine", "AI-Powered CRM"],
    chip: "Blue Chip from £2,500/mo",
  },
  {
    tile: "I'm locked in a contract that isn't working",
    headline: "You shouldn't be paying for something that isn't delivering.",
    body: "We operate with no contracts at any level. Start when you're ready. Stop when you want. When your current contract ends, we can have your full replacement stack live before you've sent the cancellation email.",
    solutions: ["Full Stack", "War Room Dashboard"],
    chip: "Any chip — no contract ever",
  },
  {
    tile: "My emails are going to spam",
    headline: "Your email domain has a deliverability problem — and it's costing you leads.",
    body: "We configure your email infrastructure properly. SPF, DKIM, DMARC. Sending domain setup. Warming protocols that get your messages into inboxes.",
    solutions: ["Email Infrastructure Setup", "Outreach Engine"],
    chip: "White Chip from £750/mo",
  },
  {
    tile: "I have no social media presence that drives business",
    headline: "Social media that doesn't convert is just noise.",
    body: "We don't post for the sake of posting. Every piece of content attracts your ideal clients. 30 posts a month across LinkedIn, Instagram, and TikTok. Written, designed, scheduled.",
    solutions: ["Content Machine", "LinkedIn Signal"],
    chip: "Red Chip from £1,500/mo",
  },
];

export default function ProblemsSolver() {
  const [active, setActive] = useState<number | null>(null);
  const current = active !== null ? PROBLEMS[active] : null;

  return (
    <section className="bg-[#0A0A0A] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={inViewport}
          className="max-w-3xl"
        >
          <span className="text-sm font-semibold text-[#DA291C]">The problem</span>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.02em] text-white md:text-5xl">
            What's holding your business back?
          </h2>
          <p className="mt-4 text-[#A0A0A0]">
            Select what resonates. We'll show you exactly how we fix it.
          </p>
        </motion.div>

        {/* Tiles */}
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROBLEMS.map((p, i) => (
            <motion.button
              key={p.tile}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inViewport}
              transition={{ delay: (i % 4) * 0.05 }}
              onClick={() => setActive(active === i ? null : i)}
              className={`rounded-xl border bg-[#0A0A0A] p-4 text-left text-sm transition-all hover:bg-[#141414] ${
                active === i
                  ? "border-[#DA291C] bg-[#141414] text-white"
                  : "border-[#1A1A1A] text-[#A0A0A0] hover:border-[#DA291C]/40"
              }`}
            >
              {p.tile}
            </motion.button>
          ))}
        </div>

        {/* Expanded solution */}
        <AnimatePresence initial={false}>
          {current && (
            <motion.div
              key={active}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="mt-6 grid gap-8 rounded-xl border border-[#DA291C]/30 bg-[#0F0F0F] p-8 md:grid-cols-2">
                {/* Left */}
                <div>
                  <span className="text-sm font-semibold text-[#DA291C]">The fix</span>
                  <h3 className="mt-3 font-display text-2xl font-bold tracking-[-0.02em] text-white">
                    {current.headline}
                  </h3>
                  <p className="mt-4 text-[#A0A0A0]">{current.body}</p>
                  <a
                    href="#seat"
                    className="mt-6 inline-block rounded-md bg-[#DA291C] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D]"
                  >
                    Fix This Now →
                  </a>
                </div>

                {/* Right */}
                <div>
                  <span className="text-sm font-semibold text-[#A0A0A0]">
                    What we deploy
                  </span>
                  <div className="mt-3 space-y-2">
                    {current.solutions.map((s) => (
                      <div
                        key={s}
                        className="flex items-center gap-3 rounded-lg border border-[#1A1A1A] bg-[#141414] p-3"
                      >
                        <span className="text-[#DA291C]">✦</span>
                        <span className="text-sm text-white">{s}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-lg border border-[#1A1A1A] bg-[#141414] p-4">
                    <div className="text-xs uppercase tracking-wider text-[#666]">
                      Recommended starting point
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[#DA291C]">
                      {current.chip}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
