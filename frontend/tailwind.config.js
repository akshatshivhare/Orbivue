/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        space: {
          bg: "#050914",
          panel: "#0b1220",
          card: "#101a2d",
          muted: "#17243a",
          border: "#253552",
          text: "#e5f3ff",
          soft: "#94a8c8"
        },
        neon: {
          cyan: "#22d3ee",
          blue: "#3b82f6",
          green: "#34d399",
          amber: "#f59e0b"
        },
        trace: {
          border: "#38bdf8",
          warn: "#f59e0b",
          good: "#22c55e"
        },
        onboarding: {
          cream: "#f7f0e4",
          ink: "#102925",
          forest: "#0f4d3e",
          muted: "#6f7d7a",
          orange: "#c86a1a",
          border: "#d8cdc0",
          greenSoft: "#dce9d9"
        }
      },
      boxShadow: {
        glow: "0 0 28px rgba(34, 211, 238, 0.24)",
        panel: "0 24px 80px rgba(0, 0, 0, 0.34)",
        onboarding: "0 24px 60px rgba(30, 44, 39, 0.14)"
      },
      backgroundImage: {
        "satellite-grid":
          "radial-gradient(circle at 20% 20%, rgba(34, 211, 238, 0.18), transparent 24%), radial-gradient(circle at 72% 38%, rgba(52, 211, 153, 0.16), transparent 22%), linear-gradient(135deg, rgba(15, 23, 42, 0.88), rgba(2, 6, 23, 0.96))"
      }
    }
  },
  plugins: []
};
