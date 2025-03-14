import React, { useState, useEffect, Suspense, useRef } from "react";

function Topbar({
  openSettings,
  toggleOpenMenu,
}: {
  openSettings: () => void;
  toggleOpenMenu?: (setIsOpen: (isOpen: boolean) => void) => void;
}) {
  return (
    <header className="h-16 bg-surface-secondary border-b border-border shadow-lg flex justify-between items-center px-6">
      <div className="flex items-center gap-2">
        {toggleOpenMenu && (
          <button
            onClick={() => toggleOpenMenu((isOpen) => !isOpen)}
            className="lg:hidden mr-2 p-1 rounded hover:bg-gray-100 transition-colors"
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
          <svg
            width="50"
            height="50"
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
            className="mr-3"
          >
            <defs>
              <linearGradient
                id="threadGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
            <g
              fill="none"
              stroke="url(#threadGradient)"
              strokeWidth="16"
              strokeLinecap="round"
            >
              {/* Main thread line */}
              <path d="M50,30 C120,30 80,100 150,100" />
              <circle
                cx="50"
                cy="30"
                r="12"
                fill="url(#threadGradient)"
                stroke="none"
              />

              {/* essentially the above flipped */}
              <path d="M50,150 C100,220 120,100  150,100" />
              <circle
                cx="50"
                cy="150"
                r="12"
                fill="url(#threadGradient)"
                stroke="none"
              />
              <path d="M55,65 C90,65 90,5 150,100" />
              <circle
                cx="55"
                cy="65"
                r="12"
                fill="url(#threadGradient)"
                stroke="none"
              />
              <path d="M45,110 C80,60 60,160 150,100" />
              <circle
                cx="45"
                cy="110"
                r="12"
                fill="url(#threadGradient)"
                stroke="none"
              />

              {/* center node */}
              <circle
                cx="150"
                cy="100"
                r="20"
                fill="url(#threadGradient)"
                stroke="none"
              />
            </g>
          </svg>

          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-content-accent leading-none">
              Stitch
            </h1>
            <span className="text-xs text-gray-500 opacity-50">
              by stitch.sh
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            window.open(
              "https://github.com/drbh/thread",
              "_blank",
              "noopener,noreferrer"
            );
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-content-accent hover:bg-gray-100 rounded transition-colors"
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
