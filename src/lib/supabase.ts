/**
 * Lead submission helper. Posts to the Supabase edge function
 * `inbound-lead`. Both the contact form and the stack builder use this.
 *
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.
 */

export interface LeadPayload {
  name: string;
  email: string;
  businessName: string;
  chipTier: string;
  message: string;
  source: string;
}

export async function submitLead(payload: LeadPayload): Promise<void> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!url || !anonKey) {
    // Surface a clear error in development if env vars are missing.
    throw new Error(
      "Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file."
    );
  }

  const res = await fetch(`${url}/functions/v1/inbound-lead`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Lead submission failed with status ${res.status}`);
  }
}
