import { useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { SIGNUP_URL } from "../lib/utils";

/* ------------------------------------------------------------------ */
/* DNS helpers (live checks via Google DNS-over-HTTPS, CORS-enabled)   */
/* ------------------------------------------------------------------ */

function timeoutSignal(ms: number): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

interface DnsAnswer {
  data: string;
}
interface DnsResponse {
  Answer?: DnsAnswer[];
}

async function dnsQuery(name: string, type: string): Promise<string[]> {
  const res = await fetch(
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
    { signal: timeoutSignal(6000) }
  );
  const data: DnsResponse = await res.json();
  return (data.Answer ?? []).map((a) =>
    a.data.replace(/^"|"$/g, "").replace(/" "/g, "")
  );
}

function toDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .split("?")[0]
    .toLowerCase();
}

function gradeFor(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

const DKIM_SELECTORS = [
  "google",
  "selector1",
  "selector2",
  "k1",
  "default",
  "dkim",
  "mail",
];

interface Result {
  score: number;
  rows: { label: string; detail: string; pass: boolean }[];
}

/* ------------------------------------------------------------------ */
/* Small UI pieces                                                     */
/* ------------------------------------------------------------------ */

function CheckRow({
  label,
  detail,
  pass,
}: {
  label: string;
  detail: string;
  pass: boolean;
}) {
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

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export default function DeliverabilityCheck() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const run = async () => {
    const d = toDomain(domain.includes("@") ? domain.split("@")[1] : domain);
    if (!d || !d.includes(".")) {
      setError("Enter your email domain, e.g. yourbusiness.co.uk");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);

    try {
      const [mx, txt, dmarc] = await Promise.all([
        dnsQuery(d, "MX"),
        dnsQuery(d, "TXT"),
        dnsQuery(`_dmarc.${d}`, "TXT"),
      ]);

      const hasMx = mx.length > 0;
      const hasSpf = txt.some((r) => r.toLowerCase().includes("v=spf1"));
      const dmarcRec = dmarc.find((r) => r.toLowerCase().includes("v=dmarc1"));
      const hasDmarc = Boolean(dmarcRec);
      const dmarcEnforced =
        hasDmarc && /p=(quarantine|reject)/i.test(dmarcRec ?? "");

      const dkimResults = await Promise.all(
        DKIM_SELECTORS.map((s) =>
          dnsQuery(`${s}._domainkey.${d}`, "TXT").catch(() => [])
        )
      );
      const hasDkim = dkimResults.some((arr) =>
        arr.some((r) => /v=dkim1|p=/i.test(r))
      );

      const rows = [
        {
          label: "Mail server configured (MX)",
          detail: hasMx
            ? `Receiving mail via ${mx[0].split(" ").pop()}`
            : "No MX record — this domain can't receive email",
          pass: hasMx,
        },
        {
          label: "SPF record",
          detail: hasSpf
            ? "SPF found — authorises who can send as you"
            : "Missing SPF — a top cause of spam-foldering",
          pass: hasSpf,
        },
        {
          label: "DMARC policy",
          detail: hasDmarc
            ? dmarcEnforced
              ? "DMARC enforced (quarantine/reject) — strong"
              : "DMARC present but set to p=none (monitoring only)"
            : "No DMARC — leaves your domain open to spoofing",
          pass: dmarcEnforced,
        },
        {
          label: "DKIM signing",
          detail: hasDkim
            ? "DKIM key detected on a common selector"
            : "No DKIM found on common selectors — emails may look unsigned",
          pass: hasDkim,
        },
      ];

      const weights = [25, 30, 25, 20];
      const score = rows.reduce(
        (sum, r, i) => sum + (r.pass ? weights[i] : 0),
        0
      );
      setResult({ score, rows });
    } catch {
      setError("Couldn't run the check — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="free-tools"
      className="relative overflow-hidden border-b border-[#1A1A1A] bg-[#0A0A0A] pt-32 pb-24 md:pt-40 md:pb-32"
    >
      {/* subtle red radial + dot grid */}
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-50" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(218,41,28,0.10), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 md:px-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="flex items-center justify-center gap-4 text-xs font-semibold uppercase tracking-[0.25em] text-[#DA291C]">
            <span className="hidden h-px w-12 bg-[#DA291C]/40 sm:block" />
            Free tool · No sign-up
            <span className="hidden h-px w-12 bg-[#DA291C]/40 sm:block" />
          </div>

          <h1 className="mx-auto mt-6 font-display text-5xl font-extrabold leading-[0.98] tracking-[-0.02em] text-white md:text-7xl">
            Are your emails landing in the inbox?
          </h1>

          <p className="gold-gradient-text mt-5 font-display text-2xl font-bold italic md:text-3xl">
            Check your sender reputation in seconds.
          </p>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#A0A0A0] md:text-lg">
            We check your domain's SPF, DKIM, DMARC and mail records live — the
            settings that decide whether your outreach reaches the inbox or the
            spam folder. Free, instant, no sign-up.
          </p>
        </motion.div>

        {/* Checker card */}
        <div className="card-glass mx-auto mt-12 max-w-2xl rounded-2xl border border-[#1A1A1A] p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <ShieldCheck size={20} className="text-[#DA291C]" />
            <div>
              <div className="text-lg font-semibold text-white">
                Email Deliverability Check
              </div>
              <div className="text-xs text-[#666]">SPF · DKIM · DMARC · MX</div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              className={inputClass}
              placeholder="you@yourbusiness.co.uk"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
            />
            <button
              onClick={run}
              disabled={loading}
              className="flex shrink-0 items-center justify-center gap-2 rounded-md bg-[#DA291C] px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D] disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? "Checking…" : "Check my domain"}
            </button>
          </div>
          {error && <p className="mt-3 text-xs text-[#DA291C]">{error}</p>}

          {result && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6"
            >
              {/* Score */}
              <div className="flex items-end gap-3">
                <span className="gold-gradient-text font-display text-6xl font-extrabold leading-none">
                  {result.score}
                </span>
                <span className="mb-1 text-sm text-[#666]">deliverability</span>
                <span className="mb-1 ml-2 rounded-md border border-[#DA291C]/40 px-2 py-0.5 text-sm font-semibold text-[#DA291C]">
                  Grade {gradeFor(result.score)}
                </span>
              </div>

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
                <a
                  href={SIGNUP_URL}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#DA291C] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D]"
                >
                  Protect my sender reputation — free <ArrowRight size={15} />
                </a>
                <p className="mt-3 text-xs text-[#666]">
                  Free forever plan · No credit card required
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
