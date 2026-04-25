import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d12",
        panel: "#12151c",
        panel2: "#181c25",
        line: "#252a36",
        text: "#e7eaf0",
        muted: "#8b93a7",
        accent: "#7c5cff",
        accent2: "#22d3ee",
        success: "#22c55e",
        danger: "#ef4444",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124,92,255,0.4), 0 8px 30px rgba(124,92,255,0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
