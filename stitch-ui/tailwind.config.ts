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
        primary: "var(--surface-primary)",
        secondary: "var(--surface-secondary)",
        tertiary: "var(--surface-tertiary)",
      },
      // Text colors
      content: {
        primary: "var(--content-primary)",
        secondary: "var(--content-secondary)",
        tertiary: "var(--content-tertiary)",
        accent: "var(--content-accent)",
      },
      // Border colors
      border: {
        DEFAULT: "var(--border)",
        focus: "var(--border-focus)",
        interactive: "var(--border-interactive)",
        transparent: "transparent",
      },
      // Interactive element colors
      interactive: {
        DEFAULT: "var(--interactive)",
        hover: "var(--interactive-hover)",
        active: "var(--interactive-active)",
      },
      // Accent colors
      blue: {
        900: "#0c4a6e",
        800: "#075985",
        700: "var(--accent-color-dark)", // Darker variant of accent color
        600: "var(--accent-color)", // Primary accent color
        500: "var(--accent-color-light)", // Lighter variant of accent color
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
