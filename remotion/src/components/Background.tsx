import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";

// Shared backdrop: near-black base, subtle dot grid, and a slowly breathing
// crimson radial glow at the top — the exact texture of the marketing hero.
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Gentle breathing of the red glow across the whole clip.
  const glow = interpolate(
    frame,
    [0, durationInFrames / 2, durationInFrames],
    [0.1, 0.18, 0.1],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      {/* Dot grid */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          opacity: 0.6,
        }}
      />
      {/* Crimson radial glow, top-centre */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 65% 55% at 50% -5%, rgba(218,41,28,${glow}), transparent 70%)`,
        }}
      />
      {/* Vignette for depth */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 120% 100% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
