import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { inViewport } from "../../lib/utils";

/**
 * Counts up from 0 to `target` once the element scrolls into view.
 * `suffix` is appended (e.g. "x", "min").
 */
function CountUp({
  target,
  suffix = "",
  duration = 1400,
}: {
  target: number;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, target, duration]);

  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  );
}

const STATS = [
  {
    node: "Unlimited",
    label: "Email sending on every plan — straight from your own inbox.",
  },
  {
    node: <CountUp target={5} suffix="min" />,
    label: "From sign-up to your first researched, ready-to-send campaign.",
  },
  {
    node: <CountUp target={3} suffix="x" />,
    label: "Higher reply rates with AI-personalised messaging vs. generic cold email.",
  },
];

export default function StatsBar() {
  return (
    <section className="border-y border-[#1A1A1A] bg-[#0A0A0A] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <div className="grid gap-12 md:grid-cols-3">
          {STATS.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inViewport}
              transition={{ delay: i * 0.1 }}
            >
              <div className="font-display text-5xl font-extrabold tracking-[-0.03em] text-[#DA291C] md:text-7xl">
                {stat.node}
              </div>
              <p className="mt-4 max-w-xs text-base text-[#A0A0A0]">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
