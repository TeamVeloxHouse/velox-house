import { Easing, interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../theme";

// The Velox House "V." app mark, animated: the red tile springs in, the white
// chevron wipes downward as if being drawn, and the dot pops with a slight overshoot.
// Mirrors public/favicon.svg exactly (viewBox 0 0 512 512).
export const BrandMark: React.FC<{ size?: number }> = ({ size = 220 }) => {
  const frame = useCurrentFrame();

  const tileScale = interpolate(frame, [0, 14], [0.82, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const tileOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Chevron wipe reveal (top -> bottom).
  const wipe = interpolate(frame, [6, 30], [0, 400], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const dotScale = interpolate(frame, [26, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.56, 0.64, 1), // overshoot
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        scale: String(tileScale),
        opacity: tileOpacity,
        filter: "drop-shadow(0 24px 60px rgba(218,41,28,0.35))",
      }}
    >
      <defs>
        <clipPath id="vk-wipe">
          <rect x="0" y="0" width="512" height={wipe} />
        </clipPath>
        <linearGradient id="vk-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={COLORS.redBright} />
          <stop offset="100%" stopColor={COLORS.red} />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#vk-tile)" />
      <g clipPath="url(#vk-wipe)">
        <polygon
          points="120,144 192,144 236,304 280,144 352,144 236,388"
          fill={COLORS.white}
        />
      </g>
      <circle
        cx="394"
        cy="352"
        r="37"
        fill={COLORS.white}
        style={{ scale: String(dotScale), transformOrigin: "394px 352px" }}
      />
    </svg>
  );
};
