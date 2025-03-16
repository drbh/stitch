import React, { useState } from "react";

interface JsonViewerProps {
  data: any;
  title?: string;
  expandedByDefault?: boolean;
  maxHeight?: string;
  copyEnabled?: boolean;
}

const JsonViewer: React.FC<JsonViewerProps> = ({
  data,
  title = "JSON Data",
  expandedByDefault = false,
  maxHeight = "300px",
  copyEnabled = true,
}) => {
  const [expanded, setExpanded] = useState(expandedByDefault);
  const [copied, setCopied] = useState(false);

  // Format JSON with proper indentation
  const formattedJson = JSON.stringify(data, null, 2);

  // Handle copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(formattedJson).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-zinc-900 border border-border rounded-md mt-2 overflow-hidden">
      {/* Header */}
      <div
        className="flex justify-between items-center px-3 py-2 bg-surface-primary border-b border-border cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center">
          <svg
            className={`w-4 h-4 mr-2 text-gray-400 transition-transform ${
              expanded ? "transform rotate-90" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <h3 className="text-sm font-medium text-gray-300">{title}</h3>
        </div>

        {copyEnabled && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className={`text-xs px-2 py-1 rounded flex items-center transition-colors ${
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
        )}
      </div>

      {/* JSON Content */}
      {expanded && (
        <div className="p-3 overflow-auto bg-zinc-900" style={{ maxHeight }}>
          <pre className="text-xs font-mono text-gray-300 whitespace-pre">
            {formattedJson}
          </pre>
        </div>
      )}
    </div>
  );
};

export default JsonViewer;
