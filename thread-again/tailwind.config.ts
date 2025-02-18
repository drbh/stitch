import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
          "Apple Color Emoji",
          "Segoe UI Emoji",
          "Segoe UI Symbol",
          "Noto Color Emoji",
        ],
      },
    },
    colors: {
      // Main background colors
      surface: {
        primary: "#121212", // Main background
        secondary: "#1E1E1E", // Sidebar, panels
        tertiary: "#2D2D2D", // Cards, input fields
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
    },
  },
  plugins: [],
} satisfies Config;
