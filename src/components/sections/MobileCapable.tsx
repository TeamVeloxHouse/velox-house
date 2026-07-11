import { motion } from "framer-motion";
import { Smartphone, Download, Bell } from "lucide-react";
import { inViewport, SIGNUP_URL } from "../../lib/utils";

// A capability section — Velox House isn't "mobile-first", it's desktop AND mobile.
// The point is a shown differentiator: the whole platform works on a phone, where
// almost every competitor ships (at best) a read-only companion app.
const POINTS = [
  {
    icon: Smartphone,
    title: "The whole platform, not a companion",
    desc: "Find leads, research them, write and send, manage your pipeline and read replies — all from your phone. The same app, not a stripped-back viewer.",
  },
  {
    icon: Download,
    title: "Installs like a real app",
    desc: "Add it to your home screen and it opens full-screen, works offline, and feels native — no App Store required to get started.",
  },
  {
    icon: Bell,
    title: "Built for touch, screen by screen",
    desc: "Every list, button and flow is designed for a phone — not a desktop grid squeezed onto a small screen.",
  },
];

export default function MobileCapable() {
  return (
    <section className="surface-sunken relative overflow-hidden border-y border-[#161616] py-24 md:py-32">
      <div className="glow-top pointer-events-none absolute inset-0 opacity-70" />

      <div className="relative mx-auto max-w-7xl px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={inViewport}
          className="mb-16 max-w-3xl"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-[#DA291C]/40 bg-[#DA291C]/10 px-3 py-1.5 text-xs font-semibold text-[#FF6A4D]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#DA291C]" />
            Desktop + mobile
          </span>
          <h2 className="mt-5 font-display text-4xl font-bold tracking-[-0.02em] text-white md:text-5xl">
            Runs on your desk.{" "}
            <span className="text-gradient-red">Runs in your pocket.</span>
          </h2>
          <p className="mt-4 text-lg text-[#A8A8A8]">
            Most outreach tools are built for a desktop and — at best — bolt on a
            read-only mobile app for checking notifications. Velox House runs the
            whole thing on your phone: discover, write, send, follow up and close
            between meetings, on the train, anywhere. We looked — almost no one
            in outreach actually lets you do that.
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-3">
          {POINTS.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={inViewport}
                transition={{ delay: i * 0.06 }}
                className="card-depth rounded-xl p-5"
              >
                <div className="icon-chip mb-5 flex h-11 w-11 items-center justify-center rounded-xl text-[#FF6A4D]">
                  <Icon size={20} />
                </div>
                <h3 className="mb-2 font-display text-base font-semibold text-white">
                  {p.title}
                </h3>
                <p className="text-sm leading-relaxed text-[#9A9A9A]">{p.desc}</p>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={inViewport}
          className="mt-10"
        >
          <a
            href={SIGNUP_URL}
            className="inline-flex items-center rounded-md bg-[#DA291C] px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D]"
          >
            Try it on your phone — free for 21 days →
          </a>
        </motion.div>
      </div>
    </section>
  );
}
