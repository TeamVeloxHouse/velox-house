import { motion } from "framer-motion";

// On-brand product preview for the hero — a crisp SVG mock of the Velox House app
// (dark UI, crimson accents). Pure vector: razor-sharp at any size, ~0 load cost (great
// for SEO/Core Web Vitals), and no external image dependency.
export default function HeroMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.55 }}
      className="mt-16 w-full"
    >
      <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-[#1A1A1A] bg-[#0D0D0D] shadow-2xl">
        <svg
          viewBox="0 0 960 540"
          width="100%"
          role="img"
          aria-label="Velox House app dashboard showing a sales pipeline, reply rate, and contact engagement"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="hmBar" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#DA291C" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#DA291C" stopOpacity="1" />
            </linearGradient>
          </defs>

          {/* Window */}
          <rect x="0" y="0" width="960" height="540" fill="#0D0D0D" />
          {/* Title bar */}
          <rect x="0" y="0" width="960" height="40" fill="#141414" />
          <circle cx="24" cy="20" r="5" fill="#3a3a3a" />
          <circle cx="42" cy="20" r="5" fill="#3a3a3a" />
          <circle cx="60" cy="20" r="5" fill="#3a3a3a" />
          <rect x="360" y="11" width="240" height="18" rx="9" fill="#0A0A0A" />
          <text x="480" y="24" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="10" fill="#6b6b6b">hub.veloxhouse.co.uk</text>

          {/* Sidebar */}
          <rect x="0" y="40" width="190" height="500" fill="#0A0A0A" />
          <rect x="20" y="62" width="22" height="22" rx="6" fill="#DA291C" />
          <text x="31" y="78" textAnchor="middle" fontFamily="Sora, sans-serif" fontSize="14" fontWeight="800" fill="#ffffff">V</text>
          <circle cx="42" cy="82" r="2.2" fill="#ffffff" />
          <text x="52" y="79" fontFamily="Sora, sans-serif" fontSize="13" fontWeight="700" fill="#ffffff">Velox House</text>

          {["Dashboard", "Find leads", "Sequences", "Pipeline", "Inbox", "Analytics"].map((label, i) => (
            <g key={label}>
              <rect x="16" y={112 + i * 38} width="158" height="30" rx="7" fill={i === 3 ? "rgba(218,41,28,0.14)" : "transparent"} />
              <rect x="28" y={122 + i * 38} width="12" height="12" rx="3" fill={i === 3 ? "#DA291C" : "#3a3a3a"} />
              <text x="50" y={131 + i * 38} fontFamily="Inter, sans-serif" fontSize="11.5" fill={i === 3 ? "#ffffff" : "#8a8a8a"}>{label}</text>
            </g>
          ))}

          {/* Main header */}
          <text x="216" y="74" fontFamily="Sora, sans-serif" fontSize="17" fontWeight="700" fill="#ffffff">Pipeline</text>
          <rect x="828" y="58" width="112" height="26" rx="7" fill="#DA291C" />
          <text x="884" y="75" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="600" fill="#ffffff">Find leads</text>

          {/* KPI cards */}
          {[
            { x: 216, label: "Contacted", value: "1,284" },
            { x: 462, label: "Reply rate", value: "11.4%" },
            { x: 708, label: "Meetings booked", value: "37" },
          ].map((k) => (
            <g key={k.label}>
              <rect x={k.x} y="100" width="226" height="78" rx="10" fill="#121212" stroke="#1E1E1E" />
              <text x={k.x + 18} y="128" fontFamily="Inter, sans-serif" fontSize="11" fill="#8a8a8a">{k.label}</text>
              <text x={k.x + 18} y="158" fontFamily="Sora, sans-serif" fontSize="24" fontWeight="800" fill="#ffffff">{k.value}</text>
            </g>
          ))}

          {/* Chart card */}
          <rect x="216" y="196" width="472" height="324" rx="10" fill="#121212" stroke="#1E1E1E" />
          <text x="234" y="226" fontFamily="Inter, sans-serif" fontSize="12" fontWeight="600" fill="#cfcfcf">Engagement over time</text>
          {[
            150, 90, 175, 120, 210, 160, 235, 190, 260,
          ].map((h, i) => (
            <rect key={i} x={236 + i * 48} y={490 - h} width="26" height={h} rx="4" fill="url(#hmBar)" />
          ))}

          {/* Contacts list card */}
          <rect x="708" y="196" width="232" height="324" rx="10" fill="#121212" stroke="#1E1E1E" />
          <text x="726" y="226" fontFamily="Inter, sans-serif" fontSize="12" fontWeight="600" fill="#cfcfcf">Hot leads</text>
          {[
            { name: "S. Okafor", tag: "Replied", c: "#4ade80" },
            { name: "J. Whitfield", tag: "Opened", c: "#60a5fa" },
            { name: "P. Shah", tag: "Meeting", c: "#DA291C" },
            { name: "L. Pennington", tag: "Replied", c: "#4ade80" },
            { name: "R. Hollis", tag: "Opened", c: "#60a5fa" },
          ].map((r, i) => (
            <g key={r.name}>
              <circle cx="738" cy={258 + i * 50} r="11" fill="#1f1f1f" />
              <text x="738" y={262 + i * 50} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="9" fill="#9a9a9a">{r.name.charAt(0)}</text>
              <text x="758" y={262 + i * 50} fontFamily="Inter, sans-serif" fontSize="10.5" fill="#e5e5e5">{r.name}</text>
              <rect x="858" y={250 + i * 50} width="64" height="18" rx="9" fill={`${r.c}22`} />
              <text x="890" y={262 + i * 50} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="9" fill={r.c}>{r.tag}</text>
            </g>
          ))}
        </svg>
      </div>
    </motion.div>
  );
}
