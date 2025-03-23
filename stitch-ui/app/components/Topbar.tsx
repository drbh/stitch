import React, { useId } from "react";
import ThemeToggle from "./ThemeToggle";

const StitchSphere = ({
  primaryColor = "#6a9fb0",
  secondaryColor = "powderblue",
  highlightColor = "#ffffff",
  size = "w-6 h-6",
}) => {
  // Generate unique IDs for the gradient and filter to avoid conflicts when multiple spheres are used
  const gradientId = `sphereGradient-${useId()}`;
  const shadowId = `sphereShadow-${useId()}`;

  const getSecondaryColor = (primaryColor) => {
    // Parse the primary color
    const hex = primaryColor.replace("#", "");
    const num = parseInt(hex, 16);

    // Extract RGB components
    const red = num >> 16;
    const green = (num >> 8) & 255;
    const blue = num & 255;

    // Apply a transformation similar to the 2e7d32 -> 81c784 relationship
    // Red: ~2.8x, Green: ~1.6x, Blue: ~2.6x
    // We'll use slightly rounded values for cleaner math
    const newRed = Math.min(255, Math.round(red * 2.8));
    const newGreen = Math.min(255, Math.round(green * 1.6));
    const newBlue = Math.min(255, Math.round(blue * 2.6));

    // Convert components back to hex with proper padding
    const componentToHex = (c) => {
      const hex = c.toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };

    // Return the formatted hex color
    return `#${componentToHex(newRed)}${componentToHex(
      newGreen
    )}${componentToHex(newBlue)}`;
  };

  if (secondaryColor === "powderblue") {
    secondaryColor = getSecondaryColor(primaryColor);
  }

  return (
    <div className={`flex ${size} items-center justify-center`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 102 102"
        style={{ background: "transparent" }}
      >
        {/* Define the radial gradient with customizable colors */}
        <defs>
          <radialGradient id={gradientId} cx="25%" cy="20%" r="70%">
            <stop offset="0%" stopColor={highlightColor} />
            <stop offset="60%" stopColor={secondaryColor} />
            <stop offset="100%" stopColor={primaryColor} />
          </radialGradient>
        </defs>
        {/* Add a subtle shadow/glow filter */}
        <defs>
          <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur" />
            <feOffset in="blur" dx="1" dy="1" result="offsetBlur" />
            <feComposite in="SourceGraphic" in2="offsetBlur" operator="over" />
          </filter>
        </defs>
        {/* Circle with gradient fill and improved border */}
        <circle
          cx="51"
          cy="51"
          r="50"
          fill={`url(#${gradientId})`}
          filter={`url(#${shadowId})`}
          stroke="none"
        />
        {/* Subtle rim highlight */}
        <circle
          cx="51"
          cy="51"
          r="50"
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="0.5"
        />
      </svg>
    </div>
  );
};

function Topbar({
  accentColor,
  openSettings,
  toggleOpenMenu,
  openCommandPalette,
  createNewThread,
}: {
  accentColor: string;
  openSettings: () => void;
  toggleOpenMenu?: (setIsOpen: (isOpen: boolean) => void) => void;
  openCommandPalette?: () => void;
  createNewThread?: () => void;
}) {
  return (
    <header className="z-1000 h-16 bg-surface-primary border-b border-border flex justify-between items-center px-6">
      <div className="flex items-center gap-2">
        {toggleOpenMenu && (
          <button
            onClick={() => toggleOpenMenu((isOpen) => !isOpen)}
            className="mr-2 p-1 rounded hover:bg-interactive-hover transition-colors"
            aria-label="Toggle menu"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        )}

        <div className="flex items-center">
          <div className="flex items-center gap-2">
            <StitchSphere primaryColor={accentColor} />

            <span className="text-xl font-bold text-content-primary">
              Stitch
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {openCommandPalette && (
          <button
            onClick={openCommandPalette}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm bg-surface-secondary text-content-secondary hover:bg-interactive-hover rounded border border-border transition-colors"
            aria-label="Command Palette"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>Search...</span>
            <div className="ml-32 text-xs bg-surface-tertiary text-content-tertiary px-1.5 py-0.5 rounded border border-border">
              ⌘K
            </div>
          </button>
        )}

        <ThemeToggle />
        <button
          onClick={() => {
            window.open(
              "https://github.com/drbh/thread",
              "_blank",
              "noopener,noreferrer"
            );
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-content-accent hover:bg-interactive-hover rounded transition-colors"
          aria-label="GitHub"
        >
          <span>Star us on GitHub</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      </div>
    </header>
  );
}

export default Topbar;
