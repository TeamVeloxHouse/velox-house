import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { COLORS, INTER } from "../theme";

// A macOS-style browser window wrapping a product screenshot, with a slow Ken Burns
// zoom so the still feels alive. `shot` is a filename in public/shots.
export const DeviceFrame: React.FC<{
  shot: string;
  url?: string;
  width?: number;
  kenBurns?: boolean;
}> = ({ shot, url = "app.veloxhouse.co.uk", width = 1180, kenBurns = true }) => {
  const frame = useCurrentFrame();
  const zoom = kenBurns
    ? interpolate(frame, [0, 150], [1, 1.08], { extrapolateRight: "clamp" })
    : 1;
  const drift = kenBurns
    ? interpolate(frame, [0, 150], [0, -2], { extrapolateRight: "clamp" })
    : 0;

  return (
    <div
      style={{
        width,
        borderRadius: 16,
        overflow: "hidden",
        border: `1px solid ${COLORS.borderSoft}`,
        background: "#0D0D0D",
        boxShadow: "0 50px 130px rgba(0,0,0,0.65)",
      }}
    >
      {/* Browser chrome */}
      <div
        style={{
          height: 44,
          background: COLORS.surface,
          display: "flex",
          alignItems: "center",
          paddingLeft: 18,
          gap: 8,
          position: "relative",
        }}
      >
        {["#3a3a3a", "#3a3a3a", "#3a3a3a"].map((c, i) => (
          <span key={i} style={{ width: 11, height: 11, borderRadius: 6, background: c }} />
        ))}
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            background: COLORS.background,
            borderRadius: 8,
            padding: "6px 70px",
            fontSize: 13,
            color: "#6b6b6b",
            fontFamily: INTER,
          }}
        >
          {url}
        </div>
      </div>
      {/* Screenshot */}
      <div style={{ overflow: "hidden", lineHeight: 0 }}>
        <Img
          src={staticFile(`shots/${shot}`)}
          style={{
            width: "100%",
            display: "block",
            scale: String(zoom),
            translate: `0px ${drift}%`,
            transformOrigin: "center top",
          }}
        />
      </div>
    </div>
  );
};
