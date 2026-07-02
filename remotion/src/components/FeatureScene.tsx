import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { COLORS, INTER, SORA } from "../theme";
import { DeviceFrame } from "./DeviceFrame";

const ease = Easing.bezier(0.16, 1, 0.3, 1);

export type Feature = {
  shot: string;
  url?: string;
  eyebrow: string;
  title: string;
  sub: string;
  stat: string;
  side?: "left" | "right"; // which side the copy sits on
};

// One feature beat of the advert: a headline + benefit + speed stat next to a
// browser-framed product screenshot. Everything eases in, holds, then eases out
// (the parent <Sequence> controls timing).
export const FeatureScene: React.FC<{ feature: Feature; outAt: number }> = ({
  feature,
  outAt,
}) => {
  const frame = useCurrentFrame();
  const side = feature.side ?? "right";

  const out = interpolate(frame, [outAt, outAt + 14], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Copy elements stagger in.
  const line = (i: number) => {
    const at = 8 + i * 7;
    return {
      opacity: interpolate(frame, [at, at + 14], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: ease,
      }),
      transform: `translateY(${interpolate(frame, [at, at + 16], [20, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: ease,
      })}px)`,
    };
  };

  // Device slides in from its side.
  const dev = interpolate(frame, [4, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const devX = interpolate(dev, [0, 1], [side === "right" ? 70 : -70, 0]);

  const Copy = (
    <div style={{ flex: "0 0 33%", maxWidth: 520 }}>
      <div
        style={{
          ...line(0),
          fontFamily: INTER,
          fontWeight: 700,
          letterSpacing: "0.22em",
          fontSize: 17,
          color: COLORS.red,
          textTransform: "uppercase",
          marginBottom: 22,
        }}
      >
        {feature.eyebrow}
      </div>
      <div
        style={{
          ...line(1),
          fontFamily: SORA,
          fontWeight: 800,
          fontSize: 52,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          color: "#fff",
          marginBottom: 22,
        }}
      >
        {feature.title}
      </div>
      <div
        style={{
          ...line(2),
          fontFamily: INTER,
          fontSize: 22,
          lineHeight: 1.5,
          color: COLORS.muted2,
          marginBottom: 26,
        }}
      >
        {feature.sub}
      </div>
      <div
        style={{
          ...line(3),
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          fontFamily: INTER,
          fontSize: 18,
          fontWeight: 600,
          color: "#fff",
          background: "rgba(218,41,28,0.12)",
          border: "1px solid rgba(218,41,28,0.35)",
          borderRadius: 999,
          padding: "10px 18px",
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 4, background: COLORS.red }} />
        {feature.stat}
      </div>
    </div>
  );

  const Device = (
    <div
      style={{
        flex: "1 1 auto",
        display: "flex",
        justifyContent: "center",
        opacity: dev,
        transform: `translateX(${devX}px)`,
      }}
    >
      <DeviceFrame shot={feature.shot} url={feature.url} width={1120} />
    </div>
  );

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        opacity: out,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 72,
          width: "100%",
          padding: "0 110px",
          flexDirection: side === "right" ? "row" : "row-reverse",
        }}
      >
        {Copy}
        {Device}
      </div>
    </AbsoluteFill>
  );
};
