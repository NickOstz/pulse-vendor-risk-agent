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
      },
      fontFamily: {
        sans: [
          "Geist",
          "Satoshi",
          "Aptos",
          "Segoe UI",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "Geist Mono",
          "JetBrains Mono",
          "Cascadia Code",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        soft: "0 18px 42px -28px rgba(23, 23, 23, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
