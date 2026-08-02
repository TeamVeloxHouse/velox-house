import { motion } from "framer-motion";
import { inViewport } from "../lib/utils";
import DeliverabilityWidget from "./DeliverabilityWidget";

/**
 * Section wrapper around the free deliverability checker.
 *
 * `variant="page"` is the /tools/email-deliverability-check hero (h1, top
 * padding for the fixed nav). `variant="home"` is the mid-homepage version
 * (h2, sits between other sections) — same widget, different framing.
 */
export default function DeliverabilityCheck({
  variant = "page",
}: {
  variant?: "page" | "home";
}) {
  const isPage = variant === "page";

  return (
    <section
      id="free-tools"
      data-vx-section="deliverability-tool"
      className={
        isPage
          ? "relative overflow-hidden border-b border-[#1A1A1A] bg-[#0A0A0A] pt-32 pb-24 md:pt-40 md:pb-32"
          : "relative overflow-hidden border-t border-[#1A1A1A] bg-[#0A0A0A] py-24 md:py-32"
      }
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
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          {...(isPage
            ? { animate: { opacity: 1, y: 0 } }
            : { whileInView: { opacity: 1, y: 0 }, viewport: inViewport })}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="flex items-center justify-center gap-4 text-xs font-semibold uppercase tracking-[0.25em] text-[#DA291C]">
            <span className="hidden h-px w-12 bg-[#DA291C]/40 sm:block" />
            Free tool · Instant report
            <span className="hidden h-px w-12 bg-[#DA291C]/40 sm:block" />
          </div>

          {isPage ? (
            <h1 className="mx-auto mt-6 font-display text-5xl font-extrabold leading-[0.98] tracking-[-0.02em] text-white md:text-7xl">
              Are your emails landing in the inbox?
            </h1>
          ) : (
            <h2 className="mx-auto mt-6 font-display text-4xl font-bold leading-[1.02] tracking-[-0.02em] text-white md:text-5xl">
              Before you send a single email — can your domain even reach the
              inbox?
            </h2>
          )}

          <p className="gold-gradient-text mt-5 font-display text-2xl font-bold italic md:text-3xl">
            Check your sender reputation in seconds.
          </p>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#A0A0A0] md:text-lg">
            {isPage
              ? "We check your domain's SPF, DKIM, DMARC and mail records live — the settings that decide whether your outreach reaches the inbox or the spam folder. Free and instant — just pop in your work email."
              : "Most cold outreach fails before anyone reads it. We check your domain's SPF, DKIM, DMARC and mail records live and score them out of 100 — free, instant, no sign-up."}
          </p>
        </motion.div>

        <div className="mx-auto mt-12 max-w-2xl">
          <DeliverabilityWidget
            source={isPage ? "deliverability_check" : "deliverability_check_home"}
          />
        </div>
      </div>
    </section>
  );
}
