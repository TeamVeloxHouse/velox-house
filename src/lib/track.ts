// First-party analytics for the marketing site. Posts anonymous events to the Velox
// app's public `track` edge function (cross-origin, CORS-open). Fire-and-forget,
// keepalive so a CTA click still records even as the page navigates to the app.

const TRACK_URL =
  ((import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ||
    "https://qmzfuadxcnweiwbrsutn.supabase.co") + "/functions/v1/track";

function sessionId(): string {
  try {
    let id = localStorage.getItem("vx_sid");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("vx_sid", id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export function track(
  event: string,
  opts: { path?: string; label?: string; props?: Record<string, unknown> } = {}
) {
  try {
    const body = JSON.stringify({
      source: "marketing",
      event,
      path: opts.path ?? (typeof location !== "undefined" ? location.pathname + location.hash : undefined),
      label: opts.label,
      sessionId: sessionId(),
      props: opts.props,
    });
    fetch(TRACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* telemetry must never break the site */
  }
}

export function trackPageView(path?: string) {
  track("page_view", { path });
}
