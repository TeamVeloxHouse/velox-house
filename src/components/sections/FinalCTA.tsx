import { useState } from "react";
import { motion } from "framer-motion";
import { inViewport, SIGNUP_URL } from "../../lib/utils";
import { submitLead } from "../../lib/supabase";

const PLAN_OPTIONS = ["Not sure yet", "Free", "Starter", "Growth", "Scale", "Agency"];

const REASSURANCE = [
  "Free forever plan — no credit card.",
  "Unlimited email sending on every plan.",
  "Set up and sending in minutes.",
];

const inputClass =
  "w-full rounded-md border border-[#2A2A2A] bg-[#141414] px-4 py-3.5 text-sm text-white placeholder-[#666] transition-colors focus:border-[#DA291C] focus:outline-none";

export default function FinalCTA() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [plan, setPlan] = useState(PLAN_OPTIONS[0]);
  const [message, setMessage] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim()) {
      setError("Please enter your name and email.");
      return;
    }
    setSubmitting(true);
    try {
      await submitLead({
        name,
        email,
        businessName,
        chipTier: plan,
        message,
        source: "website_contact_form",
      });
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="seat" className="border-t border-[#1A1A1A] bg-[#0A0A0A] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={inViewport}
          className="rounded-2xl border border-[#1A1A1A] p-10 text-center md:p-20"
          style={{
            background:
              "radial-gradient(ellipse 80% 100% at 50% 0%, rgba(218,41,28,0.18), transparent 70%), #0F0F0F",
          }}
        >
          <h2 className="mx-auto max-w-3xl font-display text-4xl font-extrabold tracking-[-0.02em] text-white md:text-6xl">
            Start sending in the next five minutes.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-[#A0A0A0]">
            Create your free account and get lead discovery, AI research and
            messaging, and unlimited sending — no credit card, no contract. Upgrade
            only when it's booking you meetings.
          </p>

          {/* Primary self-serve CTA */}
          <div className="mt-10">
            <a
              href={SIGNUP_URL}
              className="inline-block rounded-md bg-[#DA291C] px-8 py-4 text-sm font-semibold text-white transition-colors hover:bg-[#FF3B2D]"
            >
              Start Free — No Card →
            </a>
          </div>

          {/* Reassurance */}
          <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs text-[#A0A0A0]">
            {REASSURANCE.map((r) => (
              <span key={r}>{r}</span>
            ))}
          </div>

          {/* Secondary — talk to us */}
          <div className="mx-auto mt-14 max-w-xl border-t border-[#1A1A1A] pt-10 text-left">
            <p className="text-center text-sm text-[#A0A0A0]">
              Prefer to talk first, or want a hand getting set up? Send us a message.
            </p>

            {submitted ? (
              <div className="mt-6 rounded-xl border border-[#DA291C]/30 bg-[#0A0A0A] p-8 text-center">
                <div className="text-3xl text-[#DA291C]">✦</div>
                <p className="mt-4 text-lg text-white">
                  Thanks — we'll be in touch within 24 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <input
                  type="text"
                  placeholder="Business name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className={`${inputClass} mt-4`}
                />

                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className={`${inputClass} mt-4`}
                >
                  {PLAN_OPTIONS.map((p) => (
                    <option key={p} value={p} className="bg-[#141414]">
                      {p === "Not sure yet" ? "Plan you're interested in" : p}
                    </option>
                  ))}
                </select>

                <textarea
                  placeholder="Tell us a little about your business"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={`${inputClass} mt-4 resize-none`}
                />

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-4 w-full rounded-md border border-[#2A2A2A] py-3.5 text-sm font-medium text-white transition-colors hover:border-[#444] disabled:opacity-60"
                >
                  {submitting ? "Sending…" : "Send Message"}
                </button>

                {error && (
                  <p className="mt-3 text-center text-xs text-[#DA291C]">{error}</p>
                )}
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
