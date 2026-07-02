// Velox House brand tokens — mirrors tailwind.config.js on the marketing site.
export const COLORS = {
  background: "#0A0A0A",
  surface: "#141414",
  surface2: "#0F0F0F",
  card: "#121212",
  border: "#1E1E1E",
  borderSoft: "#1A1A1A",
  red: "#DA291C",
  redBright: "#E8202A",
  redHover: "#FF3B2D",
  white: "#FFFFFF",
  text: "#EDEDED",
  muted: "#8A8A8A",
  muted2: "#A0A0A0",
};

// Font families are resolved at runtime via @remotion/google-fonts and loaded as a
// side effect of importing this module (see fonts.ts). Components import the family
// names from here.
export { SORA, INTER, INTER_ITALIC } from "./fonts";
