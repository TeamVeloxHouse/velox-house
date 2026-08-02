/**
 * Lead submission helper. Posts to the Supabase edge function `inbound-lead`,
 * which every capture surface on the site funnels through.
 *
 * The function is deployed public (no JWT verification), so the project URL is
 * all we need — and it's hardcoded as a fallback for exactly the same reason
 * track.ts hardcodes it: a missing build-time env var used to make this throw
 * before it ever sent, silently dropping every lead the site captured. Override
 * with VITE_SUPABASE_URL (and optionally VITE_SUPABASE_ANON_KEY) in .env.
 */

const BASE_URL =
  ((import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ||
    "https://qmzfuadxcnweiwbrsutn.supabase.co");

export interface LeadPayload {
  name: string;
  email: string;
  businessName: string;
  chipTier: string;
  message: string;
  source: string;
}

export async function submitLead(payload: LeadPayload): Promise<void> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (anonKey) headers.Authorization = `Bearer ${anonKey}`;

  const res = await fetch(`${BASE_URL}/functions/v1/inbound-lead`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Lead submission failed with status ${res.status}`);
  }
}
