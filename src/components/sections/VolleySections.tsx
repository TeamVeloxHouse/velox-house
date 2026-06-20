import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn, inViewport } from "../../lib/utils";

/* ------------------------------------------------------------------ */
/* Visual 1 — Outreach Engine                                          */
/* ------------------------------------------------------------------ */

const PROSPECTS = [
  { name: "Sarah Patel", company: "Northwind Ltd", status: "Replied", color: "#DA291C" },
  { name: "James Okafor", company: "Helios Group", status: "Opened", color: "#888" },
  { name: "Mira Chen", company: "Atlas Studio", status: "Booked", color: "#DA291C" },
  { name: "Tom Reeves", company: "Vertex Co", status: "Sent", color: "#555" },
];

function OutreachVisual() {
  return (
    <div className="rounded-xl border border-[#222] bg-[#0F0F0F] p-6">
      {/* Window header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#333]" />
          <span className="h-3 w-3 rounded-full bg-[#333]" />
          <span className="h-3 w-3 rounded-full bg-[#333]" />
        </div>
        <span className="text-xs text-[#666]">Outreach Engine</span>
      </div>

      {/* Rows */}
      <div>
        {PROSPECTS.map((p, i) => (
          <motion.div
            key={p.name}
            initial={{ x: -20, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={inViewport}
            transition={{ delay: i * 0.1 }}
            className="flex items-center justify-between border-b border-[#1A1A1A] py-4 last:border-b-0"
          >
            <div>
              <div className="text-sm text-white">{p.name}</div>
              <div className="text-xs text-[#666]">{p.company}</div>
            </div>
            <span
              className="rounded border px-2 py-1 text-xs"
              style={{ color: p.color, borderColor: p.color + "55" }}
            >
              {p.status}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Visual 2 — Dashboard                                                */
/* ------------------------------------------------------------------ */

const METRICS = [
  { label: "Leads", value: "1,284" },
  { label: "Replies", value: "312" },
  { label: "Booked", value: "48" },
  { label: "Pipeline", value: "£284K" },
];

const BAR_HEIGHTS = [40, 65, 50, 80, 70, 95, 85, 100];

function DashboardVisual() {
  return (
    <div className="rounded-xl border border-[#222] bg-[#0F0F0F] p-6">
      {/* Metric grid */}
      <div className="grid grid-cols-2 gap-3">
        {METRICS.map((m) => (
          <div
            key={m.label}
            className="rounded-lg border border-[#1A1A1A] bg-[#141414] p-4"
          >
            <div className="text-xs text-[#A0A0A0]">{m.label}</div>
            <div className="mt-1 text-xl font-bold text-white">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="mt-6 flex h-32 items-end gap-2">
        {BAR_HEIGHTS.map((h, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            whileInView={{ height: `${h}%` }}
            viewport={inViewport}
            transition={{ delay: i * 0.05, duration: 0.5, ease: "easeOut" }}
            className={cn(
              "flex-1 rounded-t",
              i === BAR_HEIGHTS.length - 1 ? "bg-[#DA291C]" : "bg-[#2A2A2A]"
            )}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Visual 3 — Deployment timeline                                      */
/* ------------------------------------------------------------------ */

const STEPS = [
  { day: "Day 1", label: "Brand & website built", done: true },
  { day: "Day 2", label: "CRM & data imported", done: true },
  { day: "Day 3", label: "Outreach engine live", done: true },
  { day: "Day 4+", label: "Results in your inbox", done: false },
];

function TimelineVisual() {
  return (
    <div className="rounded-xl border border-[#222] bg-[#0F0F0F] p-6">
      <div className="space-y-5">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.day}
            initial={{ x: -10, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={inViewport}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-4"
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm",
                s.done ? "bg-[#DA291C] text-white" : "bg-[#1A1A1A] text-[#666]"
              )}
            >
              {s.done ? <Check size={16} /> : <span className="h-2 w-2 rounded-full bg-[#666]" />}
            </div>
            <div>
              <div className="text-xs text-[#666]">{s.day}</div>
              <div
                className={cn(
                  "text-sm",
                  s.done ? "text-white" : "text-[#666]"
                )}
              >
                {s.label}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Volley layout                                                       */
/* ------------------------------------------------------------------ */

interface Volley {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  visual: ReactNode;
  reverse?: boolean;
}

const VOLLEYS: Volley[] = [
  {
    eyebrow: "AI Outreach",
    title: "Build your pipeline on autopilot.",
    body: "Personalised email and LinkedIn sequences run every day in the background — sourcing prospects, opening conversations, and booking meetings while you focus on closing.",
    cta: "Learn more",
    visual: <OutreachVisual />,
  },
  {
    eyebrow: "War Room Dashboard",
    title: "See everything. Control everything.",
    body: "Live visibility into every lead, every reply, every booking and every pound of pipeline. No more PDF reports. No more 'trust us, it's working.' Just the numbers, in real time.",
    cta: "Learn more",
    visual: <DashboardVisual />,
    reverse: true,
  },
  {
    eyebrow: "72-Hour Deployment",
    title: "Live in 72 hours. No contract.",
    body: "Most agencies take three months to set up. We're live in three days. Start Monday, stop whenever. Scale when it's working. You're always in control.",
    cta: "Learn more",
    visual: <TimelineVisual />,
  },
];

function VolleyRow({ volley }: { volley: Volley }) {
  const copy = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={inViewport}
      className={volley.reverse ? "md:order-2" : ""}
    >
      <span className="text-sm font-semibold text-[#DA291C]">{volley.eyebrow}</span>
      <h3 className="mt-3 font-display text-3xl font-bold tracking-[-0.02em] text-white md:text-4xl">
        {volley.title}
      </h3>
      <p className="mt-5 text-base leading-relaxed text-[#A0A0A0]">{volley.body}</p>
      <a
        href="#how"
        className="mt-6 inline-block text-sm font-medium text-[#DA291C] transition-colors hover:text-[#FF3B2D]"
      >
        {volley.cta} →
      </a>
    </motion.div>
  );

  const visual = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={inViewport}
      transition={{ delay: 0.1 }}
      className={volley.reverse ? "md:order-1" : ""}
    >
      {volley.visual}
    </motion.div>
  );

  return (
    <div className="grid items-center gap-12 md:grid-cols-2 lg:gap-20">
      {copy}
      {visual}
    </div>
  );
}

export default function VolleySections() {
  return (
    <section id="how" className="bg-[#0A0A0A] py-24 md:py-32">
      <div className="mx-auto max-w-7xl space-y-32 px-6 md:px-12">
        {VOLLEYS.map((v) => (
          <VolleyRow key={v.eyebrow} volley={v} />
        ))}
      </div>
    </section>
  );
}
