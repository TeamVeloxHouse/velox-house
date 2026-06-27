import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn, inViewport, SIGNUP_URL } from "../../lib/utils";

interface Plan {
  name: string;
  price: string;
  period: string;
  blurb: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Free",
    price: "£0",
    period: "forever",
    blurb: "Everything you need to start sending today.",
    features: [
      "50 contacts / month",
      "50 AI credits / month",
      "Unlimited email sending",
      "1 seat · 1 mailbox",
      "AI research & messaging",
    ],
    cta: "Start free",
  },
  {
    name: "Starter",
    price: "£29",
    period: "/mo",
    blurb: "For founders getting consistent outreach going.",
    features: [
      "300 contacts / month",
      "500 AI credits / month",
      "Unlimited email sending",
      "1 seat · 3 mailboxes",
      "Sequences & analytics",
    ],
    cta: "Start with Starter",
  },
  {
    name: "Growth",
    price: "£69",
    period: "/mo",
    blurb: "For teams scaling outbound together.",
    features: [
      "800 contacts / month",
      "2,000 AI credits / month",
      "Unlimited email sending",
      "3 seats · 10 mailboxes",
      "Everything in Starter",
    ],
    cta: "Start with Growth",
    highlighted: true,
  },
  {
    name: "Pro",
    price: "£149",
    period: "/mo",
    blurb: "For agencies and high-volume senders.",
    features: [
      "2,000 contacts / month",
      "4,000 AI credits / month",
      "Unlimited email sending",
      "5 seats · 25 mailboxes",
      "Priority support",
    ],
    cta: "Start with Pro",
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
            Start free.{" "}
            <span className="text-[#A0A0A0]">Upgrade when you're winning.</span>
          </h2>
          <p className="mt-4 text-[#A0A0A0]">
            Sending is unlimited and free on every plan — you only pay for more
            contacts and AI credits as you scale. No credit card to start, cancel
            anytime.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inViewport}
              transition={{ delay: i * 0.08 }}
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
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">{plan.price}</span>
                <span className="text-sm text-[#666]">{plan.period}</span>
              </div>
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
                href={SIGNUP_URL}
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

        {/* Top-ups note */}
        <p className="mt-8 text-center text-sm text-[#666]">
          Need more reach? Add contacts any time — +500 for £20 or +2,000 for £60.
        </p>
      </div>
    </section>
  );
}
