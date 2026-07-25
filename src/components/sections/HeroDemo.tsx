import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Play, RotateCcw, Sparkles } from "lucide-react";
import { SIGNUP_URL } from "../../lib/utils";
import { track } from "../../lib/track";
import {
  COUNTS,
  EMAIL_CAPTION,
  INDUSTRIES,
  LOCATIONS,
  ROLES,
  verifiedOf,
  type RoleId,
} from "../../lib/demoScript";

// "Try Velox AI" — a fully canned, front-end-only simulation of the real product
// flow (plan → discover → verify → draft). No API calls, no credits: every outcome
// comes from demoScript.ts based on the visitor's predetermined selections.

type Block =
  | { t: "user"; text: string }
  | { t: "ai"; text: string }
  | { t: "searches"; items: string[] }
  | { t: "discovery"; found: number }
  | { t: "companies"; items: { name: string; detail: string; fit: number }[] }
  | { t: "verify"; count: number; verified: number }
  | { t: "email"; subject: string; body: string }
  | { t: "done" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Counts 0 → target over ~1s. Timer-based (not rAF) so it always completes,
 *  even if the tab is backgrounded mid-animation. */
function CountUp({ target, suffix }: { target: number; suffix: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const iv = window.setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / 1000);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p >= 1) window.clearInterval(iv);
    }, 33);
    return () => window.clearInterval(iv);
  }, [target]);
  return (
    <span>
      {n.toLocaleString()}
      {suffix}
    </span>
  );
}

const aiBubble = "rounded-xl rounded-tl-sm border border-[#222] bg-[#141414] px-4 py-3 text-sm text-[#D5D5D5]";

export default function HeroDemo() {
  const [count, setCount] = useState<number>(50);
  const [role, setRole] = useState<RoleId>("directors");
  const [industryId, setIndustryId] = useState("gyms");
  const [loc, setLoc] = useState("Manchester");

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [typing, setTyping] = useState(false);
  const runId = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the newest message in view (inside the panel only).
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [blocks, typing]);

  useEffect(() => () => { runId.current++; }, []); // cancel timers on unmount

  const roleLabel = ROLES.find((r) => r.id === role)!.label;
  const industry = INDUSTRIES.find((i) => i.id === industryId)!;
  const prompt = `Find me ${count} ${roleLabel} at ${industry.label} in ${loc}`;

  async function run() {
    const id = ++runId.current;
    const alive = () => runId.current === id;
    const add = (b: Block) => alive() && setBlocks((prev) => [...prev, b]);
    const think = async (ms: number) => {
      setTyping(true);
      await sleep(ms);
      if (alive()) setTyping(false);
    };

    setBlocks([]);
    track("demo_started", { label: prompt });

    add({ t: "user", text: prompt });
    await think(900);
    if (!alive()) return;
    add({ t: "ai", text: "On it. Planning your campaign — I'll expand that into targeted searches so we build a whole market, not just page one:" });
    await sleep(700);
    if (!alive()) return;
    add({ t: "searches", items: industry.searches(loc) });
    await think(1400);
    if (!alive()) return;
    add({ t: "discovery", found: industry.found });
    await sleep(1700);
    if (!alive()) return;
    add({ t: "ai", text: `Fit-scored and ranked. Here are the strongest matches — I'd keep going until we have your ${count}:` });
    await sleep(500);
    if (!alive()) return;
    add({ t: "companies", items: industry.companies(loc) });
    await think(1300);
    if (!alive()) return;
    add({ t: "verify", count, verified: verifiedOf(count) });
    await sleep(1900);
    if (!alive()) return;
    add({ t: "ai", text: `Emails verified — you only ever pay for contacts that exist. I've researched each ${industry.short.replace(/s$/, "")} and drafted personalised messages. Here's one:` });
    await sleep(700);
    if (!alive()) return;
    add({ t: "email", ...industry.email(role, loc) });
    await think(1100);
    if (!alive()) return;
    add({ t: "done" });
    track("demo_completed", { label: prompt });
  }

  const select =
    "cursor-pointer appearance-none rounded-md border border-[#2A2A2A] bg-[#141414] px-2.5 py-1.5 text-sm font-medium text-white outline-none transition-colors hover:border-[#444] focus:border-[#DA291C]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.55 }}
      className="mt-16 w-full"
    >
      <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-[#1A1A1A] bg-[#0D0D0D] shadow-2xl">
        {/* Window chrome */}
        <div className="flex items-center justify-between border-b border-[#1A1A1A] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2A2A2A]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#2A2A2A]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#2A2A2A]" />
            </div>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
              <Sparkles size={14} className="text-[#FF5A3C]" /> Velox AI
            </span>
          </div>
          <span className="rounded-full border border-[#2A2A2A] px-2.5 py-1 text-[11px] text-[#888]">
            Interactive demo · example data
          </span>
        </div>

        {/* Prompt composer */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#1A1A1A] bg-[#101010] px-4 py-4 text-sm text-[#A0A0A0]">
          <span className="font-medium text-white">Find me</span>
          <select className={select} value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="How many leads">
            {COUNTS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select className={select} value={role} onChange={(e) => setRole(e.target.value as RoleId)} aria-label="Role">
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
          <span className="font-medium text-white">at</span>
          <select className={select} value={industryId} onChange={(e) => setIndustryId(e.target.value)} aria-label="Industry">
            {INDUSTRIES.map((i) => (
              <option key={i.id} value={i.id}>{i.label}</option>
            ))}
          </select>
          <span className="font-medium text-white">in</span>
          <select className={select} value={loc} onChange={(e) => setLoc(e.target.value)} aria-label="Location">
            {LOCATIONS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <button
            onClick={run}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-[#DA291C] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D]"
          >
            {blocks.length ? <RotateCcw size={14} /> : <Play size={14} />}
            {blocks.length ? "Run again" : "Run Velox AI"}
          </button>
        </div>

        {/* Conversation */}
        <div ref={scroller} className="max-h-[480px] space-y-4 overflow-y-auto px-4 py-5 md:px-6">
          {blocks.length === 0 && !typing && (
            <p className="py-6 text-center text-sm text-[#666]">
              Pick who you want to reach, hit <span className="text-[#A0A0A0]">Run Velox AI</span>, and watch how a campaign gets built from one prompt.
            </p>
          )}

          {blocks.map((b, i) => {
            if (b.t === "user")
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-[#DA291C] px-4 py-3 text-sm font-medium text-white">{b.text}</div>
                </div>
              );
            if (b.t === "ai")
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`max-w-[85%] ${aiBubble}`}>
                  {b.text}
                </motion.div>
              );
            if (b.t === "searches")
              return (
                <div key={i} className="flex max-w-[85%] flex-wrap gap-2 pl-1">
                  {b.items.map((s, j) => (
                    <motion.span
                      key={s}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: j * 0.18 }}
                      className="rounded-full border border-[#2A2A2A] bg-[#111] px-3 py-1 text-xs text-[#A0A0A0]"
                    >
                      {s}
                    </motion.span>
                  ))}
                </div>
              );
            if (b.t === "discovery")
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`max-w-[85%] ${aiBubble}`}>
                  <span className="text-white"><CountUp target={b.found} suffix="" /></span> matching companies discovered — fit-scoring every one against your ideal customer…
                </motion.div>
              );
            if (b.t === "companies")
              return (
                <div key={i} className="grid gap-2 sm:grid-cols-2">
                  {b.items.map((c, j) => (
                    <motion.div
                      key={c.name}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: j * 0.15 }}
                      className="rounded-lg border border-[#222] bg-[#111] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white">{c.name}</span>
                        <span className="shrink-0 rounded-full bg-[rgba(218,41,28,0.15)] px-2 py-0.5 text-[11px] font-semibold text-[#FF5A3C]">{c.fit}% fit</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[#888]">{c.detail}</p>
                    </motion.div>
                  ))}
                </div>
              );
            if (b.t === "verify")
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex max-w-[85%] items-center gap-2 ${aiBubble}`}>
                  <Check size={15} className="shrink-0 text-emerald-400" />
                  <span>
                    SMTP-verifying email addresses… <span className="text-white"><CountUp target={b.verified} suffix="" /></span>/{b.count} verified — the rest discarded before they cost you anything.
                  </span>
                </motion.div>
              );
            if (b.t === "email")
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[95%] md:max-w-[85%]">
                  <div className="overflow-hidden rounded-lg border border-[#2A2A2A] bg-[#0F0F0F]">
                    <div className="border-b border-[#222] px-4 py-2.5 text-sm">
                      <span className="text-[#777]">Subject: </span>
                      <span className="font-medium text-white">{b.subject}</span>
                    </div>
                    <pre className="whitespace-pre-wrap px-4 py-3 font-sans text-[13px] leading-relaxed text-[#C9C9C9]">{b.body}</pre>
                  </div>
                  <p className="mt-2 pl-1 text-[11px] leading-relaxed text-[#666]">{EMAIL_CAPTION}</p>
                </motion.div>
              );
            // done
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-[#2A2A2A] bg-gradient-to-br from-[#141414] to-[#191010] p-5">
                <p className="text-sm text-[#D5D5D5]">
                  <span className="font-semibold text-white">This is where the simulation ends — and the real thing takes over.</span>{" "}
                  In the app, you'd hit approve and Velox sends across email + LinkedIn every day from your own inbox, finding new {roleLabel} until your goal is hit.
                </p>
                <a
                  href={`${SIGNUP_URL}?utm_source=site&utm_medium=hero_demo`}
                  onClick={() => track("demo_cta_click", { label: prompt })}
                  className="mt-4 inline-block rounded-md bg-[#DA291C] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D]"
                >
                  Run it for real — 21-day free trial →
                </a>
              </motion.div>
            );
          })}

          {typing && (
            <div className={`inline-flex items-center gap-1.5 ${aiBubble}`}>
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#888]" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#888]" style={{ animationDelay: "0.15s" }} />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#888]" style={{ animationDelay: "0.3s" }} />
            </div>
          )}
        </div>
      </div>

      {/* Idle-state hint under the panel keeps honesty visible even before running */}
      <p className="mt-3 text-center text-xs text-[#666]">
        No sign-up needed to try it — this demo runs on example data, right here in your browser.
      </p>
    </motion.div>
  );
}
