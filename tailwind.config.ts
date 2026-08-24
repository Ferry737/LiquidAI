// tailwind.config.ts
// v2.2 — institutional reskin. Neutral-dominant palette, restrained accent.
// Class names preserved so existing components keep working; only tokens change.
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Restrained LiquidAI accent — a single refined teal (not indigo/violet).
        brand: {
          50: "#EAFBF7",
          100: "#D2F4EC",
          200: "#A7E8DA",
          300: "#6FD6C4",
          400: "#3FBFA9",
          500: "#16A38B", // primary accent (used sparingly)
          600: "#0E8A76",
          700: "#0B6E5F",
          800: "#0A564B",
          900: "#083D36",
        },
        // Neutral surface ramp — warm off-white, calm paper.
        surface: {
          page: "#F6F5F2", // app background (warm off-white)
          sidebar: "#FFFFFF",
          paper: "#FFFFFF", // cards
          raised: "#FBFAF8",
          muted: "#ECEAE5", // dividers / subtle fills
        },
        ink: {
          DEFAULT: "#16181D", // text-primary (near-black)
          soft: "#3F434C", // text-secondary
          muted: "#6B7079", // text-tertiary
          faint: "#9CA0A8",
        },
        positive: "#1F8A4C",
        negative: "#C0392B",
        base: {
          900: "#0A0B0F",
          800: "#0E1016",
          700: "#141722",
        },
        // Muted, used only where genuinely needed
        accent: {
          emerald: "#16A38B",
          cyan: "#3FBFA9",
          violet: "#6B7079",
        },
      },
      fontFamily: {
        sans: ["var(--font-archivo)", "Archivo", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-archivo)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        DEFAULT: "6px",
        lg: "10px",
        xl: "12px",
        "2xl": "14px",
        "3xl": "16px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,18,22,0.04), 0 1px 3px rgba(16,18,22,0.06)",
        "card-hover": "0 2px 8px rgba(16,18,22,0.06), 0 1px 2px rgba(16,18,22,0.04)",
        nav: "0 1px 0 rgba(16,18,22,0.06)",
        pill: "0 1px 2px rgba(16,18,22,0.06)",
      },
      backdropBlur: {
        xs: "2px",
      },
      transitionDuration: {
        DEFAULT: "180ms",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        "fade-up": "fade-up 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
