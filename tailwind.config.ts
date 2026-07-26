// tailwind.config.ts
// v1.9 — reskinned to the SaaSable admin template aesthetic:
//   light theme, indigo/violet primary, Archivo type, soft surfaces.
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // SaaSable primary (indigo/violet) — #606BDF main
        brand: {
          50: "#EEF0FE",
          100: "#DDE0FD",
          200: "#C3C8FB",
          300: "#A3A8F7",
          400: "#8186F2",
          500: "#606BDF", // primary main
          600: "#4F55C9",
          700: "#3944B8", // primary dark
          800: "#2C348C",
          900: "#1F2566",
        },
        // Light neutral surface ramp (SaaSable greys)
        surface: {
          page: "#F4F5FB", // app background
          sidebar: "#FFFFFF",
          paper: "#FFFFFF", // cards
          raised: "#FBF8FF",
          muted: "#EFEDF4", // dividers / subtle fills
        },
        ink: {
          DEFAULT: "#1B1B1F", // text-primary
          soft: "#46464F", // text-secondary
          muted: "#777680", // text-tertiary
          faint: "#9A98A6",
        },
        positive: "#22892F",
        negative: "#D32F2F",
        base: {
          900: "#0A0B0F",
          800: "#0E1016",
          700: "#141722",
        },
        accent: {
          emerald: "#34D399",
          cyan: "#22D3EE",
          violet: "#A78BFA",
        },
      },
      fontFamily: {
        sans: ["var(--font-archivo)", "Archivo", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
        "3xl": "24px",
      },
      boxShadow: {
        card: "0px 2px 10px 0px rgba(27,27,31,0.06), 0px 1px 2px 0px rgba(27,27,31,0.04)",
        "card-hover":
          "0px 8px 24px -6px rgba(96,107,223,0.18), 0px 2px 6px 0px rgba(27,27,31,0.06)",
        nav: "0px 2px 14px rgba(27,27,31,0.05)",
        pill: "0px 1px 2px rgba(27,27,31,0.06)",
        glow: "0 0 0 3px rgba(96,107,223,0.18)",
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
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        "fade-up": "fade-up 0.4s ease-out both",
        float: "float 7s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
