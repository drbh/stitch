import React, { useState } from "react";

// Endpoint display component
const ApiEndpoint = ({ method, description, endpoint }) => {
  return (
    <div className="flex flex-col">
      <div className="flex items-center mb-1">
        {method.includes("GET") && (
          <span className="text-xs font-medium text-blue-500 mr-2">GET</span>
        )}
        {method.includes("POST") && (
          <span className="text-xs font-medium text-blue-400 mr-2">POST</span>
        )}
        <span className="text-xs text-gray-400">{description}</span>
      </div>
      <code className="text-sm text-gray-300 font-mono bg-surface-secondary p-2 rounded block overflow-x-auto">
        {endpoint}
      </code>
    </div>
  );
};

// Curl example component
const CurlExample = ({ title, command }) => {
  return (
    <div className="mt-3">
      <div className="flex items-center mb-1">
        <span className="text-xs text-gray-400">{title}</span>
      </div>
      <div className="bg-surface-secondary rounded p-2 font-mono text-sm overflow-x-auto">
        <code className="text-gray-300">{command}</code>
      </div>
    </div>
  );
};

// Detailed example component for the collapsible section
const DetailedExample = ({ title, code }) => {
  return (
    <div>
      <div className="text-xs text-gray-400 mb-1">{title}</div>
      <code
        className="text-xs text-gray-300 font-mono block"
        dangerouslySetInnerHTML={{ __html: code }}
      />
    </div>
  );
};

// Main developer API component
const DeveloperCard = ({ thread }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => console.error("Failed to copy: ", err));
  };

  const basePostCommand = `curl -X POST ${thread.location}/api/threads/${thread.id}/posts -d ''`;

  const exampleCode = {
    json: `curl -X GET ${thread.location}/api/threads/${thread.id}/posts -H "Accept: application/json"`,
    post: `curl -X POST ${thread.location}/api/threads/${thread.id}/posts \\<br />&nbsp;&nbsp;-H "Content-Type: application/json" \\<br />&nbsp;&nbsp;-d '{"content":"Hello from API"}'`,
    webhook: `curl -X POST ${thread.location}/api/threads/${thread.id}/webhook \\<br />&nbsp;&nbsp;-H "Authorization: Bearer $TOKEN" \\<br />&nbsp;&nbsp;-d '{"url":"https://example.com/callback"}'`,
  };

  return (
    <div className="mt-6 bg-zinc-900 rounded-md border border-border overflow-hidden">
      {/* Header section */}
      <div className="px-4 py-3 bg-surface-secondary border-b border-border flex justify-between items-center">
        <h3 className="text-white font-medium">Developer API</h3>
        <div className="flex items-center space-x-2">
          <button
            className={`text-xs ${
              copied
                ? "bg-blue-700 text-white"
                : "bg-surface-tertiary hover:bg-zinc-600 text-gray-300"
            } px-3 py-1 rounded flex items-center transition-colors`}
            onClick={() => handleCopy(basePostCommand)}
            title="Copy curl command to clipboard"
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
          <a
            href="/api-docs"
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded flex items-center"
          >
            <svg
              className="w-3 h-3 mr-1"
              fill="currentColor"
              viewBox="0 0 16 16"
            >
              <path d="M8.5 6.5a.5.5 0 0 0-1 0v3.793L6.354 9.146a.5.5 0 1 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L8.5 10.293V6.5z" />
              <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z" />
            </svg>
            API Docs
          </a>
        </div>
      </div>

      {/* Content section */}
      <div className="p-4 space-y-4">
        {/* Endpoints Section */}
        <div className="space-y-3">
          <ApiEndpoint
            method="GET POST"
            description="Latest Thread Data"
            endpoint={`${thread.location}/api/threads/latest/${thread.id}/10/100000`}
          />

          <ApiEndpoint
            method="GET POST"
            description="Thread Posts"
            endpoint={`${thread.location}/api/threads/${thread.id}/posts`}
          />
        </div>

        {/* Basic Curl Example */}
        <CurlExample title="Create Post Example" command={basePostCommand} />

        {/* Examples Dropdown */}
        <div className="bg-surface-secondary rounded p-3 mt-3">
          <details className="text-sm">
            <summary className="text-blue-400 cursor-pointer font-medium">
              More Examples
            </summary>
            <div className="mt-3 space-y-3 pl-2">
              <DetailedExample
                title="Fetch with JSON response"
                code={exampleCode.json}
              />

              <DetailedExample
                title="Create post with content"
                code={exampleCode.post}
              />

              <DetailedExample
                title="Webhook integration"
                code={exampleCode.webhook}
              />
            </div>
          </details>
        </div>
      </div>

      {/* Footer section */}
      <div className="p-3 bg-surface-secondary border-t border-border flex justify-end">
        <button
          className="text-xs text-gray-400 flex items-center hover:text-blue-400 transition-colors"
          onClick={() =>
            window.open(
              `${thread.location}/api/threads/${thread.id}/docs`,
              "_blank"
            )
          }
        >
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 16 16">
            <path d="M12.354 4.354a.5.5 0 0 0 0-.708l-2-2a.5.5 0 0 0-.708 0l-6 6a.5.5 0 0 0 0 .708l2 2a.5.5 0 0 0 .708 0l6-6zM2 10.5a.5.5 0 0 0 .5.5h1.134a.5.5 0 0 0 0-1H2.5a.5.5 0 0 0-.5.5zm3.5.5a.5.5 0 0 0 0-1H7a.5.5 0 0 0 0 1H5.5z" />
          </svg>
          View Full API Reference
        </button>
      </div>
    </div>
  );
};

export default DeveloperCard;
