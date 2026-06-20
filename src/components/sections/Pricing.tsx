import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn, inViewport } from "../../lib/utils";

interface Plan {
  name: string;
  price: string;
  blurb: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Starter",
    price: "£1,800/mo",
    blurb: "For founder-led teams getting their first system in place.",
    features: [
      "Custom website",
      "CRM & pipeline",
      "Lead capture & nurture",
      "Monthly review",
      "72-hour deployment",
    ],
    cta: "Start with Starter",
  },
  {
    name: "Growth",
    price: "£3,200/mo",
    blurb: "For businesses ready to scale outbound and content together.",
    features: [
      "Everything in Starter",
      "AI outreach engine",
      "Content engine",
      "Weekly intel reports",
      "Priority support",
    ],
    cta: "Start with Growth",
    highlighted: true,
  },
  {
    name: "Scale",
    price: "£5,400/mo",
    blurb: "For ambitious operators running multi-channel acquisition.",
    features: [
      "Everything in Growth",
      "Dedicated strategist",
      "Custom integrations",
      "Multi-brand support",
      "Quarterly planning",
    ],
    cta: "Start with Scale",
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="border-t border-[#1A1A1A] bg-[#0A0A0A] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={inViewport}
          className="mb-16 max-w-3xl"
        >
          <span className="text-sm font-semibold text-[#DA291C]">Pricing</span>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.02em] text-white md:text-5xl">
            Simple pricing.{" "}
            <span className="text-[#A0A0A0]">No contract. Cancel anytime.</span>
          </h2>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inViewport}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "relative flex flex-col rounded-xl bg-[#0F0F0F] p-8",
                plan.highlighted
                  ? "border border-[#DA291C]"
                  : "border border-[#1A1A1A]"
              )}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-8 rounded-full bg-[#DA291C] px-3 py-1 text-xs font-semibold text-white">
                  Most popular
                </span>
              )}

              <h3 className="font-display text-2xl font-bold text-white">
                {plan.name}
              </h3>
              <div className="mt-2 text-3xl font-bold text-white">{plan.price}</div>
              <p className="mt-3 text-sm text-[#A0A0A0]">{plan.blurb}</p>

              <ul className="mt-8 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Check size={16} className="mt-0.5 shrink-0 text-[#DA291C]" />
                    <span className="text-sm text-white">{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href="#seat"
                className={cn(
                  "mt-auto block rounded-md px-5 py-3 text-center text-sm font-medium transition-colors",
                  plan.highlighted
                    ? "bg-[#DA291C] text-white hover:bg-[#FF3B2D]"
                    : "border border-[#2A2A2A] text-white hover:border-[#444]"
                )}
              >
                {plan.cta}
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
