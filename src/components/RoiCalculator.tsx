import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calculator, ArrowRight } from "lucide-react";
import { inViewport, SIGNUP_URL } from "../lib/utils";
import { submitLead } from "../lib/supabase";
import { track } from "../lib/track";
import { isEmail } from "../lib/deliverability";

/**
 * Free cold-email ROI calculator.
 *
 * Turns four inputs the visitor already knows (volume, reply rate, deal value,
 * close rate) into a pipeline forecast, then offers to email it over — which is
 * the capture. The plan it lands on is derived from the volume, so the forecast
 * doubles as a pricing recommendation.
 */

/* ---------------------------------------------------------------- model */

// Share of replies that are positive enough to become a conversation. Cold
// outreach benchmarks put this somewhere between a quarter and a third; we use
// the conservative end so the forecast under-promises.
const POSITIVE_REPLY_RATE = 0.3;
// Verified-before-import sending: a small slice still bounces or hard-fails.
const DELIVERY_RATE = 0.97;

const PLANS = [
  { max: 300, name: "Starter", price: 19.99 },
  { max: 1000, name: "Growth", price: 49.99 },
  { max: 1750, name: "Scale", price: 79.99 },
  { max: Infinity, name: "Agency", price: 179.99 },
];

function planFor(contacts: number) {
  return PLANS.find((p) => contacts <= p.max) ?? PLANS[PLANS.length - 1];
}

const gbp = (n: number) =>
  n.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  });

/* ---------------------------------------------------------------- UI bits */

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-sm text-[#A0A0A0]">{label}</label>
        <span className="font-display text-base font-bold text-white">
          {value.toLocaleString("en-GB")}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#222] accent-[#DA291C]"
      />
    </div>
  );
}

function Metric({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-[#0A0A0A] p-5">
      <div
        className={
          accent
            ? "gold-gradient-text font-display text-3xl font-extrabold md:text-4xl"
            : "font-display text-3xl font-bold text-white md:text-4xl"
        }
      >
        {value}
      </div>
      <div className="mt-1 text-sm text-[#A0A0A0]">{label}</div>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-[#2A2A2A] bg-[#141414] px-4 py-3.5 text-sm text-white placeholder-[#666] transition-colors focus:border-[#DA291C] focus:outline-none";

/* ---------------------------------------------------------------- section */

export default function RoiCalculator({
  variant = "page",
}: {
  variant?: "page" | "home";
}) {
  const isPage = variant === "page";

  const [contacts, setContacts] = useState(1000);
  const [replyRate, setReplyRate] = useState(5);
  const [dealValue, setDealValue] = useState(5000);
  const [closeRate, setCloseRate] = useState(20);

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const f = useMemo(() => {
    const delivered = contacts * DELIVERY_RATE;
    const replies = delivered * (replyRate / 100);
    const meetings = replies * POSITIVE_REPLY_RATE;
    const deals = meetings * (closeRate / 100);
    const revenue = deals * dealValue;
    const plan = planFor(contacts);
    return {
      replies,
      meetings,
      deals,
      revenue,
      plan,
      // Return per £1 of subscription. Deliberately compares new revenue to the
      // software cost only — it doesn't pretend to model your cost of sale.
      roi: plan.price > 0 ? revenue / plan.price : 0,
      annual: revenue * 12,
    };
  }, [contacts, replyRate, dealValue, closeRate]);

  const round = (n: number) => (n < 10 ? Math.round(n * 10) / 10 : Math.round(n));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmail(email)) {
      setError("Enter your work email so we can send the forecast.");
      return;
    }
    setError("");
    setSending(true);
    try {
      track("lead_capture", {
        label: "roi_calculator",
        props: { source: "roi_calculator", contacts, revenue: Math.round(f.revenue) },
      });
      await submitLead({
        name: "",
        email,
        businessName: email.split("@")[1] ?? "",
        chipTier: `${f.plan.name} · ${gbp(f.revenue)}/mo forecast`,
        message:
          `Used the free ROI calculator. Inputs: ${contacts} contacts/mo, ${replyRate}% reply rate, ` +
          `${gbp(dealValue)} average deal, ${closeRate}% close rate. Forecast: ${round(f.meetings)} meetings/mo, ` +
          `${round(f.deals)} deals/mo, ${gbp(f.revenue)} new revenue/mo (${gbp(f.annual)}/yr). ` +
          `Recommended plan: ${f.plan.name}.`,
        source: "roi_calculator",
      });
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      id="roi-calculator"
      data-vx-section="roi-calculator"
      className={
        isPage
          ? "border-b border-[#1A1A1A] bg-[#0A0A0A] pt-32 pb-24 md:pt-40 md:pb-32"
          : "border-t border-[#1A1A1A] bg-[#0A0A0A] py-24 md:py-32"
      }
    >
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          {...(isPage
            ? { animate: { opacity: 1, y: 0 } }
            : { whileInView: { opacity: 1, y: 0 }, viewport: inViewport })}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="text-sm font-semibold text-[#DA291C]">
            Free tool · No sign-up
          </span>
          {isPage ? (
            <h1 className="mt-4 font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.02em] text-white md:text-6xl">
              What is cold email actually worth to you?
            </h1>
          ) : (
            <h2 className="mt-4 font-display text-4xl font-bold tracking-[-0.02em] text-white md:text-5xl">
              What is cold email actually worth to you?
            </h2>
          )}
          <p className="mt-4 text-[#A0A0A0]">
            Move the sliders to your numbers and see the meetings, deals and
            pipeline a consistent outbound programme should produce each month.
          </p>
        </motion.div>

        <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-2xl border border-[#1A1A1A] bg-[#0F0F0F]">
          {/* Inputs */}
          <div className="border-b border-[#1A1A1A] p-8 md:p-10">
            <div className="mb-7 flex items-center gap-3">
              <Calculator size={20} className="text-[#DA291C]" />
              <div className="text-lg font-semibold text-white">Your numbers</div>
            </div>

            <div className="grid gap-7 sm:grid-cols-2">
              <Slider
                label="New contacts reached / month"
                value={contacts}
                min={100}
                max={4000}
                step={100}
                suffix=""
                onChange={setContacts}
              />
              <Slider
                label="Reply rate"
                value={replyRate}
                min={1}
                max={15}
                step={0.5}
                suffix="%"
                onChange={setReplyRate}
              />
              <Slider
                label="Close rate from meetings"
                value={closeRate}
                min={5}
                max={60}
                step={5}
                suffix="%"
                onChange={setCloseRate}
              />
              <div>
                <label
                  htmlFor="deal-value"
                  className="text-sm text-[#A0A0A0]"
                >
                  Average deal value
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[#666]">£</span>
                  <input
                    id="deal-value"
                    type="number"
                    min={0}
                    step={500}
                    value={dealValue}
                    onChange={(e) => setDealValue(Math.max(0, Number(e.target.value)))}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Output */}
          <div className="grid grid-cols-2 gap-px bg-[#1A1A1A] md:grid-cols-4">
            <Metric value={round(f.replies).toLocaleString("en-GB")} label="Replies / month" />
            <Metric value={round(f.meetings).toLocaleString("en-GB")} label="Conversations / month" />
            <Metric value={round(f.deals).toLocaleString("en-GB")} label="New deals / month" />
            <Metric value={gbp(f.revenue)} label="New revenue / month" accent />
          </div>

          <div className="p-8 md:p-10">
            <p className="text-sm text-[#A0A0A0]">
              That's{" "}
              <strong className="text-white">{gbp(f.annual)}</strong> of new
              business a year from{" "}
              <strong className="text-white">
                {f.plan.name} at £{f.plan.price}/month
              </strong>{" "}
              — about{" "}
              <strong className="text-white">
                {Math.round(f.roi).toLocaleString("en-GB")}×
              </strong>{" "}
              the cost of the software.
            </p>
            <p className="mt-3 text-xs text-[#666]">
              Estimates, not promises. We assume {Math.round(DELIVERY_RATE * 100)}%
              of verified contacts are delivered to and that{" "}
              {Math.round(POSITIVE_REPLY_RATE * 100)}% of replies are positive
              enough to become a conversation. Your mileage depends on your
              offer, list and timing.
            </p>

            {/* Capture */}
            {sent ? (
              <div className="mt-7 rounded-xl border border-[#DA291C]/30 bg-[#0A0A0A] p-6">
                <div className="text-2xl text-[#DA291C]">✦</div>
                <h3 className="mt-2 font-display text-xl font-bold text-white">
                  On its way.
                </h3>
                <p className="mt-2 text-sm text-[#A0A0A0]">
                  We've got your forecast — we'll send it over with the fastest
                  way to hit those numbers.
                </p>
                <a
                  href={SIGNUP_URL}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#DA291C] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D]"
                >
                  Start my 21-day free trial <ArrowRight size={15} />
                </a>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-7">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="email"
                    autoComplete="email"
                    aria-label="Your work email"
                    placeholder="you@yourbusiness.co.uk"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                  <button
                    type="submit"
                    disabled={sending}
                    className="shrink-0 rounded-md bg-[#DA291C] px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D] disabled:opacity-60"
                  >
                    {sending ? "Sending…" : "Email me this forecast"}
                  </button>
                </div>
                {error ? (
                  <p className="mt-3 text-xs text-[#DA291C]">{error}</p>
                ) : (
                  <p className="mt-3 text-xs text-[#666]">
                    We'll send the forecast and a short plan for hitting it. No
                    spam, unsubscribe anytime.
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
