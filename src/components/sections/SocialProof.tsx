import { motion } from "framer-motion";
import { Mail, Linkedin, Server, Building2, Search, ShieldCheck } from "lucide-react";
import { inViewport } from "../../lib/utils";

// Honest "works with your stack" strip — real integrations and data sources,
// not fabricated customer logos. Fills the trust slot without claiming anything
// untrue while the product is early.
const STACK = [
  { icon: Mail, label: "Gmail" },
  { icon: Building2, label: "Microsoft 365" },
  { icon: Server, label: "Any SMTP" },
  { icon: Linkedin, label: "LinkedIn" },
  { icon: Search, label: "UK company data" },
  { icon: ShieldCheck, label: "SPF · DKIM · DMARC" },
];

export default function SocialProof() {
  return (
    <section className="surface-raised relative border-y border-[#1A1A1A] py-16">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={inViewport}
          className="text-center text-sm text-[#A0A0A0]"
        >
          Runs on the tools you already use — email from{" "}
          <span className="text-white">your own domain</span>, not a shared sender.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={inViewport}
          transition={{ delay: 0.1 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4"
        >
          {STACK.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 rounded-full border border-[#1F1F1F] bg-[#0F0F0F] px-4 py-2.5 text-sm text-[#B8B8B8] transition-colors hover:border-[#DA291C]/40 hover:text-white"
            >
              <Icon size={16} className="text-[#DA291C]" />
              <span className="font-medium tracking-wide">{label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
