import React, { useState } from "react";

const ThreadShareURL = ({ shareUrl }) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Handle the copy to clipboard action
  const handleCopy = () => {
    if (!shareUrl) return;

    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => console.error("Failed to copy: ", err));
  };

  // Format URL to show a shorter version if it's too long
  const formatUrl = (url) => {
    if (!url) return "";

    // Only truncate when not expanded
    if (!expanded && url.length > 40) {
      const start = url.substring(0, 25);
      const end = url.substring(url.length - 15);
      return (
        <span onClick={() => setExpanded(true)} className="cursor-pointer">
          {start}
          <span className="text-gray-500">...</span>
          {end}
        </span>
      );
    }

    return url;
  };

  if (!shareUrl) return null;

  return (
    <div className="mt-4 mb-4">
      <div className="bg-surface-secondary rounded-md border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex justify-between items-center">
          <div className="flex items-center">
            <svg
              className="w-4 h-4 text-gray-400 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <h3 className="text-sm font-medium text-gray-300">Share URL</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className={`text-xs px-3 py-1 rounded flex items-center transition-colors ${
                copied
                  ? "bg-blue-700 text-white"
                  : "bg-surface-tertiary hover:bg-zinc-600 text-gray-300"
              }`}
            >
              <svg
                className="w-3 h-3 mr-1"
                fill="currentColor"
                viewBox="0 0 16 16"
              >
                <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z" />
                <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z" />
              </svg>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div className="p-3">
          <div
            className="font-mono text-sm text-gray-300 bg-zinc-900 p-2 rounded overflow-x-auto"
            onClick={() => setExpanded(!expanded)}
          >
            {formatUrl(shareUrl)}
          </div>
        </div>

        <div className="px-3 py-2 bg-surface-secondary border-t border-border flex justify-end">
          <div className="flex space-x-2">
            <button
              onClick={() => window.open(shareUrl, "_blank")}
              className="text-xs text-gray-400 flex items-center hover:text-blue-400 transition-colors"
            >
              <svg
                className="w-3 h-3 mr-1"
                fill="currentColor"
                viewBox="0 0 16 16"
              >
                <path
                  fillRule="evenodd"
                  d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"
                />
                <path
                  fillRule="evenodd"
                  d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"
                />
              </svg>
              Open Link
            </button>
            <button
              onClick={handleCopy}
              className="text-xs text-gray-400 flex items-center hover:text-blue-400 transition-colors ml-2"
            >
              <svg
                className="w-3 h-3 mr-1"
                fill="currentColor"
                viewBox="0 0 16 16"
              >
                <path d="M3.5 2.5a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-11zm1 .5v10h7v-10h-7z" />
                <path d="M8.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 4 1.5v1A1.5 1.5 0 0 0 5.5 4h3A1.5 1.5 0 0 0 10 2.5v-1A1.5 1.5 0 0 0 8.5 0h-3z" />
              </svg>
              {copied ? "Copied!" : "Copy Text"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreadShareURL;
