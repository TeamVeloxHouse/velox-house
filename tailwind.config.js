/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0A0A0A",
        surface: "#141414",
        "surface-2": "#0F0F0F",
        border: "#1A1A1A",
        "border-hover": "#2A2A2A",
        // Layered off-blacks for vertical depth between sections
        ink: {
          900: "#070707",
          850: "#0A0A0A",
          800: "#0D0D0D",
          750: "#101010",
          700: "#141414",
          600: "#181818",
        },
        red: {
          DEFAULT: "#DA291C",
          accent: "#DA291C",
          hover: "#FF3B2D",
          ember: "#FF5A3C", // lighter, for gradients + glows
          crimson: "#A81F13", // deeper shade
        },
      },
      fontFamily: {
        display: ['"Sora"', "system-ui", "sans-serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(218,41,28,0.45)",
        "glow-sm": "0 0 24px -8px rgba(218,41,28,0.4)",
        "glow-lg": "0 20px 60px -12px rgba(218,41,28,0.5)",
        cta: "0 10px 34px -8px rgba(218,41,28,0.55)",
      },
    },
  },
  plugins: [],
};
