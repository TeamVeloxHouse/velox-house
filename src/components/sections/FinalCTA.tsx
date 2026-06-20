import { useState } from "react";
import { motion } from "framer-motion";
import { inViewport } from "../../lib/utils";
import { submitLead } from "../../lib/supabase";

const CHIP_TIERS = ["White Chip", "Red Chip", "Blue Chip", "Black Chip"];

const REASSURANCE = [
  "No contract. Stop, pause, or scale anytime.",
  "Full stack live within 72 hours.",
  "First intel report within 48 hours.",
];

const inputClass =
  "w-full rounded-md border border-[#2A2A2A] bg-[#141414] px-4 py-3.5 text-sm text-white placeholder-[#666] transition-colors focus:border-[#DA291C] focus:outline-none";

export default function FinalCTA() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [chip, setChip] = useState(CHIP_TIERS[0]);
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
        chipTier: chip,
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
            Ready to build the system that grows your business?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-[#A0A0A0]">
            Book a 30-minute conversation. We'll show you exactly what your stack
            would look like, what it would cost, and what to expect in your first
            90 days.
          </p>

          {submitted ? (
            <div className="mx-auto mt-10 max-w-xl rounded-xl border border-[#DA291C]/30 bg-[#0A0A0A] p-8">
              <div className="text-3xl text-[#DA291C]">✦</div>
              <p className="mt-4 text-lg text-white">
                Seat reserved. We'll be in touch within 24 hours.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mx-auto mt-10 max-w-xl text-left"
            >
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
                value={chip}
                onChange={(e) => setChip(e.target.value)}
                className={`${inputClass} mt-4`}
              >
                {CHIP_TIERS.map((tier) => (
                  <option key={tier} value={tier} className="bg-[#141414]">
                    {tier}
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
                className="mt-4 w-full rounded-md bg-[#DA291C] py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D] disabled:opacity-60"
              >
                {submitting ? "Sending…" : "Get Started →"}
              </button>

              {error && (
                <p className="mt-3 text-center text-xs text-[#DA291C]">{error}</p>
              )}
            </form>
          )}

          {/* Reassurance */}
          <div className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs text-[#A0A0A0]">
            {REASSURANCE.map((r) => (
              <span key={r}>{r}</span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
