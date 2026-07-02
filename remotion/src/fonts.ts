// Load brand fonts from Google Fonts (bundled by Remotion at render time — no FOUT).
import { loadFont as loadSora } from "@remotion/google-fonts/Sora";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const sora = loadSora("normal", { weights: ["400", "600", "700", "800"] });
const inter = loadInter("normal", { weights: ["400", "500", "600", "700"] });
const interItalic = loadInter("italic", { weights: ["900"] });

export const SORA = sora.fontFamily;
export const INTER = inter.fontFamily;
export const INTER_ITALIC = interItalic.fontFamily;
