import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn, inViewport, SIGNUP_URL } from "../../lib/utils";

interface Plan {
  name: string;
  price: string;
  period: string;
  perContact: string;
  blurb: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
  badge?: string;
}

const PLANS: Plan[] = [
  {
    name: "Starter",
    price: "£19.99",
    period: "/mo",
    perContact: "6.7p / contact",
    blurb: "For founders getting consistent outreach going.",
    features: [
      "300 contacts / month",
      "Email only — LinkedIn from Growth up",
      "300 AI credits / month",
      "Unlimited email sending",
      "2 mailboxes · sequences & analytics",
    ],
    cta: "Start with Starter",
  },
  {
    name: "Growth",
    price: "£49.99",
    period: "/mo",
    perContact: "5.0p / contact",
    blurb: "For founders scaling email + LinkedIn together.",
    features: [
      "1,000 contacts / month",
      "1 LinkedIn seat included free",
      "1,000 AI credits / month",
      "Unlimited email sending",
      "3 seats · 5 mailboxes",
    ],
    cta: "Start with Growth",
    badge: "Popular",
  },
  {
    name: "Scale",
    price: "£79.99",
    period: "/mo",
    perContact: "4.6p / contact",
    blurb: "The best value per contact — most teams land here.",
    features: [
      "1,750 contacts / month",
      "1 LinkedIn seat included free",
      "2,500 AI credits / month",
      "5 seats · 10 mailboxes",
      "Everything in Growth",
    ],
    cta: "Start with Scale",
    highlighted: true,
    badge: "Best value",
  },
  {
    name: "Agency",
    price: "£179.99",
    period: "/mo",
    perContact: "4.5p / contact",
    blurb: "For agencies and high-volume senders.",
    features: [
      "4,000 contacts / month",
      "1 LinkedIn seat included free",
      "5,000 AI credits / month",
      "10 seats · 25 mailboxes",
      "Priority support",
    ],
    cta: "Start with Agency",
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
            Email that lands.{" "}
            <span className="text-[#A0A0A0]">LinkedIn that replies.</span>
          </h2>
          <p className="mt-4 text-[#A0A0A0]">
            Every plan is a full email outreach engine — unlimited free sending, AI
            research and writing, and <span className="text-white">every contact SMTP-verified</span> so
            you don't burn your sender reputation on bounces. <span className="text-white">Growth,
            Scale and Agency each include one LinkedIn seat free</span> for a true multichannel touch —
            add more seats for £19.99/mo each. Every plan starts with a 21-day free trial —
            cancel anytime before it ends and you won't be charged.
          </p>
        </motion.div>

        {/* Free-trial callout */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={inViewport}
          className="mb-8 flex flex-col items-start justify-between gap-4 rounded-xl border border-[#1A1A1A] bg-[#0F0F0F] p-6 sm:flex-row sm:items-center"
        >
          <div>
            <h3 className="font-display text-xl font-bold text-white">
              Every plan starts free for 21 days
            </h3>
            <p className="mt-1 text-sm text-[#A0A0A0]">
              The full product · pick your plan up front · cancel anytime before day 21
              and you won&apos;t be charged.
            </p>
          </div>
          <a
            href={SIGNUP_URL}
            className="shrink-0 rounded-md border border-[#2A2A2A] px-5 py-3 text-sm font-medium text-white transition-colors hover:border-[#444]"
          >
            Start free trial
          </a>
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
              {plan.badge && (
                <span
                  className={cn(
                    "absolute -top-3 left-8 rounded-full px-3 py-1 text-xs font-semibold",
                    plan.highlighted
                      ? "bg-[#DA291C] text-white"
                      : "border border-[#2A2A2A] bg-[#0F0F0F] text-[#A0A0A0]"
                  )}
                >
                  {plan.badge}
                </span>
              )}

              <h3 className="font-display text-2xl font-bold text-white">
                {plan.name}
              </h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">{plan.price}</span>
                <span className="text-sm text-[#666]">{plan.period}</span>
              </div>
              <p className="mt-1 text-xs font-medium text-[#DA291C]">{plan.perContact}</p>
              <p className="mt-3 text-sm text-[#A0A0A0]">{plan.blurb}</p>

              <ul className="mb-8 mt-8 space-y-3">
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
              <p className="mt-3 text-center text-xs text-[#666]">
                21-day free trial, then {plan.price}
                {plan.period} · cancel anytime
              </p>
            </motion.div>
          ))}
        </div>

        {/* LinkedIn power-up callout */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={inViewport}
          className="mt-8 flex flex-col items-start justify-between gap-4 rounded-xl border border-[#1A1A1A] bg-[#0F0F0F] p-6 sm:flex-row sm:items-center"
        >
          <div>
            <h3 className="font-display text-xl font-bold text-white">
              LinkedIn included from <span className="text-[#0A66C2]">Growth</span> up
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-[#A0A0A0]">
              Email opens the door; LinkedIn gets the reply. Growth, Scale and Agency each
              include one LinkedIn seat free, so you can turn on connection requests and
              follow-up messages in the same sequences and inbox as your email — a true
              multichannel touch that consistently lifts reply rates, plus higher-volume
              role-based prospecting through LinkedIn search. Need more than one? Add extra
              seats for £19.99/mo each — cancel any time.
            </p>
          </div>
          <a
            href={SIGNUP_URL}
            className="shrink-0 rounded-md bg-[#0A66C2] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#0954a0]"
          >
            Get Growth
          </a>
        </motion.div>

        {/* Top-ups note */}
        <p className="mt-8 text-center text-sm text-[#666]">
          Need more reach? Add contacts any time — +500 for £25 or +2,000 for £80.
          Extra LinkedIn seats on Growth and up are £19.99/mo each.
        </p>
      </div>
    </section>
  );
}
