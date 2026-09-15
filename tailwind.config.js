/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./*.tsx",
    "./{pages,components,contexts,hooks}/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        heading: ["Outfit", "sans-serif"],
      },
      backgroundImage: {
        "brand-gradient":
          "radial-gradient(circle at top left, #1C1917, #050505)",
        "glass-gradient":
          "linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.01))",
      },
      colors: {
        primary: "#F97316",
        "primary-hover": "#EA580C",
        positive: "#22C55E",
        negative: "#EF4444",
        warning: "#F59E0B",
        accent: "#22C55E",
      },
      boxShadow: {
        neon: "0 0 10px rgba(249, 115, 22, 0.25)",
        "neon-accent": "0 0 10px rgba(34, 197, 94, 0.25)",
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.8)",
      },
    },
  },
};
