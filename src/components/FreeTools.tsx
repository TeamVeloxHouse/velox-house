import { useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SIGNUP_URL } from "../lib/utils";
import {
  Monitor,
  Mail,
  Calculator,
  Linkedin,
  Timer,
  Telescope,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

/* ================================================================== */
/* Shared helpers                                                      */
/* ================================================================== */

const inputClass =
  "w-full rounded-md border border-[#2A2A2A] bg-[#141414] px-4 py-3.5 text-sm text-white placeholder-[#666] transition-colors focus:border-[#DA291C] focus:outline-none";

/** Abort signal that fires after `ms` — safer than AbortSignal.timeout across TS libs. */
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

/** Query Google's DNS-over-HTTPS JSON API. CORS-enabled, returns record strings. */
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

/** Strip protocol/path down to a bare domain. */
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

/* A single pass/fail result row. */
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
    <div className="flex items-start justify-between gap-4 border-b border-[#1A1A1A] py-3 last:border-b-0">
      <div className="flex items-start gap-3">
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
    </div>
  );
}

/* Big score readout shared by every tool. */
function ScoreBadge({ score, suffix = "/100" }: { score: number; suffix?: string }) {
  return (
    <div className="flex items-end gap-3">
      <span className="gold-gradient-text font-display text-6xl font-extrabold leading-none">
        {score}
      </span>
      <span className="mb-1 text-sm text-[#666]">{suffix}</span>
      <span className="mb-1 ml-2 rounded-md border border-[#DA291C]/40 px-2 py-0.5 text-sm font-semibold text-[#DA291C]">
        Grade {gradeFor(score)}
      </span>
    </div>
  );
}

/* Closing CTA shared by every tool result. */
function ResultCTA({ line }: { line: string }) {
  return (
    <div className="mt-6 rounded-lg border border-[#DA291C]/30 bg-[#0A0A0A] p-5">
      <p className="text-sm text-[#A0A0A0]">{line}</p>
      <a
        href={SIGNUP_URL}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[#DA291C] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D]"
      >
        Start free <ArrowRight size={15} />
      </a>
    </div>
  );
}

/* ================================================================== */
/* Tool 1 — Website Health (live checks)                               */
/* ================================================================== */

interface WebsiteResult {
  score: number;
  rows: { label: string; detail: string; pass: boolean }[];
}

function WebsiteHealth() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<WebsiteResult | null>(null);

  const run = async () => {
    const domain = toDomain(url);
    if (!domain || !domain.includes(".")) {
      setError("Enter a valid website, e.g. yourbusiness.co.uk");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);

    try {
      // Real check 1 — does the domain resolve (A record)?
      const aRecords = await dnsQuery(domain, "A");
      const resolves = aRecords.length > 0;

      // Real check 2 — IPv6 (AAAA)?
      const aaaa = await dnsQuery(domain, "AAAA");
      const hasIpv6 = aaaa.length > 0;

      // Real check 3 — reachable over HTTPS + response time.
      let reachable = false;
      let ms = 0;
      try {
        const start = performance.now();
        await fetch(`https://${domain}`, {
          mode: "no-cors",
          signal: timeoutSignal(6000),
        });
        ms = Math.round(performance.now() - start);
        reachable = true;
      } catch {
        reachable = false;
      }
      const fast = reachable && ms < 1500;

      const rows = [
        {
          label: "Domain resolves",
          detail: resolves
            ? `Live A record found (${aRecords[0]})`
            : "No DNS A record — the domain isn't pointing anywhere",
          pass: resolves,
        },
        {
          label: "Secure (HTTPS) & reachable",
          detail: reachable
            ? "Responds over a secure HTTPS connection"
            : "Could not reach the site over HTTPS",
          pass: reachable,
        },
        {
          label: "Loads quickly",
          detail: reachable
            ? `First response in ~${ms}ms ${fast ? "(good)" : "(slow — aim for <1.5s)"}`
            : "Couldn't measure — site unreachable",
          pass: fast,
        },
        {
          label: "Modern infrastructure (IPv6)",
          detail: hasIpv6
            ? "IPv6 (AAAA) record present"
            : "No IPv6 — fine, but modern hosts usually have it",
          pass: hasIpv6,
        },
      ];

      const weights = [30, 35, 20, 15];
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
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className={inputClass}
          placeholder="yourbusiness.co.uk"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
        />
        <button
          onClick={run}
          disabled={loading}
          className="flex shrink-0 items-center justify-center gap-2 rounded-md bg-[#DA291C] px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D] disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? "Scanning…" : "Check my site"}
        </button>
      </div>
      {error && <p className="mt-3 text-xs text-[#DA291C]">{error}</p>}

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <ScoreBadge score={result.score} />
          <div className="mt-5">
            {result.rows.map((r) => (
              <CheckRow key={r.label} {...r} />
            ))}
          </div>
          <ResultCTA line="Your website is your hardest-working salesperson. We rebuild and deploy conversion-focused sites in 72 hours — want yours audited live on a call?" />
        </motion.div>
      )}
    </div>
  );
}

/* ================================================================== */
/* Tool 2 — Email Check (live deliverability)                          */
/* ================================================================== */

const DKIM_SELECTORS = ["google", "selector1", "selector2", "k1", "default", "dkim", "mail"];

function EmailCheck() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<WebsiteResult | null>(null);

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
      const spf = txt.find((r) => r.toLowerCase().includes("v=spf1"));
      const hasSpf = Boolean(spf);
      const dmarcRec = dmarc.find((r) => r.toLowerCase().includes("v=dmarc1"));
      const hasDmarc = Boolean(dmarcRec);
      const dmarcEnforced =
        hasDmarc && /p=(quarantine|reject)/i.test(dmarcRec ?? "");

      // DKIM — probe common selectors in parallel.
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
    <div>
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
          {loading ? "Checking…" : "Grade my email"}
        </button>
      </div>
      {error && <p className="mt-3 text-xs text-[#DA291C]">{error}</p>}

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <ScoreBadge score={result.score} suffix="deliverability" />
          <div className="mt-5">
            {result.rows.map((r) => (
              <CheckRow key={r.label} {...r} />
            ))}
          </div>
          <ResultCTA line="Every email in the spam folder is a lead you paid for and never saw. We configure SPF, DKIM, DMARC and warming so you land in the inbox. Want us to fix it?" />
        </motion.div>
      )}
    </div>
  );
}

/* ================================================================== */
/* Tool 3 — Spend Audit (calculator)                                   */
/* ================================================================== */

function SpendAudit() {
  const [monthly, setMonthly] = useState("");
  const [retainer, setRetainer] = useState("");
  const [tools, setTools] = useState("");
  const [toolCost, setToolCost] = useState("");
  const [leads, setLeads] = useState("");
  const [show, setShow] = useState(false);

  const n = (v: string) => Math.max(0, Number(v) || 0);

  const calc = useMemo(() => {
    const m = n(monthly);
    const r = n(retainer);
    const t = n(tools);
    const tc = n(toolCost);
    const l = n(leads);

    const cpl = l > 0 ? m / l : 0;
    const benchmarkCpl = 50;
    const cplWaste = cpl > benchmarkCpl && l > 0 ? (cpl - benchmarkCpl) * l : 0;

    // Overlapping tools: most SMEs only need ~3 core tools.
    const overlapWaste = t > 3 ? (t - 3) * tc : 0;

    // Typical agency markup on delivery.
    const agencyWaste = r * 0.35;

    const monthlyWaste = Math.round(cplWaste + overlapWaste + agencyWaste);
    const annualWaste = monthlyWaste * 12;

    return {
      m,
      cpl: Math.round(cpl),
      benchmarkCpl,
      cplWaste: Math.round(cplWaste),
      overlapWaste: Math.round(overlapWaste),
      agencyWaste: Math.round(agencyWaste),
      monthlyWaste,
      annualWaste,
    };
  }, [monthly, retainer, tools, toolCost, leads]);

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Monthly marketing spend (£)">
          <input className={inputClass} type="number" min="0" placeholder="2000" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
        </Field>
        <Field label="Agency / freelancer retainer (£/mo)">
          <input className={inputClass} type="number" min="0" placeholder="1500" value={retainer} onChange={(e) => setRetainer(e.target.value)} />
        </Field>
        <Field label="Number of marketing tools you pay for">
          <input className={inputClass} type="number" min="0" placeholder="6" value={tools} onChange={(e) => setTools(e.target.value)} />
        </Field>
        <Field label="Average cost per tool (£/mo)">
          <input className={inputClass} type="number" min="0" placeholder="40" value={toolCost} onChange={(e) => setToolCost(e.target.value)} />
        </Field>
        <Field label="New leads per month">
          <input className={inputClass} type="number" min="0" placeholder="20" value={leads} onChange={(e) => setLeads(e.target.value)} />
        </Field>
      </div>

      <button
        onClick={() => setShow(true)}
        className="mt-5 w-full rounded-md bg-[#DA291C] py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D] sm:w-auto sm:px-8"
      >
        Find my wasted spend →
      </button>

      {show && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <div className="text-xs uppercase tracking-wider text-[#666]">
            Estimated wasted spend
          </div>
          <div className="mt-1 flex items-end gap-3">
            <span className="gold-gradient-text font-display text-5xl font-extrabold leading-none">
              £{calc.annualWaste.toLocaleString()}
            </span>
            <span className="mb-1 text-sm text-[#666]">/ year</span>
          </div>

          <div className="mt-5 space-y-2">
            <Breakdown label="Cost-per-lead above benchmark" value={calc.cplWaste} note={`You: £${calc.cpl}/lead vs £${calc.benchmarkCpl} target`} />
            <Breakdown label="Overlapping / surplus tools" value={calc.overlapWaste} note="Most SMEs need ~3 core tools" />
            <Breakdown label="Typical agency delivery markup" value={calc.agencyWaste} note="~35% of retainer" />
          </div>

          <ResultCTA line={`That's roughly £${calc.monthlyWaste.toLocaleString()}/month leaking out. One unified system replaces the stack and the markup — want us to map your exact savings?`} />
        </motion.div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-[#A0A0A0]">{label}</span>
      {children}
    </label>
  );
}

function Breakdown({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[#1A1A1A] bg-[#141414] p-3">
      <div>
        <div className="text-sm text-white">{label}</div>
        <div className="text-xs text-[#666]">{note}</div>
      </div>
      <div className="text-sm font-semibold text-[#DA291C]">
        £{value.toLocaleString()}/mo
      </div>
    </div>
  );
}

/* ================================================================== */
/* Quiz engine (LinkedIn, Response Speed, Competitor)                  */
/* ================================================================== */

interface QuizOption {
  label: string;
  points: number;
}
interface QuizQuestion {
  q: string;
  options: QuizOption[];
}

function Quiz({
  questions,
  ctaLine,
  scoreSuffix = "/100",
}: {
  questions: QuizQuestion[];
  ctaLine: string;
  scoreSuffix?: string;
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(
    Array(questions.length).fill(null)
  );
  const [show, setShow] = useState(false);

  const maxPoints = useMemo(
    () =>
      questions.reduce(
        (sum, q) => sum + Math.max(...q.options.map((o) => o.points)),
        0
      ),
    [questions]
  );

  const raw = answers.reduce<number>(
    (sum, a, i) => (a === null ? sum : sum + questions[i].options[a].points),
    0
  );
  const score = Math.round((raw / maxPoints) * 100);
  const allAnswered = answers.every((a) => a !== null);

  const pick = (qi: number, oi: number) => {
    const next = [...answers];
    next[qi] = oi;
    setAnswers(next);
  };

  return (
    <div>
      <div className="space-y-6">
        {questions.map((q, qi) => (
          <div key={qi}>
            <div className="text-sm font-medium text-white">{q.q}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {q.options.map((o, oi) => (
                <button
                  key={oi}
                  onClick={() => pick(qi, oi)}
                  className={`rounded-lg border px-3.5 py-2 text-sm transition-all ${
                    answers[qi] === oi
                      ? "border-[#DA291C] bg-[#DA291C]/10 text-white"
                      : "border-[#1A1A1A] text-[#A0A0A0] hover:border-[#DA291C]/50 hover:bg-[#141414]"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setShow(true)}
        disabled={!allAnswered}
        className="mt-6 w-full rounded-md bg-[#DA291C] py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#FF3B2D] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:px-8"
      >
        {allAnswered ? "Get my score →" : "Answer all to see your score"}
      </button>

      {show && allAnswered && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <ScoreBadge score={score} suffix={scoreSuffix} />
          <ResultCTA line={ctaLine} />
        </motion.div>
      )}
    </div>
  );
}

const YN = (pts: number): QuizOption[] => [
  { label: "Yes", points: pts },
  { label: "No", points: 0 },
];

function LinkedInScore() {
  return (
    <Quiz
      scoreSuffix="profile strength"
      ctaLine="Your LinkedIn is a 24/7 shopfront for high-value clients. We optimise profiles and run LinkedIn Signal outreach that books meetings. Want a teardown on a call?"
      questions={[
        { q: "Do you have a professional, high-quality headshot?", options: YN(15) },
        {
          q: "Does your headline say what you do for clients (not just your job title)?",
          options: YN(20),
        },
        {
          q: "How often do you post?",
          options: [
            { label: "Weekly+", points: 20 },
            { label: "Monthly", points: 10 },
            { label: "Rarely / never", points: 0 },
          ],
        },
        {
          q: "How many relevant connections do you have?",
          options: [
            { label: "1,000+", points: 15 },
            { label: "500–999", points: 10 },
            { label: "Under 500", points: 3 },
          ],
        },
        { q: "Is there a clear way for a prospect to contact you?", options: YN(15) },
        { q: "Do you proactively reach out to ideal prospects?", options: YN(15) },
      ]}
    />
  );
}

function ResponseSpeed() {
  return (
    <Quiz
      scoreSuffix="lead response"
      ctaLine="Leads contacted within 5 minutes are up to 21× more likely to convert. Our CRM + automation respond instantly, every time. Want to see it in action?"
      questions={[
        {
          q: "How fast do you typically respond to a new enquiry?",
          options: [
            { label: "Under 5 min", points: 40 },
            { label: "Within an hour", points: 30 },
            { label: "Same day", points: 18 },
            { label: "Next day", points: 8 },
            { label: "Longer / inconsistent", points: 0 },
          ],
        },
        {
          q: "How many times do you follow up with a lead?",
          options: [
            { label: "5+", points: 30 },
            { label: "3–4", points: 22 },
            { label: "1–2", points: 12 },
            { label: "0", points: 0 },
          ],
        },
        { q: "Does a lead get an instant automated acknowledgement?", options: YN(15) },
        { q: "Do you track and review your response times?", options: YN(15) },
      ]}
    />
  );
}

function CompetitorCheck() {
  return (
    <Quiz
      scoreSuffix="visibility"
      ctaLine="Every gap below is a place a competitor is being found and you aren't. We close all of them with one deployed system. Want your visibility mapped against rivals?"
      questions={[
        { q: "Claimed & optimised Google Business Profile?", options: YN(13) },
        { q: "Rank on page 1 of Google for a key service term?", options: YN(13) },
        { q: "Running Google or Meta ads?", options: YN(12) },
        { q: "Active, posting LinkedIn presence?", options: YN(13) },
        { q: "Active Instagram / TikTok presence?", options: YN(12) },
        { q: "20+ recent online reviews?", options: YN(13) },
        { q: "Growing email list you market to?", options: YN(12) },
        { q: "Publishing content / blog regularly?", options: YN(12) },
      ]}
    />
  );
}

/* ================================================================== */
/* Tool registry + section shell                                       */
/* ================================================================== */

interface Tool {
  id: string;
  name: string;
  sub: string;
  badge: string;
  icon: LucideIcon;
  render: () => ReactNode;
}

const TOOLS: Tool[] = [
  { id: "website", name: "Website Health", sub: "Instant score", badge: "Free · Instant", icon: Monitor, render: () => <WebsiteHealth /> },
  { id: "email", name: "Email Check", sub: "Deliverability grade", badge: "Free · 30s", icon: Mail, render: () => <EmailCheck /> },
  { id: "spend", name: "Spend Audit", sub: "Find waste", badge: "Free · 2 min", icon: Calculator, render: () => <SpendAudit /> },
  { id: "linkedin", name: "LinkedIn Score", sub: "Profile strength", badge: "Free · Instant", icon: Linkedin, render: () => <LinkedInScore /> },
  { id: "response", name: "Response Speed", sub: "Lead test", badge: "Free · Quiz", icon: Timer, render: () => <ResponseSpeed /> },
  { id: "competitor", name: "Competitor Check", sub: "Visibility gap", badge: "Free · 60s", icon: Telescope, render: () => <CompetitorCheck /> },
];

export default function FreeTools() {
  const [active, setActive] = useState(TOOLS[0].id);
  const current = TOOLS.find((t) => t.id === active)!;

  return (
    <section id="free-tools" className="relative overflow-hidden bg-[#0A0A0A] pt-32 md:pt-40">
      {/* subtle red radial */}
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
          className="text-center"
        >
          <div className="flex items-center justify-center gap-4 text-xs font-semibold uppercase tracking-[0.25em] text-[#DA291C]">
            <span className="hidden h-px w-12 bg-[#DA291C]/40 sm:block" />
            Free tools · No strings attached
            <span className="hidden h-px w-12 bg-[#DA291C]/40 sm:block" />
          </div>

          <h1 className="mx-auto mt-6 max-w-4xl font-display text-5xl font-extrabold leading-[0.98] tracking-[-0.02em] text-white md:text-7xl">
            See exactly where your business stands.
          </h1>

          <p className="gold-gradient-text mt-5 font-display text-2xl font-bold italic md:text-3xl">
            Pick a tool. Get your answer. On us.
          </p>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#A0A0A0] md:text-lg">
            Our technology analyses your business in seconds and gives you an
            honest, detailed picture of what's working and what isn't. No sales
            pitch. Just the truth — and what to do about it.
          </p>
        </motion.div>

        {/* Tool tabs */}
        <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const isActive = t.id === active;
            return (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`card-glass relative flex flex-col items-center rounded-xl border p-5 text-center transition-all ${
                  isActive
                    ? "border-[#DA291C] shadow-[0_0_30px_-8px_rgba(218,41,28,0.5)]"
                    : "border-[#1A1A1A] hover:border-[#2A2A2A]"
                }`}
              >
                <span
                  className={`absolute right-2 top-2 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                    isActive ? "text-[#DA291C]" : "text-[#555]"
                  }`}
                >
                  {t.badge}
                </span>
                <Icon
                  size={22}
                  className={`mt-3 ${isActive ? "text-[#DA291C]" : "text-[#A0A0A0]"}`}
                />
                <div className="mt-3 text-sm font-semibold text-white">{t.name}</div>
                <div className="text-xs text-[#666]">{t.sub}</div>
                {isActive && (
                  <motion.span
                    layoutId="tool-underline"
                    className="absolute -bottom-px left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-[#DA291C]"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Active tool panel */}
        <div className="mt-8 pb-24 md:pb-32">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="card-glass mx-auto max-w-2xl rounded-2xl border border-[#1A1A1A] p-6 md:p-8"
            >
              <div className="mb-6 flex items-center gap-3">
                <current.icon size={20} className="text-[#DA291C]" />
                <div>
                  <div className="text-lg font-semibold text-white">{current.name}</div>
                  <div className="text-xs text-[#666]">{current.sub}</div>
                </div>
              </div>
              {current.render()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
