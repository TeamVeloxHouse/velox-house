import { motion } from "framer-motion";
import { inViewport } from "../../lib/utils";

const QUOTES = [
  {
    quote:
      "We replaced four tools and an agency retainer with Velox. Pipeline doubled in 60 days and I can finally see what's working.",
    name: "Sarah Patel",
    role: "Founder, Northwind Ltd",
  },
  {
    quote:
      "Live in 72 hours sounded like marketing. It wasn't. Site, CRM and outreach were all running by the end of week one.",
    name: "James Okafor",
    role: "Director, Helios Group",
  },
  {
    quote:
      "No contract was the unlock. We started small, scaled when it worked, and now they run our entire growth operation.",
    name: "Mira Chen",
    role: "CEO, Atlas Studio",
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="bg-[#0A0A0A] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={inViewport}
          className="mb-16 max-w-3xl"
        >
          <span className="text-sm font-semibold text-[#DA291C]">Customers</span>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.02em] text-white md:text-5xl">
            What founders say{" "}
            <span className="text-[#A0A0A0]">after switching to Velox.</span>
          </h2>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {QUOTES.map((q, i) => (
            <motion.figure
              key={q.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inViewport}
              transition={{ delay: i * 0.1 }}
              className="rounded-xl border border-[#1A1A1A] bg-[#141414] p-8"
            >
              <blockquote className="text-base leading-relaxed text-white">
                “{q.quote}”
              </blockquote>
              <figcaption className="mt-6 border-t border-[#1A1A1A] pt-6">
                <div className="text-sm font-semibold text-white">{q.name}</div>
                <div className="text-xs text-[#A0A0A0]">{q.role}</div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
