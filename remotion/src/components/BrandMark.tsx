import { Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

// The Velox House fox mark, animated: scales up with a subtle overshoot while
// fading in, under a soft red glow. Uses the final brand icon
// (remotion/public/velox-mark.png — the transparent red fox).
export const BrandMark: React.FC<{ size?: number }> = ({ size = 220 }) => {
  const frame = useCurrentFrame();

  const scale = interpolate(frame, [0, 16], [0.72, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.56, 0.64, 1), // overshoot
  });
  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <Img
      src={staticFile("velox-mark.png")}
      style={{
        width: size,
        height: size,
        transform: `scale(${scale})`,
        opacity,
        filter: "drop-shadow(0 20px 50px rgba(218,41,28,0.4))",
      }}
    />
  );
};
