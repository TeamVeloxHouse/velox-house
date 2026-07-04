import { Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { COLORS, SORA, INTER } from "../theme";

const ease = Easing.bezier(0.16, 1, 0.3, 1);

// Count a number up from 0 -> target over [start,end] frames.
const useCount = (frame: number, start: number, end: number, target: number) =>
  interpolate(frame, [start, end], [0, target], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });

const NAV = ["Dashboard", "Find leads", "Sequences", "Pipeline", "Inbox", "Analytics"];
const BARS = [40, 58, 46, 72, 60, 88, 76, 100, 92]; // relative heights (%)

// An animated recreation of the marketing site's HeroMockup: a Velox House
// dashboard with live-counting KPIs, a growing engagement chart, and an
// incoming-reply notification.
export const Dashboard: React.FC = () => {
  const frame = useCurrentFrame();

  const contacted = Math.round(useCount(frame, 8, 48, 1284));
  const replyRate = useCount(frame, 14, 54, 11.4);
  const meetings = Math.round(useCount(frame, 20, 60, 37));

  // Incoming reply toast slides in ~frame 66.
  const toastIn = interpolate(frame, [66, 84], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });

  // "Meeting booked" row pulses ~frame 96.
  const bookGlow = interpolate(frame, [96, 108, 130], [0, 1, 0.55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const card: React.CSSProperties = {
    background: COLORS.card,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 14,
  };

  return (
    <div
      style={{
        width: 1180,
        height: 664,
        background: "#0D0D0D",
        border: `1px solid ${COLORS.borderSoft}`,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
        fontFamily: INTER,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Browser chrome */}
      <div
        style={{
          height: 46,
          background: COLORS.surface,
          display: "flex",
          alignItems: "center",
          paddingLeft: 20,
          gap: 9,
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
            padding: "5px 60px",
            fontSize: 12,
            color: "#6b6b6b",
          }}
        >
          hub.veloxhouse.co.uk
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <div style={{ width: 220, background: COLORS.background, padding: "22px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 26, paddingLeft: 8 }}>
            <Img src={staticFile("velox-mark.png")} style={{ width: 26, height: 26 }} />
            <span style={{ fontFamily: SORA, fontWeight: 700, color: "#fff", fontSize: 15 }}>Velox House</span>
          </div>
          {NAV.map((label) => {
            const active = label === "Pipeline";
            return (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 9,
                  marginBottom: 3,
                  background: active ? "rgba(218,41,28,0.14)" : "transparent",
                }}
              >
                <span style={{ width: 13, height: 13, borderRadius: 4, background: active ? COLORS.red : "#3a3a3a" }} />
                <span style={{ fontSize: 13.5, color: active ? "#fff" : COLORS.muted }}>{label}</span>
              </div>
            );
          })}
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: "24px 26px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <span style={{ fontFamily: SORA, fontWeight: 700, color: "#fff", fontSize: 20 }}>Pipeline</span>
            <span style={{ background: COLORS.red, color: "#fff", fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 8 }}>Find leads</span>
          </div>

          {/* KPI cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 16 }}>
            {[
              { label: "Contacted", value: contacted.toLocaleString() },
              { label: "Reply rate", value: `${replyRate.toFixed(1)}%` },
              { label: "Meetings booked", value: String(meetings) },
            ].map((k) => (
              <div key={k.label} style={{ ...card, padding: "16px 18px" }}>
                <div style={{ fontSize: 12.5, color: COLORS.muted }}>{k.label}</div>
                <div style={{ fontFamily: SORA, fontWeight: 800, color: "#fff", fontSize: 30, marginTop: 6 }}>{k.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 14, minHeight: 0 }}>
            {/* Chart */}
            <div style={{ ...card, flex: 1.55, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#cfcfcf", marginBottom: 14 }}>Engagement over time</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 220 }}>
                {BARS.map((h, i) => {
                  const grow = interpolate(frame, [10 + i * 4, 34 + i * 4], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: ease,
                  });
                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: `${h * grow}%`,
                        borderRadius: 5,
                        background: "linear-gradient(180deg, #DA291C 0%, rgba(218,41,28,0.35) 100%)",
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Activity feed */}
            <div style={{ ...card, flex: 1, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#cfcfcf" }}>Live activity</div>

              {/* Incoming reply toast */}
              <div
                style={{
                  display: "flex",
                  gap: 11,
                  alignItems: "flex-start",
                  padding: 12,
                  borderRadius: 10,
                  background: "rgba(218,41,28,0.10)",
                  border: "1px solid rgba(218,41,28,0.35)",
                  opacity: toastIn,
                  transform: `translateY(${interpolate(toastIn, [0, 1], [14, 0])}px)`,
                }}
              >
                <span style={{ width: 30, height: 30, borderRadius: 15, background: COLORS.red, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}>SR</span>
                <div>
                  <div style={{ fontSize: 12.5, color: "#fff", fontWeight: 600 }}>New reply · Sarah R.</div>
                  <div style={{ fontSize: 11.5, color: COLORS.muted, marginTop: 2 }}>"Yes — let's find 30 mins next week."</div>
                </div>
              </div>

              {/* Meeting booked row */}
              <div
                style={{
                  display: "flex",
                  gap: 11,
                  alignItems: "center",
                  padding: 12,
                  borderRadius: 10,
                  background: `rgba(34,197,94,${0.06 + bookGlow * 0.1})`,
                  border: `1px solid rgba(34,197,94,${0.2 + bookGlow * 0.4})`,
                }}
              >
                <span style={{ width: 30, height: 30, borderRadius: 15, background: "rgba(34,197,94,0.2)", color: "#22C55E", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700 }}>✓</span>
                <div>
                  <div style={{ fontSize: 12.5, color: "#fff", fontWeight: 600 }}>Meeting booked</div>
                  <div style={{ fontSize: 11.5, color: COLORS.muted, marginTop: 2 }}>Thu 10:00 · Discovery call</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
