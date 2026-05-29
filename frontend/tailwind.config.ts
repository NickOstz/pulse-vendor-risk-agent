import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#171717",
          900: "#222222",
          800: "#333333",
        },
        signal: {
          50: "#f2f8f6",
          100: "#dcece7",
          500: "#2d806b",
          600: "#236956",
          700: "#1d5547",
        },
        caution: {
          50: "#fff8ed",
          100: "#ffedd3",
          500: "#c8791d",
          700: "#8a4f0d",
        },
        // Sekreativ design tokens (dark brand palette)
        sk: {
          page: "#060606",
          panel: "#0e0e0e",
          panel2: "#161616",
          panel3: "#1e1e1e",
          fg: "#f4f2ef",
          muted: "#9a9893",
          faint: "#6a6862",
          amber: "#F3AA3B",
          coral: "#DC8571",
          magenta: "#984084",
          violet: "#70239F",
          high: "#ff5a52",
          med: "#f2cd27",
          low: "#01c64a",
          ok: "#2fe07a",
          blue: "#6fb8ff",
        },
      },
      fontFamily: {
        sans: ["Mona Sans", "Geologica", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Mona Sans", "system-ui", "sans-serif"],
        mono: ["Space Mono", "Geist Mono", "ui-monospace", "monospace"],
        poster: ["Unbounded", "Space Grotesk", "sans-serif"],
      },
      boxShadow: {
        soft: "0 18px 42px -28px rgba(0, 0, 0, 0.7)",
      },
    },
  },
  plugins: [],
};

export default config;
