// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: {
          900: "#0A0B0F",
          800: "#0E1016",
          700: "#141722",
        },
        accent: {
          emerald: "#34D399",
          cyan: "#22D3EE",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.05), 0 8px 40px rgba(52,211,153,0.08)",
        "glow-hover":
          "0 0 0 1px rgba(52,211,153,0.25), 0 12px 48px rgba(34,211,238,0.15)",
      },
      backdropBlur: {
        xs: "2px",
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
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
