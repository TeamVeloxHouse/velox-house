// Velox House wordmark — exact brand spec (mirrors the app's Logo):
//   VELOX — Inter 900 italic, letter-spacing -0.04em
//   HOUSE — Inter 700, letter-spacing 0.16em, all caps, red
// The marketing site is always dark, so VELOX renders white.
const INTER = "'Inter', sans-serif";

export default function Logo({
  className,
  compact,
  align = "end",
}: {
  className?: string;
  compact?: boolean;
  align?: "start" | "end";
}) {
  if (compact) {
    return (
      <span
        className={`text-xl text-white ${className ?? ""}`}
        style={{
          fontFamily: INTER,
          fontWeight: 900,
          fontStyle: "italic",
          letterSpacing: "-0.04em",
        }}
      >
        V<span className="text-[#DA291C]">X</span>
      </span>
    );
  }
  return (
    <div
      className={`flex flex-col leading-[0.82] ${
        align === "start" ? "items-start" : "items-end"
      } ${className ?? ""}`}
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
  );
}
