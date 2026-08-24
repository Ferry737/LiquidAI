import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Carbon / near-black
        carbon: {
          DEFAULT: "#0B0D0F",
          soft: "#111417",
          raised: "#161A1F",
          line: "#222831",
        },
        // Warm white / ivory
        ivory: {
          DEFAULT: "#F7F4EF",
          dim: "#E7E2DA",
          mute: "#B8B2A8",
        },
        // Muted graphite
        graphite: "#6B7280",
        // Liquid aqua
        aqua: {
          DEFAULT: "#3FE0C5",
          deep: "#1FB6A0",
          glow: "#5CF0D8",
        },
        // Subtle electric green
        egreen: {
          DEFAULT: "#5BE38B",
          deep: "#2FA866",
        },
        // Restrained blue
        rblue: {
          DEFAULT: "#4C8DFF",
          deep: "#2E5FCC",
        },
        // High-energy accent (used sparingly)
        accent: {
          DEFAULT: "#FF5C3A",
          glow: "#FF7A5C",
        },
      },
      fontFamily: {
        sans: ["var(--font-grotesk)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // editorial scale
        hero: ["clamp(2.75rem, 7vw, 6.5rem)", { lineHeight: "0.98", letterSpacing: "-0.03em" }],
        h2: ["clamp(2rem, 4.6vw, 4.5rem)", { lineHeight: "1.02", letterSpacing: "-0.02em" }],
        h3: ["clamp(1.6rem, 2.4vw, 2.25rem)", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
        body: ["clamp(1.05rem, 1.1vw, 1.25rem)", { lineHeight: "1.6" }],
      },
      maxWidth: {
        content: "1280px",
      },
      borderRadius: {
        card: "18px",
        pill: "999px",
      },
      boxShadow: {
        depth: "0 24px 60px -20px rgba(0,0,0,0.55)",
        aqua: "0 0 0 1px rgba(63,224,197,0.25), 0 18px 50px -18px rgba(63,224,197,0.35)",
        lift: "0 10px 30px -12px rgba(0,0,0,0.6)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        marquee: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        pulseLine: { "0%,100%": { opacity: "0.4" }, "50%": { opacity: "1" } },
      },
      animation: {
        marquee: "marquee 32s linear infinite",
        pulseLine: "pulseLine 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
