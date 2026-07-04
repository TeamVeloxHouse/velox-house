// Velox House logo lockup — fox mark + wordmark (mirrors the app's Logo).
//   Mark  — /velox-mark.png (transparent red fox)
//   VELOX — Inter 900 italic, letter-spacing -0.04em
//   HOUSE — Inter 700, letter-spacing 0.16em, all caps, red
// The marketing site is always dark, so VELOX renders white.
const INTER = "'Inter', sans-serif";

export default function Logo({
  className,
  compact,
  align = "start",
}: {
  className?: string;
  compact?: boolean;
  align?: "start" | "end";
}) {
  if (compact) {
    return (
      <img
        src="/velox-mark.png"
        alt="Velox House"
        className={`h-8 w-8 ${className ?? ""}`}
      />
    );
  }
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <img src="/velox-mark.png" alt="" aria-hidden className="h-9 w-9 shrink-0" />
      <div
        className={`flex flex-col leading-[0.82] ${
          align === "start" ? "items-start" : "items-end"
        }`}
      >
        <span
          className="text-[10px] uppercase text-[#DA291C]"
          style={{ fontFamily: INTER, fontWeight: 700, letterSpacing: "0.16em" }}
        >
          House
        </span>
        <span
          className="text-2xl uppercase text-white"
          style={{
            fontFamily: INTER,
            fontWeight: 900,
            fontStyle: "italic",
            letterSpacing: "-0.04em",
          }}
        >
          Velox
        </span>
      </div>
    </div>
  );
}
