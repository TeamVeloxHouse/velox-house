import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { inViewport, SIGNUP_URL } from "../../lib/utils";

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
    headline: "Your pipeline is empty because nothing is prospecting for you.",
    body: "Velox House discovers decision-makers that match your ideal client — by role, industry, size and location — and verifies their email. Add them to a campaign and personalised outreach goes out automatically.",
    solutions: ["Find Leads", "AI Messaging", "Sequences"],
    chip: "Starter — £29/mo",
  },
  {
    tile: "I spend hours writing cold emails that get ignored",
    headline: "Generic cold emails get deleted. Personalised ones get replies.",
    body: "The AI researches each prospect's business — their pain points and angles — then writes a personalised email, LinkedIn note or follow-up for you. You review and send. Reply rates run 3× higher than templated blasts.",
    solutions: ["AI Research", "AI Messaging", "Templates"],
    chip: "Starter — £29/mo",
  },
  {
    tile: "I forget to follow up and leads go cold",
    headline: "Most replies come from the follow-ups you never send.",
    body: "Build a multi-step sequence once and it runs from your own inbox on schedule — pausing instantly the moment someone replies. Sending is unlimited, so no lead ever slips through the cracks.",
    solutions: ["Sequences", "Inbox", "Unlimited sending"],
    chip: "Growth — £69/mo",
  },
  {
    tile: "I can't tell what's actually working",
    headline: "You're sending into the dark with no idea what converts.",
    body: "Live analytics show every open, reply, meeting and pound of pipeline. See your best-performing messages and campaigns, and double down on what books meetings.",
    solutions: ["Analytics", "Pipeline", "Engagement scoring"],
    chip: "Starter — £29/mo",
  },
  {
    tile: "My emails keep landing in spam",
    headline: "Your domain has a deliverability problem — and it's costing you replies.",
    body: "Velox House checks SPF, DKIM and DMARC, monitors your domain reputation and bounce rate, and includes a pre-send spam checker. Send from your own warmed mailbox so you land in the inbox.",
    solutions: ["Deliverability", "Domain health checks", "Own-mailbox sending"],
    chip: "Free — £0/mo",
  },
  {
    tile: "I don't know who I should even be targeting",
    headline: "The right list is half the battle — and most people guess.",
    body: "Search a real database of companies and people, filter to your exact ideal customer, and let scoring surface the prospects most likely to engage. No more buying stale, generic lists.",
    solutions: ["Find Leads", "AI Research", "Engagement scoring"],
    chip: "Starter — £29/mo",
  },
  {
    tile: "My team's outreach is disorganised and duplicated",
    headline: "Without one shared system, leads get dropped or double-contacted.",
    body: "One workspace for the whole team — shared contacts, pipeline and sequences, with seats for each member. Everyone sees who's been contacted and what stage every deal is at.",
    solutions: ["Workspace & seats", "Pipeline", "Shared sequences"],
    chip: "Growth — £69/mo",
  },
  {
    tile: "Outreach tools are too expensive to even try",
    headline: "You shouldn't have to pay to find out if it works.",
    body: "Start on the free forever plan — 50 contacts, 50 AI credits and unlimited sending, no card required. Upgrade only once it's booking you meetings. No contracts, cancel anytime.",
    solutions: ["Free forever plan", "Unlimited sending", "No credit card"],
    chip: "Free — £0/mo",
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
                    href={SIGNUP_URL}
                    className="mt-6 inline-block rounded-md bg-[#DA291C] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D]"
                  >
                    Fix This Free →
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
