import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/cloudflare";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";

import "./tailwind.css";
import "./styles/docs.css";
import "./styles/theme.css";

import { ThemeProvider, getInitialThemeState } from "~/components/ThemeContext";

// TODO: remove fonts we don't use
export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Ubuntu+Mono:wght@400;700&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inconsolata:wght@400;700&display=swap",
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  // Get the initial theme state and accent color from the cookie
  const { theme: initialTheme, accentColor: initialAccentColor } =
    getInitialThemeState(request);

  return {
    initialTheme,
    initialAccentColor,
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  // Use useLoaderData to get the initial theme
  let initialTheme: "dark" | "light" = "dark";
  let initialAccentColor: string = "#323232";
  try {
    // Try to get the theme data from the loader
    const data = useLoaderData<{
      initialTheme: "dark" | "light";
      initialAccentColor: string;
    }>();
    initialTheme = data.initialTheme;
    initialAccentColor = data.initialAccentColor;
  } catch (e) {
    // Default to dark theme if there's an error
    initialTheme = "dark";
  }

  return (
    <html
      lang="en"
      className={`${initialTheme}-theme bg-surface-primary text-content-primary`}
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {/* Inject initial CSS variables to prevent flicker */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
          :root {
            --accent-color: ${initialAccentColor};
            --accent-color-light: ${initialAccentColor}CC;
            --accent-color-dark: ${initialAccentColor}DD;
          }
        `,
          }}
        />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const { initialTheme, initialAccentColor } = useLoaderData<typeof loader>();

  return (
    <ThemeProvider
      initialTheme={initialTheme}
      initialAccentColor={initialAccentColor}
    >
      <Outlet />
    </ThemeProvider>
  );
}
