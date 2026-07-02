import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  useCurrentFrame,
} from "remotion";
import { Background } from "./components/Background";
import { BrandMark } from "./components/BrandMark";
import { Dashboard } from "./components/Dashboard";
import { COLORS, INTER, INTER_ITALIC, SORA } from "./theme";
import "./fonts";

const ease = Easing.bezier(0.16, 1, 0.3, 1);

// Fade + rise, clamped both ends. `hold` keeps it fully visible, then it fades out.
const reveal = (frame: number, inAt: number, holdUntil: number) => {
  const opacity = interpolate(
    frame,
    [inAt, inAt + 16, holdUntil, holdUntil + 14],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease }
  );
  const y = interpolate(frame, [inAt, inAt + 18], [22, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  return { opacity, y };
};

// ── Scene 1: brand ───────────────────────────────────────────────
const BrandScene: React.FC = () => {
  const frame = useCurrentFrame();
  const word = reveal(frame, 26, 66);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30 }}>
      <BrandMark size={168} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          lineHeight: 0.86,
          opacity: word.opacity,
          transform: `translateY(${word.y}px)`,
        }}
      >
        <span style={{ fontFamily: INTER, fontWeight: 700, letterSpacing: "0.34em", color: COLORS.red, fontSize: 22, marginBottom: 8, textTransform: "uppercase", paddingLeft: "0.34em" }}>
          House
        </span>
        <span style={{ fontFamily: INTER_ITALIC, fontStyle: "italic", fontWeight: 900, letterSpacing: "-0.04em", color: "#fff", fontSize: 96, textTransform: "uppercase" }}>
          Velox
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 2: tagline (word-staggered) ────────────────────────────
const WORDS = ["Cold", "outreach", "that", "books", "meetings", "on", "autopilot."];
const TaglineScene: React.FC = () => {
  const frame = useCurrentFrame();
  const outOpacity = interpolate(frame, [78, 94], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 200px" }}>
      <div style={{ opacity: outOpacity, textAlign: "center" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 22px", maxWidth: 1300 }}>
          {WORDS.map((w, i) => {
            const inAt = 6 + i * 6;
            const o = interpolate(frame, [inAt, inAt + 16], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: ease,
            });
            const y = interpolate(frame, [inAt, inAt + 18], [26, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: ease,
            });
            const isAccent = w === "meetings" || w === "autopilot.";
            return (
              <span
                key={i}
                style={{
                  fontFamily: SORA,
                  fontWeight: 800,
                  fontSize: 82,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.02,
                  color: isAccent ? COLORS.red : "#fff",
                  opacity: o,
                  transform: `translateY(${y}px)`,
                  display: "inline-block",
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 3: animated product ────────────────────────────────────
const ProductScene: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const scale = interpolate(enter, [0, 1], [0.94, 1]);
  const y = interpolate(enter, [0, 1], [40, 0]);
  const capt = reveal(frame, 8, 100000);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30 }}>
      {/* small wordmark + caption above the product */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: capt.opacity, transform: `translateY(${capt.y}px)` }}>
        <BrandMark size={40} />
        <span style={{ fontFamily: INTER, fontSize: 20, color: COLORS.muted2, letterSpacing: "-0.01em" }}>
          Find. Research. Write. <span style={{ color: "#fff", fontWeight: 600 }}>Book meetings — on autopilot.</span>
        </span>
      </div>
      <div style={{ opacity: enter, transform: `scale(${scale}) translateY(${y}px)` }}>
        <Dashboard />
      </div>
    </AbsoluteFill>
  );
};

export const VeloxHero: React.FC = () => {
  return (
    <AbsoluteFill>
      <Background />
      <Sequence durationInFrames={92}>
        <BrandScene />
      </Sequence>
      <Sequence from={84} durationInFrames={96}>
        <TaglineScene />
      </Sequence>
      <Sequence from={170}>
        <ProductScene />
      </Sequence>
    </AbsoluteFill>
  );
};
