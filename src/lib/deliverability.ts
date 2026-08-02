/**
 * Live domain-health checks for the free deliverability tool.
 *
 * Runs entirely in the browser against Google's DNS-over-HTTPS resolver (CORS
 * enabled), so there's no backend to keep alive and the report is instant. The
 * same logic is mirrored in vanilla JS inside scripts/build-blog.mjs for the
 * static blog pages — keep the scoring in the two in step.
 */

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

export function toDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .split("?")[0]
    .toLowerCase();
}

export function gradeFor(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

export const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

/** Free-mail domains — the check is meaningless for them, so we say so up front. */
const CONSUMER_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "hotmail.co.uk",
  "live.co.uk",
  "live.com",
  "yahoo.com",
  "yahoo.co.uk",
  "icloud.com",
  "me.com",
  "aol.com",
  "btinternet.com",
  "sky.com",
]);

export const isConsumerDomain = (domain: string) => CONSUMER_DOMAINS.has(domain);

const DKIM_SELECTORS = [
  "google",
  "selector1",
  "selector2",
  "k1",
  "default",
  "dkim",
  "mail",
];

export interface CheckRow {
  label: string;
  detail: string;
  pass: boolean;
}

export interface DeliverabilityResult {
  domain: string;
  score: number;
  grade: string;
  rows: CheckRow[];
}

/** Resolve MX/SPF/DMARC/DKIM for a domain and score it out of 100. */
export async function runDeliverabilityCheck(
  domain: string
): Promise<DeliverabilityResult> {
  const [mx, txt, dmarc] = await Promise.all([
    dnsQuery(domain, "MX"),
    dnsQuery(domain, "TXT"),
    dnsQuery(`_dmarc.${domain}`, "TXT"),
  ]);

  // A "null MX" (RFC 7505 — a single record whose target is ".") is a domain
  // declaring it accepts no mail at all, so it must not read as a pass.
  const mxHosts = mx
    .map((r) => r.split(" ").pop() ?? "")
    .filter((h) => h && h !== ".");
  const hasMx = mxHosts.length > 0;

  const hasSpf = txt.some((r) => r.toLowerCase().includes("v=spf1"));
  const dmarcRec = dmarc.find((r) => r.toLowerCase().includes("v=dmarc1"));
  const hasDmarc = Boolean(dmarcRec);
  const dmarcEnforced = hasDmarc && /p=(quarantine|reject)/i.test(dmarcRec ?? "");

  const dkimResults = await Promise.all(
    DKIM_SELECTORS.map((s) =>
      dnsQuery(`${s}._domainkey.${domain}`, "TXT").catch(() => [])
    )
  );
  // `p=` with nothing after it is a *revoked* key, so look for actual base64.
  const hasDkim = dkimResults.some((arr) =>
    arr.some((r) => /p=[A-Za-z0-9+/]{40,}/.test(r))
  );

  const rows: CheckRow[] = [
    {
      label: "Mail server configured (MX)",
      detail: hasMx
        ? `Receiving mail via ${mxHosts[0].replace(/\.$/, "")}`
        : mx.length > 0
          ? "Null MX — this domain explicitly accepts no email"
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
  const score = rows.reduce((sum, r, i) => sum + (r.pass ? weights[i] : 0), 0);

  return { domain, score, grade: gradeFor(score), rows };
}
