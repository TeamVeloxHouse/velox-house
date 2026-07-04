// Velox House logo — the official fox + wordmark lockup (single artwork).
//   Full    — /velox-lockup-dark.png (transparent, tight-cropped; marketing is always dark)
//   Compact — /velox-mark.png (fox mark only, for tight spaces)
export default function Logo({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
  /** kept for call-site compatibility; the single-artwork lockup ignores it */
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
    <img
      src="/velox-lockup-dark.png"
      alt="Velox House"
      className={`h-9 w-auto ${className ?? ""}`}
    />
  );
}
