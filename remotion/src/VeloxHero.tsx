import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  useCurrentFrame,
} from "remotion";
import { Background } from "./components/Background";
import { BrandMark } from "./components/BrandMark";
import { FeatureScene, Feature } from "./components/FeatureScene";
import { COLORS, INTER, INTER_ITALIC, SORA } from "./theme";
import "./fonts";

const ease = Easing.bezier(0.16, 1, 0.3, 1);

// ── Scene 1: brand ───────────────────────────────────────────────
const BrandScene: React.FC = () => {
  const frame = useCurrentFrame();
  const wordO = interpolate(frame, [24, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const wordY = interpolate(frame, [24, 42], [22, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const out = interpolate(frame, [48, 60], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 28, opacity: out }}>
      <BrandMark size={150} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 0.86, opacity: wordO, transform: `translateY(${wordY}px)` }}>
        <span style={{ fontFamily: INTER, fontWeight: 700, letterSpacing: "0.34em", color: COLORS.red, fontSize: 20, marginBottom: 8, textTransform: "uppercase", paddingLeft: "0.34em" }}>
          House
        </span>
        <span style={{ fontFamily: INTER_ITALIC, fontStyle: "italic", fontWeight: 900, letterSpacing: "-0.04em", color: "#fff", fontSize: 88, textTransform: "uppercase" }}>
          Velox
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 2: hook line ───────────────────────────────────────────
const HOOK = ["Cold", "outreach,", "fully", "automated."];
const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [66, 82], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 200px" }}>
      <div style={{ opacity: out, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 24px", maxWidth: 1300 }}>
        {HOOK.map((w, i) => {
          const at = 4 + i * 7;
          const o = interpolate(frame, [at, at + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
          const y = interpolate(frame, [at, at + 17], [26, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
          return (
            <span key={i} style={{ fontFamily: SORA, fontWeight: 800, fontSize: 88, letterSpacing: "-0.02em", color: w === "automated." ? COLORS.red : "#fff", opacity: o, transform: `translateY(${y}px)`, display: "inline-block" }}>
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── Final scene: CTA ─────────────────────────────────────────────
const CtaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const rise = (at: number) => ({
    opacity: interpolate(frame, [at, at + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease }),
    transform: `translateY(${interpolate(frame, [at, at + 17], [22, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease })}px)`,
  });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 34 }}>
      <div style={rise(0)}>
        <BrandMark size={92} />
      </div>
      <div style={{ ...rise(8), fontFamily: SORA, fontWeight: 800, fontSize: 62, letterSpacing: "-0.02em", lineHeight: 1.08, color: "#fff", textAlign: "center", maxWidth: 1200 }}>
        Cold outreach that books meetings <span style={{ color: COLORS.red }}>on autopilot.</span>
      </div>
      <div style={{ ...rise(16), display: "flex", alignItems: "center", gap: 20, marginTop: 6 }}>
        <div style={{ background: COLORS.red, color: "#fff", fontFamily: INTER, fontWeight: 600, fontSize: 24, padding: "18px 34px", borderRadius: 12 }}>
          Start free — no card required
        </div>
        <span style={{ fontFamily: INTER, fontSize: 24, color: COLORS.muted2 }}>veloxhouse.co.uk</span>
      </div>
    </AbsoluteFill>
  );
};

// ── Feature beats ────────────────────────────────────────────────
const FEATURES: Feature[] = [
  {
    shot: "find-leads.png",
    eyebrow: "Find leads",
    title: "Your ideal customers, found in seconds",
    sub: "Describe who you want to reach. Velox surfaces verified decision-makers — name, role and email — from a 500k+ company database.",
    stat: "Build a targeted list in seconds",
    side: "right",
  },
  {
    shot: "pipeline.png",
    eyebrow: "AI research & writing",
    title: "Every email researched and written for you",
    sub: "AI studies each prospect and drafts a genuinely personal message. You just review and hit send — no blank pages, no busywork.",
    stat: "Hours of writing → one click",
    side: "left",
  },
  {
    shot: "sequences.png",
    eyebrow: "Sequences",
    title: "Follow-ups that run on autopilot",
    sub: "Multi-step sequences send from your own inbox on your schedule — and stop the instant someone replies.",
    stat: "58% open · 9% reply",
    side: "right",
  },
  {
    shot: "dashboard.png",
    eyebrow: "Live pipeline",
    title: "Watch replies and meetings roll in",
    sub: "Opens, replies and booked meetings update in real time, so you always know exactly what's working.",
    stat: "Meetings booked — on autopilot",
    side: "left",
  },
];

const FEATURE_DUR = 134;
const FEATURE_START = 138;
const FEATURE_STEP = 130; // slight overlap for crossfades

export const VeloxHero: React.FC = () => {
  return (
    <AbsoluteFill>
      <Background />
      <Sequence durationInFrames={62}>
        <BrandScene />
      </Sequence>
      <Sequence from={56} durationInFrames={86}>
        <HookScene />
      </Sequence>
      {FEATURES.map((f, i) => (
        <Sequence
          key={f.shot}
          from={FEATURE_START + i * FEATURE_STEP}
          durationInFrames={FEATURE_DUR}
          style={{
            scale: 1.076
          }}>
          <FeatureScene feature={f} outAt={FEATURE_DUR - 16} />
        </Sequence>
      ))}
      <Sequence from={FEATURE_START + FEATURES.length * FEATURE_STEP - 6}>
        <CtaScene />
      </Sequence>
    </AbsoluteFill>
  );
};
