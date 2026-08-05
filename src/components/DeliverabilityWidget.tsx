import { useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Info,
} from "lucide-react";
import { SIGNUP_URL } from "../lib/utils";
import { submitLead } from "../lib/supabase";
import { track } from "../lib/track";
import {
  isConsumerDomain,
  isEmail,
  runDeliverabilityCheck,
  toDomain,
  type DeliverabilityResult,
} from "../lib/deliverability";

/**
 * The free SPF/DKIM/DMARC checker card. Asks for a work email (so the free
 * report doubles as lead capture), runs the DNS checks in the browser and
 * shows a scored report with a route into the app.
 *
 * Rendered on the homepage, the tool page and inside the exit-intent modal —
 * `source` is what tells them apart in the CRM.
 */

function CheckRow({ label, detail, pass }: { label: string; detail: string; pass: boolean }) {
  return (
    <div className="flex items-start gap-3 border-b border-[#1A1A1A] py-3 last:border-b-0">
      {pass ? (
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#DA291C]" />
      ) : (
        <XCircle size={18} className="mt-0.5 shrink-0 text-[#555]" />
      )}
      <div>
        <div className="text-sm text-white">{label}</div>
        <div className="text-xs text-[#666]">{detail}</div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-[#2A2A2A] bg-[#141414] px-4 py-3.5 text-sm text-white placeholder-[#666] transition-colors focus:border-[#DA291C] focus:outline-none";

export default function DeliverabilityWidget({
  source = "deliverability_check",
  compact = false,
  showHeader = true,
}: {
  source?: string;
  /** Drops the card chrome — for use inside something that already has it. */
  compact?: boolean;
  /** Hide the built-in title when the surrounding page supplies its own. */
  showHeader?: boolean;
}) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DeliverabilityResult | null>(null);
  const [consumer, setConsumer] = useState(false);

  const run = async () => {
    const email = value.trim().toLowerCase();
    // Require a real email so the check doubles as lead capture.
    if (!isEmail(email)) {
      setError("Enter your work email, e.g. you@yourbusiness.co.uk");
      return;
    }
    const d = toDomain(email.split("@")[1]);
    if (!d || !d.includes(".")) {
      setError("That doesn't look like a valid email domain.");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    setConsumer(isConsumerDomain(d));

    try {
      const report = await runDeliverabilityCheck(d);
      setResult(report);

      // Capture the enquiry into the CRM (owner workspace) — fire-and-forget so a
      // capture hiccup never breaks the free tool. Domain + score + per-check
      // results go in the note so the lead lands pre-qualified.
      track("lead_capture", { label: source, props: { source, score: report.score } });
      submitLead({
        name: "",
        email,
        businessName: d,
        chipTier: `Deliverability ${report.grade} (${report.score}/100)`,
        message:
          `Ran the free deliverability check for ${d} — scored ${report.score}/100 (grade ${report.grade}). ` +
          report.rows.map((r) => `${r.label}: ${r.pass ? "pass" : "fail"}`).join("; "),
        source,
      }).catch(() => {
        /* non-blocking: the report still shows even if capture fails */
      });
    } catch {
      setError("Couldn't run the check — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={
        compact
          ? "rounded-2xl"
          : "card-glass rounded-2xl border border-[#1A1A1A] p-6 md:p-8"
      }
    >
      {!compact && showHeader && (
        <div className="mb-6 flex items-center gap-3">
          <ShieldCheck size={20} className="text-[#DA291C]" />
          <div>
            <div className="text-lg font-semibold text-white">
              Email Deliverability Check
            </div>
            <div className="text-xs text-[#666]">SPF · DKIM · DMARC · MX</div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className={inputClass}
          type="email"
          autoComplete="email"
          aria-label="Your work email"
          placeholder="you@yourbusiness.co.uk"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
        />
        <button
          onClick={run}
          disabled={loading}
          className="flex shrink-0 items-center justify-center gap-2 rounded-md bg-[#DA291C] px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D] disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? "Checking…" : "Check my email"}
        </button>
      </div>
      {error && <p className="mt-3 text-xs text-[#DA291C]">{error}</p>}
      {!error && (
        <p className="mt-3 text-xs text-[#666]">
          We'll run your report instantly. We may follow up with tips to fix any
          issues — no spam, unsubscribe anytime.
        </p>
      )}

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          {/* Score */}
          <div className="flex flex-wrap items-end gap-3">
            <span className="gold-gradient-text font-display text-6xl font-extrabold leading-none">
              {result.score}
            </span>
            <span className="mb-1 text-sm text-[#666]">deliverability</span>
            <span className="mb-1 ml-2 rounded-md border border-[#DA291C]/40 px-2 py-0.5 text-sm font-semibold text-[#DA291C]">
              Grade {result.grade}
            </span>
          </div>

          {consumer && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#2A2A2A] bg-[#141414] p-3 text-xs text-[#A0A0A0]">
              <Info size={14} className="mt-0.5 shrink-0 text-[#DA291C]" />
              <span>
                <strong className="text-white">{result.domain}</strong> is a free
                mailbox provider, so you're seeing their records, not yours. Cold
                outreach should always go from your own business domain — run the
                check again with your work address for a real score.
              </span>
            </div>
          )}

          {/* Rows */}
          <div className="mt-5">
            {result.rows.map((r) => (
              <CheckRow key={r.label} {...r} />
            ))}
          </div>

          {/* CTA into the software */}
          <div className="mt-6 rounded-xl border border-[#DA291C]/30 bg-[#0A0A0A] p-6">
            <h3 className="font-display text-lg font-bold text-white">
              Fix it — and keep it fixed — inside Velox House.
            </h3>
            <p className="mt-2 text-sm text-[#A0A0A0]">
              Every issue above is costing you replies. Velox House sets up and
              manages your sender reputation for you: guided SPF, DKIM and DMARC,
              domain warming, a safe sending schedule, bounce monitoring and a
              pre-send spam checker — so you land in the inbox, every time.
            </p>
            {/* No onClick — engagement.ts records cta_click for every app link,
                tagged with the enclosing data-vx-section. */}
            <a
              href={SIGNUP_URL}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#DA291C] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D]"
            >
              Protect my sender reputation <ArrowRight size={15} />
            </a>
            <p className="mt-3 text-xs text-[#666]">
              Plans from £19.99/mo · Cancel anytime
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
