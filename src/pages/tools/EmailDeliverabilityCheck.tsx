import DeliverabilityCheck from "../../components/DeliverabilityCheck";

/**
 * Dedicated page for the deliverability checker — the tool itself plus the
 * explainer that earns the URL its own search intent ("check SPF DKIM DMARC").
 */

const RECORDS = [
  {
    name: "SPF",
    what: "A DNS record listing which servers are allowed to send email as your domain.",
    why: "Without it, receiving servers can't tell your outreach apart from someone spoofing you — so it lands in spam or gets rejected outright.",
  },
  {
    name: "DKIM",
    what: "A cryptographic signature added to every message you send, verified against a public key in your DNS.",
    why: "It proves the email really came from you and wasn't altered in transit. Unsigned mail is treated with suspicion by Google and Microsoft.",
  },
  {
    name: "DMARC",
    what: "A policy telling receivers what to do when SPF or DKIM fails — none (monitor), quarantine, or reject.",
    why: "Google and Microsoft now require it for anyone sending in volume. A policy of p=none is a start, but only quarantine or reject actually protects your domain.",
  },
  {
    name: "MX",
    what: "The records that say where your inbound mail should be delivered.",
    why: "No MX means the domain can't receive replies — which makes any outreach from it pointless, and looks like a throwaway domain to filters.",
  },
];

const READS = [
  {
    href: "/blog/cold-email-deliverability-guide/",
    title: "The cold email deliverability guide",
    blurb: "SPF, DKIM, DMARC, warm-up and volume — the whole picture, in order.",
  },
  {
    href: "/blog/cold-email-sending-limits-google-vs-microsoft/",
    title: "Sending limits: Google vs Microsoft",
    blurb: "What each provider actually allows before it throttles you.",
  },
  {
    href: "/blog/does-email-warmup-still-work/",
    title: "Does email warm-up still work?",
    blurb: "What the warm-up tools do, what they don't, and what to do instead.",
  },
];

export default function EmailDeliverabilityCheck() {
  return (
    <>
      <DeliverabilityCheck variant="page" />

      {/* Explainer */}
      <section
        data-vx-section="deliverability-explainer"
        className="border-b border-[#1A1A1A] bg-[#0A0A0A] py-20 md:py-28"
      >
        <div className="mx-auto max-w-3xl px-6 md:px-12">
          <h2 className="font-display text-3xl font-bold tracking-[-0.02em] text-white md:text-4xl">
            What we check, and why it decides where you land
          </h2>
          <p className="mt-4 text-[#A0A0A0]">
            Four DNS records do most of the work of getting a cold email into an
            inbox. Get them wrong and it doesn't matter how good the message is —
            nobody sees it.
          </p>

          <div className="mt-10 space-y-4">
            {RECORDS.map((r) => (
              <div
                key={r.name}
                className="rounded-xl border border-[#1A1A1A] bg-[#0F0F0F] p-6"
              >
                <h3 className="font-display text-lg font-bold text-white">
                  {r.name}
                </h3>
                <p className="mt-2 text-sm text-[#C9C9C9]">{r.what}</p>
                <p className="mt-2 text-sm text-[#A0A0A0]">{r.why}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-16 font-display text-2xl font-bold tracking-[-0.02em] text-white">
            Keep reading
          </h2>
          <div className="mt-5 space-y-3">
            {READS.map((r) => (
              <a
                key={r.href}
                href={r.href}
                className="block rounded-xl border border-[#1A1A1A] bg-[#0F0F0F] p-5 transition-colors hover:border-[#3A3A3A]"
              >
                <div className="text-sm font-semibold text-white">{r.title}</div>
                <div className="mt-1 text-sm text-[#999]">{r.blurb}</div>
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
