import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"]
      },
      colors: {
        // Indigo is the single accent. Reserved for Critical severity, focus,
        // and the active state of a control. Everything else stays zinc.
        accent: {
          DEFAULT: "#6366f1",
          dim: "#4f46e5",
          soft: "#818cf8"
        },
        // Muted severity ramp. Grays for the quiet end, two restrained warm
        // tones in the middle, indigo alone at the top so Critical stands apart.
        sev: {
          info: "#71717a",
          low: "#a1a1aa",
          medium: "#b7935a",
          high: "#c2705a",
          critical: "#818cf8"
        }
      },
      letterSpacing: {
        wordmark: "0.34em"
      },
      keyframes: {
        reveal: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        reveal: "reveal 520ms cubic-bezier(0.2, 0.6, 0.2, 1) backwards"
      }
    }
  },
  plugins: []
};

export default config;
