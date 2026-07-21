import { motion } from "framer-motion";
import { Check, Mail, Linkedin } from "lucide-react";
import { cn, inViewport } from "../../lib/utils";

/* Shared window chrome */
function Chrome({ label }: { label: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="flex gap-1.5">
        <span className="h-3 w-3 rounded-full bg-[#333]" />
        <span className="h-3 w-3 rounded-full bg-[#333]" />
        <span className="h-3 w-3 rounded-full bg-[#333]" />
      </div>
      <span className="text-xs text-[#666]">{label}</span>
    </div>
  );
}

/* 0 — Velox AI: one prompt builds the whole campaign */
function VeloxAiVisual() {
  const built = [
    { label: "Targeting", value: "Marketing leaders · UK SaaS · 11–50" },
    { label: "Leads found", value: "214 companies · emails verified" },
    { label: "Messages", value: "Email + LinkedIn, personalised" },
    { label: "Sequence", value: "4 steps · sending on autopilot" },
  ];
  return (
    <div className="card-depth rounded-xl p-6">
      <Chrome label="Velox AI" />
      <div className="mb-4 rounded-lg border border-[#DA291C]/30 bg-[#DA291C]/5 px-3 py-2.5 text-sm text-[#E4E4E4]">
        <span className="text-[#FF6A4D]">You ›</span> Find marketing managers at UK SaaS firms and start reaching out
      </div>
      <div className="mb-3 flex items-center gap-2 text-[10px] text-[#666]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#DA291C]" />
        Velox AI built your campaign
      </div>
      <div className="space-y-2">
        {built.map((b, i) => (
          <motion.div
            key={b.label}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={inViewport}
            transition={{ delay: i * 0.12 }}
            className="flex items-center gap-3 rounded-lg border border-[#191919] bg-[#101010] px-3 py-2.5"
          >
            <Check size={14} className="shrink-0 text-[#3fb950]" />
            <span className="text-xs text-[#888]">{b.label}</span>
            <span className="ml-auto text-right text-xs text-[#D8D8D8]">{b.value}</span>
          </motion.div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <span className="rounded-md bg-[#DA291C] px-3 py-1.5 text-xs font-medium text-white">Approve &amp; launch</span>
        <span className="rounded-md border border-[#222] px-3 py-1.5 text-xs text-[#888]">Review first</span>
      </div>
    </div>
  );
}

/* 1 — AI Discovery: ICP prompt + AI-scored, ranked results */
function FindLeadsVisual() {
  const rows = [
    { name: "Sarah Patel", role: "Marketing Director", company: "Northwind Ltd", fit: 96 },
    { name: "James Okafor", role: "Founder & CEO", company: "Helios Group", fit: 91 },
    { name: "Mira Chen", role: "Head of Ops", company: "Atlas Studio", fit: 84 },
  ];
  const fitColor = (f: number) => (f >= 90 ? "#3fb950" : f >= 80 ? "#FF6A4D" : "#888");
  return (
    <div className="card-depth rounded-xl p-6">
      <Chrome label="AI Discovery" />
      <div className="mb-4 rounded-lg border border-[#191919] bg-[#0E0E0E] px-3 py-2 text-xs text-[#9A9A9A]">
        <span className="text-[#FF6A4D]">ICP ›</span> Marketing leaders at UK SaaS, 11–50 staff
      </div>
      <div className="mb-3 flex items-center gap-2 text-[10px] text-[#666]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#DA291C]" />
        AI planned 18 searches · 214 companies · ranked by fit
      </div>
      <div>
        {rows.map((r, i) => (
          <motion.div
            key={r.name}
            initial={{ x: -16, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={inViewport}
            transition={{ delay: i * 0.1 }}
            className="flex items-center justify-between border-b border-[#161616] py-3 last:border-b-0"
          >
            <div>
              <div className="text-sm text-white">{r.name}</div>
              <div className="text-xs text-[#666]">{r.role} · {r.company}</div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="rounded px-2 py-0.5 text-[10px] font-medium"
                style={{ color: fitColor(r.fit), border: `1px solid ${fitColor(r.fit)}55` }}
              >
                {r.fit}% fit
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* 2 — AI Copilot: next-best-actions */
function CopilotVisual() {
  const actions = [
    { text: "12 hot leads opened twice — send them a nudge today", tag: "Do now" },
    { text: "“Q3 outbound” reply rate is 2× your others — clone its subject", tag: "Insight" },
    { text: "Northwind replied with a pricing objection — draft ready", tag: "Reply" },
  ];
  return (
    <div className="card-depth rounded-xl p-6">
      <Chrome label="AI Copilot · what to do next" />
      <div className="space-y-3">
        {actions.map((a, i) => (
          <motion.div
            key={a.text}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={inViewport}
            transition={{ delay: i * 0.12 }}
            className="flex items-start gap-3 rounded-lg border border-[#191919] bg-[#101010] p-3"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#DA291C]/15 text-xs text-[#FF6A4D]">
              ✳
            </span>
            <div className="flex-1">
              <div className="text-sm leading-snug text-[#E4E4E4]">{a.text}</div>
              <span className="mt-1.5 inline-block rounded-full border border-[#DA291C]/30 px-2 py-0.5 text-[10px] text-[#FF6A4D]">
                {a.tag}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* 2 — AI Research: research card */
function ResearchVisual() {
  const points = [
    "Scaling outbound but no dedicated SDR yet",
    "Recently hired 3 sales roles — growth mode",
    "Angle: help them hit pipeline targets faster",
  ];
  return (
    <div className="card-depth rounded-xl p-6">
      <Chrome label="AI Research · Helios Group" />
      <div className="space-y-3">
        {points.map((p, i) => (
          <motion.div
            key={p}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={inViewport}
            transition={{ delay: i * 0.12 }}
            className="flex items-start gap-3 rounded-lg border border-[#191919] bg-[#101010] p-3"
          >
            <span className="mt-0.5 text-[#DA291C]">✦</span>
            <span className="text-sm text-[#D8D8D8]">{p}</span>
          </motion.div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-[#666]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#DA291C]" />
        Researched automatically · feeding your draft
      </div>
    </div>
  );
}

/* 3 — AI Messaging: email composer */
function MessagingVisual() {
  return (
    <div className="card-depth rounded-xl p-6">
      <Chrome label="Compose · personalised draft" />
      <div className="rounded-lg border border-[#191919] bg-[#0E0E0E] p-4">
        <div className="border-b border-[#191919] pb-2 text-xs text-[#888]">
          To: <span className="text-white">sarah@northwind.co.uk</span>
        </div>
        <div className="border-b border-[#191919] py-2 text-sm text-white">
          Quick idea for Northwind's Q3 outbound
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={inViewport}
          transition={{ duration: 0.6 }}
          className="space-y-2 py-3 text-sm leading-relaxed text-[#C8C8C8]"
        >
          <p>Hi Sarah — saw Northwind's been scaling the sales team fast.</p>
          <p>Most teams that grow like that hit a pipeline gap before the new hires ramp…</p>
          <p className="text-[#666]">— sent from your own mailbox</p>
        </motion.div>
      </div>
      <div className="mt-3 flex gap-2">
        <span className="rounded-md bg-[#DA291C] px-3 py-1.5 text-xs font-medium text-white">Send</span>
        <span className="rounded-md border border-[#222] px-3 py-1.5 text-xs text-[#888]">Edit draft</span>
      </div>
    </div>
  );
}

/* 4 — Sequences: multi-channel steps */
function SequenceVisual() {
  const steps = [
    { day: "Day 1", label: "Intro email", icon: Mail, done: true },
    { day: "Day 2", label: "LinkedIn connect", icon: Linkedin, done: true },
    { day: "Day 4", label: "Follow-up if no reply", icon: Mail, done: true },
    { day: "Day 7", label: "Final nudge", icon: Mail, done: false },
  ];
  return (
    <div className="card-depth rounded-xl p-6">
      <Chrome label="Sequence · email + LinkedIn · running" />
      <div className="space-y-4">
        {steps.map((s, i) => (
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
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                s.done ? "bg-[#DA291C] text-white" : "bg-[#1A1A1A] text-[#666]"
              )}
            >
              <s.icon size={15} />
            </div>
            <div className="flex-1">
              <div className="text-xs text-[#666]">{s.day}</div>
              <div className={cn("text-sm", s.done ? "text-white" : "text-[#666]")}>{s.label}</div>
            </div>
            {s.done && <Check size={14} className="text-[#3fb950]" />}
          </motion.div>
        ))}
      </div>
      <div className="mt-4 rounded-md border border-[#191919] bg-[#101010] px-3 py-2 text-xs text-[#888]">
        Auto-stops the moment they reply.
      </div>
    </div>
  );
}

/* 5 — Pipeline: kanban */
function PipelineVisual() {
  const cols = [
    { title: "Contacted", people: ["Sarah P.", "Tom R."] },
    { title: "Replied", people: ["James O."] },
    { title: "Meeting", people: ["Mira C."] },
  ];
  return (
    <div className="card-depth rounded-xl p-6">
      <Chrome label="Pipeline" />
      <div className="grid grid-cols-3 gap-3">
        {cols.map((c, ci) => (
          <div key={c.title}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-[#A0A0A0]">{c.title}</span>
              <span className="text-[10px] text-[#555]">{c.people.length}</span>
            </div>
            <div className="space-y-2">
              {c.people.map((p, i) => (
                <motion.div
                  key={p}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={inViewport}
                  transition={{ delay: ci * 0.1 + i * 0.08 }}
                  className={cn(
                    "rounded-md border p-2.5 text-xs",
                    c.title === "Meeting"
                      ? "border-[#DA291C]/40 bg-[#DA291C]/10 text-white"
                      : "border-[#1A1A1A] bg-[#101010] text-[#C8C8C8]"
                  )}
                >
                  {p}
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 6 — Analytics: metrics + bars */
function AnalyticsVisual() {
  const metrics = [
    { label: "Sent", value: "1,284" },
    { label: "Replies", value: "312" },
    { label: "Meetings", value: "48" },
    { label: "Pipeline", value: "£284K" },
  ];
  const bars = [40, 65, 50, 80, 70, 95, 85, 100];
  return (
    <div className="card-depth rounded-xl p-6">
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border border-[#1A1A1A] bg-[#101010] p-4">
            <div className="text-xs text-[#A0A0A0]">{m.label}</div>
            <div className="mt-1 text-xl font-bold text-white">{m.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex h-28 items-end gap-2">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            whileInView={{ height: `${h}%` }}
            viewport={inViewport}
            transition={{ delay: i * 0.05, duration: 0.5, ease: "easeOut" }}
            className={cn("flex-1 rounded-t", i === bars.length - 1 ? "bg-[#DA291C]" : "bg-[#242424]")}
          />
        ))}
      </div>
    </div>
  );
}

/* 7 — Deliverability: checks + score */
function DeliverabilityVisual() {
  const checks = ["SPF record", "DKIM signing", "DMARC policy", "Spam-word scan"];
  return (
    <div className="card-depth rounded-xl p-6">
      <Chrome label="Deliverability · your-domain.co.uk" />
      <div className="mb-5 flex items-center gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={inViewport}
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#3fb950] text-lg font-bold text-[#3fb950] shadow-[0_0_24px_-6px_rgba(63,185,80,0.5)]"
        >
          94
        </motion.div>
        <div>
          <div className="text-sm font-medium text-white">Healthy — safe to send</div>
          <div className="text-xs text-[#666]">Recommended volume paced to your score</div>
        </div>
      </div>
      <div className="space-y-2">
        {checks.map((c, i) => (
          <motion.div
            key={c}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={inViewport}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-3 rounded-md border border-[#191919] bg-[#101010] px-3 py-2"
          >
            <Check size={14} className="text-[#3fb950]" />
            <span className="text-sm text-[#C8C8C8]">{c}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const VISUALS: Record<string, () => JSX.Element> = {
  "velox-ai": VeloxAiVisual,
  "find-leads": FindLeadsVisual,
  "ai-copilot": CopilotVisual,
  "ai-research": ResearchVisual,
  "ai-messaging": MessagingVisual,
  sequences: SequenceVisual,
  "pipeline-inbox": PipelineVisual,
  analytics: AnalyticsVisual,
  deliverability: DeliverabilityVisual,
};

export default function FeatureVisual({ slug }: { slug: string }) {
  const V = VISUALS[slug] ?? FindLeadsVisual;
  return <V />;
}
