import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { useLoaderData } from "@remix-run/react";
import docsMarkdown from "~/docs_markdown/docs.md?raw";
import { marked } from "marked";
import { renderToString } from "react-dom/server";
import VennDiagram from "~/components/VennDiagram";
import DirectedGraph from "~/components/DirectedGraph";

function Topbar({
  openSettings,
  toggleOpenMenu,
}: {
  openSettings: () => void;
  toggleOpenMenu?: (setIsOpen: (isOpen: boolean) => void) => void;
}) {
  return (
    <header className="h-16 bg-surface-secondary border-b border-border  flex justify-between items-center px-6">
      <div className="flex items-center gap-2">
        {toggleOpenMenu && (
          <button
            onClick={() => toggleOpenMenu((isOpen) => !isOpen)}
            className="lg:hidden mr-2 p-1 rounded hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            {/* Simple menu icon SVG */}
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

              {/* <path d="M50,30 C120,30 80,100 150,100 S80,170 50,170" /> */}
              {/* <circle
                cx="50"
                cy="170"
                r="12"
                fill="url(#threadGradient)"
                stroke="none"
              /> */}
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

const NoteCard = ({ children }) => {
  return (
    <div className="bg-blue-50 py-4 my-4 rounded-r-md">
      <div className="flex items-center mb-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 mr-2 text-quote_alert-note"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <span className="font-semibold text-quote_alert-note">NOTE</span>
      </div>
      <div className="text-blue-800 ml-7">{children}</div>
    </div>
  );
};

export let loader = async () => {
  const renderer = new marked.Renderer();
  const originalParagraph = renderer.paragraph.bind(renderer);

  renderer.paragraph = (text) => {
    if (
      typeof text === "object" &&
      text.raw &&
      text.raw.indexOf("![NOTE]") === 0
    ) {
      // Extract the note content (remove the ![NOTE] prefix)
      const noteContent = text.raw.substring(7).trim();
      // Pre-render the NoteCard component to HTML
      const noteHtml = renderToString(<NoteCard>{noteContent}</NoteCard>);
      // Return the pre-rendered HTML with a marker for hydration
      return `<div class="note-card-container" data-content="${encodeURIComponent(
        noteContent
      )}">${noteHtml}</div>`;
    }

    if (
      typeof text === "object" &&
      text.raw &&
      text.raw.indexOf("![DIRECTED_GRAPH]") === 0
    ) {
      console.log("text.raw", text.raw);
      let graphData = text.raw.substring(17).trim();
      try {
        graphData = JSON.parse(graphData);
        console.log("graphData", graphData);
      } catch (error) {
        console.error("Error parsing graph data:", error);
        return originalParagraph(text);
      }

      return renderToString(<DirectedGraph data={graphData} />);
    }

    // Otherwise use the original paragraph renderer
    return originalParagraph(text);
  };

  // Process custom syntax for Venn diagrams in markdown
  const originalCode = renderer.html.bind(renderer);
  renderer.html = (html) => {
    if (html.raw.indexOf(`id="venn-diagram-placeholder"`) > -1) {
      if (html.raw.includes(`data-config`)) {
        const configMatch = html.raw.match(/data-config='(.*?)'/s); // 's' flag for multiline support

        if (configMatch && configMatch[1]) {
          try {
            const configJson = JSON.parse(
              configMatch[1].replace(/&quot;/g, '"')
            );
            const vennHtml = renderToString(
              <VennDiagram config={configJson} />
            );
            return vennHtml;
          } catch (error) {
            console.error("JSON Parsing Error:", error);
          }
        } else {
          console.error("No config found.");
        }
      }

      return originalCode(html);
    }

    return originalCode(html);
  };

  marked.setOptions({
    headerIds: true,
    gfm: true,
    renderer: renderer,
  });

  const html = marked(docsMarkdown);
  const tokens = marked.lexer(docsMarkdown);
  const headings = tokens
    .filter((token) => token.type === "heading")
    .map((heading) => ({
      text: heading.text,
      level: heading.depth,
      id: heading.text.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    }));

  return { html, headings };
};

export default function MarkdownDoc() {
  const { html, headings } = useLoaderData();

  return (
    <div className="min-h-screen bg-surface-primary text-content-primary">
      <Topbar openSettings={() => {}} />
      <div className="flex min-h-screen bg-surface-primary">
        {/* Sidebar TOC */}
        {/* <aside className="hidden lg:block w-toc flex-shrink-0 border-r border-border">
        <div className="sticky top-0 p-6 overflow-y-auto max-h-screen bg-surface-secondary">
          <h2 className="text-lg font-semibold mb-4 text-content-primary">
            Contents
          </h2>
          <nav className="space-y-1">
            {headings.map((heading) => (
              <a
                key={heading.id}
                href={`#${heading.id}`}
                className={`
                  block py-1.5 text-sm transition-colors duration-150 rounded
                  hover:bg-surface-tertiary hover:text-content-accent
                  ${
                    heading.level === 1
                      ? "font-semibold text-content-primary"
                      : "text-content-secondary"
                  }
                  ${heading.level > 1 ? `pl-${(heading.level - 1) * 4}` : ""}
                `}
              >
                {heading.text}
              </a>
            ))}
          </nav>
        </div>
      </aside> */}

        {/* Main content */}
        <main className="flex-1 min-h-screen">
          <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
            <header className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-content-primary">
                Getting Started
              </h1>
            </header>

            <article className="markdown-content bg-surface-secondary p-8 rounded-xl">
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </article>
          </div>
        </main>
      </div>
    </div>
  );
}
