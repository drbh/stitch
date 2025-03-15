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
        interactive: "#404040",
        transparent: "transparent",
      },
      // Interactive element colors
      interactive: {
        DEFAULT: "#404040",
        hover: "#4A4A4A",
        active: "#505050",
      },
      // TODO: remove these colors. only used for debugging
      blue: {
        900: "#0c4a6e",
        800: "#075985",
        // 700: "#0369a1",
        // 600: "#0284c7",

        //  TESTs
        // 600: "#03283c",

        700: "#48299d",
        600: "#382c83",
        500: "#19143c",
      },
      green: {
        900: "#065f46",
        800: "#047857",
        700: "#059669",
        600: "#10b981",
      },
      purple: {
        900: "#4c1d95",
        800: "#5b21b6",
        700: "#6d28d9",
        600: "#7c3aed",
      },
      zinc: {
        900: "#18181b",
        700: "#FF0000",
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
