import React, { useState, useEffect, useRef } from "react";
import { useFetcher } from "react-router-dom";
import { marked } from "marked";

// Utility to sanitize HTML from markdown rendering
const sanitizeHtml = (html) => {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/onclick/gi, "data-blocked")
    .replace(/onerror/gi, "data-blocked")
    .replace(/onload/gi, "data-blocked")
    .replace(/onmouseover/gi, "data-blocked");
};

// Configure marked for security and formatting
const configureMarked = () => {
  marked.setOptions({
    breaks: true,
    gfm: true,
    sanitize: false,
    smartLists: true,
    smartypants: true,
  });
};

// Initialize marked configuration
configureMarked();

// Preview toggle button component
const PreviewToggle = ({ showPreview, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className="text-xs flex items-center px-3 py-1 rounded bg-surface-tertiary text-gray-300 hover:bg-zinc-600 transition-colors"
      title={
        showPreview
          ? "Edit markdown (Alt+P)"
          : "Preview rendered markdown (Alt+P)"
      }
    >
      {showPreview ? (
        <>
          <svg
            className="w-3 h-3 mr-1"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Edit
        </>
      ) : (
        <>
          <svg
            className="w-3 h-3 mr-1"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Preview
        </>
      )}
    </button>
  );
};

// Markdown helper panel component
const MarkdownHelper = () => {
  return (
    <div className="bg-surface-primary border border-border rounded-md p-3 mt-2 text-xs">
      <div className="text-gray-300 mb-2">Markdown formatting:</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <code className="text-blue-400">**bold**</code>
          <span className="text-gray-400 mx-1">→</span>
          <strong className="text-gray-300">bold</strong>
        </div>
        <div>
          <code className="text-blue-400">*italic*</code>
          <span className="text-gray-400 mx-1">→</span>
          <em className="text-gray-300">italic</em>
        </div>
        <div>
          <code className="text-blue-400">[link](url)</code>
          <span className="text-gray-400 mx-1">→</span>
          <a href="#" className="text-blue-400 underline">
            link
          </a>
        </div>
        <div>
          <code className="text-blue-400">![alt](image-url)</code>
          <span className="text-gray-400 mx-1">→</span>
          <span className="text-gray-300">image</span>
        </div>
        <div>
          <code className="text-blue-400"># Heading</code>
        </div>
        <div>
          <code className="text-blue-400">- list item</code>
        </div>
        <div>
          <code className="text-blue-400">1. numbered</code>
        </div>
        <div>
          <code className="text-blue-400">`code`</code>
        </div>
      </div>
    </div>
  );
};

// Markdown preview component
const MarkdownPreview = ({ content }) => {
  const renderMarkdown = (text) => {
    try {
      const rawHtml = marked.parse(text || "");
      const sanitizedHtml = sanitizeHtml(rawHtml);
      return { __html: sanitizedHtml };
    } catch (e) {
      console.error("Error rendering markdown:", e);
      return { __html: text || "" };
    }
  };

  if (!content) {
    return (
      <div className="w-full px-4 py-4 bg-surface-secondary border border-border rounded-md text-gray-400 italic min-h-24">
        Preview will appear here...
      </div>
    );
  }

  return (
    <div
      className="w-full px-4 py-4 bg-surface-secondary border border-border rounded-md text-gray-300 markdown-content min-h-24 overflow-y-auto"
      dangerouslySetInnerHTML={renderMarkdown(content)}
    />
  );
};

// QuickStart notification card component
const QuickStartCard = ({ options, onSelectOption, onDismiss }) => {
  return (
    <div className="bg-surface-primary border border-border rounded-md mb-4 overflow-hidden">
      <div className="flex justify-between items-center px-4 py-3 bg-surface-secondary">
        <h2 className="text-lg text-white font-medium">
          Quick Start Templates
        </h2>
        <button
          onClick={onDismiss}
          className="text-gray-400 hover:text-white transition-colors"
          aria-label="Dismiss quick start card"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div className="p-4">
        <p className="text-gray-400 mb-4">
          Choose a template to get started quickly:
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => onSelectOption(option)}
              className="flex flex-col items-center justify-center p-4 bg-surface-secondary rounded-md hover:bg-surface-tertiary transition-colors"
              title={option.description}
            >
              <span className="text-2xl mb-2">{option.icon}</span>
              <span className="text-sm text-gray-300">{option.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Main ThreadComposer component
function ThreadComposer({
  servers,
  onSuccess,
}: {
  servers: string[];
  onSuccess?: () => void;
}) {
  const fetcher = useFetcher<{ success: boolean }>();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [location, setLocation] = useState(
    servers && servers.length > 0 ? servers[0] : ""
  );
  const [showPreview, setShowPreview] = useState(false);
  const [showMarkdownHelper, setShowMarkdownHelper] = useState(false);
  // Initialize state but don't render until we've checked localStorage
  const [showQuickStart, setShowQuickStart] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Check localStorage on component mount to determine if quick start should be shown
  useEffect(() => {
    // Only access localStorage after component is mounted to avoid SSR issues
    const quickStartDismissed = localStorage.getItem("quickStartDismissed");
    setShowQuickStart(quickStartDismissed !== "true");
    setIsInitialized(true);

    // Focus the title input when the component mounts (modal opens)
    setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus();
      }
    }, 100);
  }, []);

  const handleDismissQuickStart = () => {
    setShowQuickStart(false);
    localStorage.setItem("quickStartDismissed", "true");
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) return;
    fetcher.submit(
      {
        intent: "createThread",
        location,
        title,
        content,
      },
      { method: "post" }
    );
  };

  useEffect(() => {
    if (fetcher.data && fetcher.data.success) {
      // Clear form fields after successful submission
      setTitle("");
      setContent("");
      setShowPreview(false);

      // Call onSuccess callback if provided (to close modal)
      if (onSuccess) {
        onSuccess();
      }

      // Reload the page to show the new thread
      window.location.reload();
    }
  }, [fetcher.data, onSuccess]);

  // Quick start thread types with descriptions for hover
  const quickStartOptions = [
    {
      id: "note-taking",
      title: "Personal Note",
      description:
        "Create a private thread for your personal notes and thoughts",
      icon: "📝",
      defaultContent:
        "# My Personal Notes\n\nThings to remember:\n\n- Item one\n- Item two\n- Item three",
    },
    {
      id: "blog",
      title: "Blog Post",
      description: "Publish content instantly for your audience",
      icon: "✉️",
      defaultContent:
        "# My Blog Post\n\nToday I want to share my thoughts about...\n\n## First Point\n\nThis is an important consideration.\n\n## Second Point\n\nAnother key insight is...",
    },
    {
      id: "collaborative",
      title: "Collaboration",
      description: "Start a workspace for team collaboration",
      icon: "👥",
      defaultContent:
        "# Team Discussion\n\n## Agenda\n\n1. Review last week's progress\n2. Discuss current blockers\n3. Plan next steps\n\n## Notes\n\nPlease add your thoughts below:",
    },
    {
      id: "integration",
      title: "Integration",
      description: "Set up a webhook-driven or machine-to-machine thread",
      icon: "⚙️",
      defaultContent:
        '# API Integration\n\n```json\n{\n  "webhook": "https://example.com/webhook",\n  "events": ["create", "update", "delete"],\n  "format": "json"\n}\n```\n\nThis thread will receive automatic updates from external systems.',
    },
  ];

  const handleQuickStart = (option) => {
    setTitle(`${option.title} Thread`);
    setContent(option.defaultContent);
  };

  return (
    <div className="space-y-4">
      {/* Thread Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Server Selection */}
        <label className="block text-sm text-gray-400 mb-1">
          Select a server
        </label>
        <select
          name="server"
          className="w-full border border-border rounded-md p-2 bg-surface-secondary text-white focus:outline-none focus:border-blue-500"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        >
          {servers &&
            servers.map((server) => (
              <option key={server} value={server}>
                {server}
              </option>
            ))}
        </select>
        {/* Thread Title */}
        <input
          ref={titleInputRef}
          type="text"
          placeholder="Thread Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2 bg-surface-primary outline-none border border-border rounded-md text-white placeholder-gray-500 focus:ring-0 focus:ring-blue-600 focus:border-blue-600"
        />
        {/* Content Section with Markdown Support */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="block text-sm text-gray-400">
              Thread Content
            </label>
            <div className="flex space-x-2">
              {/* Markdown Help Toggle */}
              <button
                type="button"
                onClick={() => setShowMarkdownHelper(!showMarkdownHelper)}
                className="text-xs flex items-center px-2 py-1 rounded bg-surface-tertiary text-gray-300 hover:bg-zinc-600 transition-colors"
                title="Show markdown formatting help (Alt+H)"
              >
                <svg
                  className="w-3 h-3 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Help
              </button>
              {/* Preview Toggle */}
              <PreviewToggle
                showPreview={showPreview}
                onToggle={() => setShowPreview(!showPreview)}
              />
            </div>
          </div>
          {/* Markdown Helper Panel */}
          {showMarkdownHelper && <MarkdownHelper />}
          {/* Content Input or Preview */}
          {!showPreview ? (
            <textarea
              ref={contentTextareaRef}
              placeholder="Write your content here using Markdown..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-4 py-2 h-24 bg-surface-primary outline-none border border-border rounded-md text-white placeholder-gray-500 resize-none 0 focus:ring-blue-600 focus:border-blue-600 font-mono"
            />
          ) : (
            <div className="h-64">
              <MarkdownPreview content={content} />
            </div>
          )}
        </div>
        {/* Submit Button */}
        <button
          type="submit"
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-md transition-colors"
          disabled={!title.trim()}
          title="Post thread (⌘+Enter)"
        >
          Post Thread
        </button>
      </form>
    </div>
  );
}

export default ThreadComposer;
