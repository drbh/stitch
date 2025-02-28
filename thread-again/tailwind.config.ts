import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["Ubuntu Mono", "monospace"],
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
          "Apple Color Emoji",
          "Segoe UI Emoji",
          "Segoe UI Symbol",
          "Noto Color Emoji",
          "Inconsolata",
        ],
      },
      spacing: {
        toc: "16rem",
      },
    },
    colors: {
      // Main background colors
      surface: {
        primary: "#121212",
        secondary: "#1E1E1E",
        tertiary: "#2D2D2D",
      },
      // Text colors
      content: {
        primary: "#FFFFFF",
        secondary: "#A0A0A0",
        tertiary: "#707070",
        accent: "#D4D4D4",
      },
      // Border colors
      border: {
        DEFAULT: "#404040",
        focus: "#666666",
      },
      // Interactive element colors
      interactive: {
        DEFAULT: "#404040",
        hover: "#4A4A4A",
        active: "#505050",
      },
      // Docs
      quote_alert: {
        DEFAULT: "#FFD6A5",
        note: "#3b82f6",
        text: "#7F4912",
      },
    },
  },
  plugins: [],
} satisfies Config;
