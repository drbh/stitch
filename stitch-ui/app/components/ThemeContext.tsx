import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { useFetcher } from "@remix-run/react";

type Theme = "dark" | "light";

type ThemeContextType = {
  theme: Theme;
  accentColor: string;
  toggleTheme: () => void;
  setAccentColor: (color: string) => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Get initial theme state from SSR data
export function getInitialThemeState(request: Request): { theme: Theme, accentColor: string } {
  // Get cookie from request
  const cookie = request.headers.get("Cookie");
  const themePreference = cookie
    ?.split(";")
    .find((c) => c.trim().startsWith("themePreference="));

  const accentColorPref = cookie
    ?.split(";")
    .find((c) => c.trim().startsWith("accentColor="));

  let theme: Theme = "dark"; // Default theme
  let accentColor: string = "#382c83"; // Default accent color

  if (themePreference) {
    try {
      // Parse theme from cookie value
      const themeCookie = themePreference.split("=")[1].trim();
      theme = themeCookie === "light" ? "light" : "dark";
    } catch (e) {
      console.error("Error parsing themePreference cookie:", e);
    }
  }

  if (accentColorPref) {
    try {
      // Parse accent color from cookie value
      accentColor = accentColorPref.split("=")[1].trim();
    } catch (e) {
      console.error("Error parsing accentColor cookie:", e);
    }
  }

  return { theme, accentColor };
}

export function ThemeProvider({
  children,
  initialTheme,
  initialAccentColor,
}: {
  children: ReactNode;
  initialTheme?: Theme;
  initialAccentColor?: string;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme || "dark");
  const [accentColor, setAccentColor] = useState<string>(initialAccentColor || "#382c83");
  const fetcher = useFetcher();

  // Effect to apply the theme to the document element - with requestAnimationFrame to prevent flickering
  useEffect(() => {
    if (typeof document !== 'undefined') {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove("light-theme", "dark-theme");
        document.documentElement.classList.add(`${theme}-theme`);
      });
    }
  }, [theme]);

  // Effect to apply the accent color as a CSS variable - with requestAnimationFrame to prevent flickering
  useEffect(() => {
    if (typeof document !== 'undefined') {
      requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--accent-color', accentColor);

        // Also set derived accent colors (lighter/darker variants)
        // This is a simple way to generate variants without color libraries
        const lighterAccent = accentColor + "CC"; // 80% opacity for a lighter variant
        const darkerAccent = accentColor + "DD";  // 87% opacity for a darker variant
        document.documentElement.style.setProperty('--accent-color-light', lighterAccent);
        document.documentElement.style.setProperty('--accent-color-dark', darkerAccent);
      });
    }
  }, [accentColor]);

  // Update cookies when theme or accent color changes
  const updateCookies = (newTheme?: Theme, newAccentColor?: string) => {
    // Only update cookie on client-side
    if (typeof document === "undefined") return;

    const updateData: Record<string, string> = {
      intent: "updateThemePreference",
    };

    if (newTheme) {
      updateData.theme = newTheme;
    }

    if (newAccentColor) {
      updateData.accentColor = newAccentColor;
    }

    fetcher.submit(updateData, { method: "post", action: "/?index" });
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    updateCookies(newTheme);
  };

  const handleSetAccentColor = (color: string) => {
    setAccentColor(color);
    updateCookies(undefined, color);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        accentColor,
        toggleTheme,
        setAccentColor: handleSetAccentColor,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
