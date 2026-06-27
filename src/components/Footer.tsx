import Logo from "./Logo";

const COLUMNS = [
  {
    title: "Product",
    links: ["Find Leads", "AI Messaging", "Sequences", "Pipeline & Inbox", "Analytics", "Deliverability"],
  },
  {
    title: "Company",
    links: ["About", "Customers", "Pricing", "Free tools", "Contact"],
  },
  {
    title: "Resources",
    links: ["How it works", "Help centre", "Case studies", "Legal"],
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
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-[#A0A0A0] transition-colors hover:text-white"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="mt-16 flex flex-col gap-3 border-t border-[#1A1A1A] pt-8 text-xs text-[#666] sm:flex-row sm:justify-between">
          <span>© 2025 Velox House Limited. All rights reserved.</span>
          <span>Built for ambitious UK businesses.</span>
        </div>
      </div>
    </footer>
  );
}
