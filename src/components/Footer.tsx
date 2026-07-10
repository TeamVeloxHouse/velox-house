import Logo from "./Logo";
import { SIGNUP_URL, LOGIN_URL } from "../lib/utils";

// Real destinations only — feature links deep-link into the Features page,
// pricing/how-it-works scroll the homepage, tools opens the free checker.
const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Find Leads", href: "/features#find-leads" },
      { label: "AI Messaging", href: "/features#ai-messaging" },
      { label: "Sequences", href: "/features#sequences" },
      { label: "Pipeline & Inbox", href: "/features#pipeline-inbox" },
      { label: "Analytics", href: "/features#analytics" },
      { label: "Deliverability", href: "/features#deliverability" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "All features", href: "/features" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Free email check", href: "/tools" },
      { label: "Sign in", href: LOGIN_URL },
    ],
  },
  {
    title: "Get started",
    links: [
      { label: "How it works", href: "/#how" },
      { label: "Start free trial", href: SIGNUP_URL },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-[#1A1A1A] bg-[#0A0A0A] px-6 pb-10 pt-20 md:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Logo align="start" />

            <p className="mt-4 max-w-xs text-sm text-[#A0A0A0]">
              AI-powered cold outreach for ambitious B2B teams.
            </p>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-white">{col.title}</h4>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-[#A0A0A0] transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="mt-16 flex flex-col gap-3 border-t border-[#1A1A1A] pt-8 text-xs text-[#666] sm:flex-row sm:justify-between">
          <span>© 2026 Velox House Limited. All rights reserved.</span>
          <span>Built for ambitious UK businesses.</span>
        </div>
      </div>
    </footer>
  );
}
