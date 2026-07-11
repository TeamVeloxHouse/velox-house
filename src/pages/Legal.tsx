import { useParams, Link } from "react-router-dom";

// DRAFT marketing-site legal pages (Privacy, Cookies, Terms). Plain content — have a
// solicitor review and fill the [bracketed] placeholders before relying on them.
const ENTITY = {
  trading: "Velox House",
  legal: "[Legal / trading name]",
  address: "[Registered/business address]",
  email: "team@veloxhouse.co.uk",
  ico: "[ICO registration number]",
};

type Doc = { title: string; updated: string; intro: string; sections: { h: string; body: string[] }[] };

const DOCS: Record<string, Doc> = {
  privacy: {
    title: "Privacy Policy",
    updated: "[Date]",
    intro: `This policy explains how ${ENTITY.trading} (operated by ${ENTITY.legal}) handles personal data collected through this marketing website. For the Velox House app, a separate in-app privacy policy applies. Questions: ${ENTITY.email}.`,
    sections: [
      { h: "1. Data we collect", body: [
        "If you use the free email-deliverability check or a contact/sign-up form, we collect the email address and any details you enter.",
        "With your consent, we collect analytics data (pages viewed, approximate device/browser, referrer and UTM parameters, and a random session identifier) to understand site traffic.",
        "Essential data needed to serve and secure the site.",
      ] },
      { h: "2. Why we use it", body: [
        "To respond to enquiries and provide the tools you request (contract / steps prior to entering a contract); to understand and improve the site (consent, for analytics); and to secure the site (legitimate interests).",
      ] },
      { h: "3. Sharing", body: [
        "We use vetted providers to run the site and tools (hosting, analytics, email). We do not sell personal data. Some providers are outside the UK/EEA; where so, we rely on adequacy or Standard Contractual Clauses / the UK Addendum.",
      ] },
      { h: "4. Retention", body: [
        "We keep enquiry data as long as needed to help you and for a reasonable period after; analytics data for a limited period. You can ask us to delete your data at any time.",
      ] },
      { h: "5. Your rights", body: [
        `Under UK GDPR you have rights of access, rectification, erasure, restriction, portability and objection. To exercise them, email ${ENTITY.email}. You can also complain to the ICO (ico.org.uk).`,
      ] },
      { h: "6. Contact", body: [
        `${ENTITY.legal}, ${ENTITY.address}. Email: ${ENTITY.email}. ICO registration: ${ENTITY.ico}.`,
      ] },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    updated: "[Date]",
    intro: `How ${ENTITY.trading} uses cookies and similar technologies on this website. Manage non-essential cookies via the banner.`,
    sections: [
      { h: "1. Essential", body: ["Needed for the site to work (security, load balancing, remembering your cookie choice). Always on."] },
      { h: "2. Analytics (consent)", body: ["Help us understand traffic so we can improve. A random session identifier and page-view events are set only after you accept."] },
      { h: "3. Managing cookies", body: ["Use the banner to accept or reject non-essential cookies. You can also block cookies in your browser. Rejecting turns analytics off and clears the analytics identifier."] },
    ],
  },
  terms: {
    title: "Terms of Use",
    updated: "[Date]",
    intro: `These terms cover use of the ${ENTITY.trading} marketing website. Use of the Velox House app is governed by its own in-app Terms.`,
    sections: [
      { h: "1. Use of the site", body: ["The site and its free tools are provided for general information and evaluation. Don't misuse them or attempt to disrupt the service."] },
      { h: "2. No warranty", body: ["Content and free tools are provided “as is” without warranties. Results from the email-check tool are indicative, not guarantees."] },
      { h: "3. Liability", body: ["To the extent permitted by law, we are not liable for loss arising from use of this site."] },
      { h: "4. Governing law", body: ["England and Wales."] },
    ],
  },
};

export default function Legal() {
  const { slug } = useParams();
  const doc = slug ? DOCS[slug] : undefined;

  if (!doc) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-32 text-center">
        <h1 className="font-display text-3xl font-bold">Not found</h1>
        <Link to="/" className="mt-4 inline-block text-[#FF5A3C] hover:underline">← Back home</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-24 md:py-32">
      <p className="text-sm text-[#666]">Draft — pending review</p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.02em]">{doc.title}</h1>
      <p className="mt-1 text-sm text-[#A0A0A0]">Last updated: {doc.updated}</p>
      <p className="mt-6 text-[#A0A0A0]">{doc.intro}</p>
      <div className="mt-10 flex flex-col gap-8">
        {doc.sections.map((s) => (
          <section key={s.h}>
            <h2 className="font-display text-xl font-semibold">{s.h}</h2>
            <div className="mt-2 flex flex-col gap-2">
              {s.body.map((b, i) => (
                <p key={i} className="text-sm leading-relaxed text-[#A0A0A0]">{b}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-12 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#666]">
        <Link to="/legal/privacy" className="hover:text-white">Privacy</Link>
        <Link to="/legal/cookies" className="hover:text-white">Cookies</Link>
        <Link to="/legal/terms" className="hover:text-white">Terms</Link>
      </div>
    </div>
  );
}
