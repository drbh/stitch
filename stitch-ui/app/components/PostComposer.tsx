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
      type="button"
      onClick={onToggle}
      className="text-xs flex items-center px-3 py-1 rounded bg-surface-tertiary text-gray-300 hover:bg-zinc-600 transition-colors"
      title={showPreview ? "Edit markdown (Alt+P)" : "Preview rendered markdown (Alt+P)"}
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

// Main PostComposer component
function PostComposer({ threadId, onPostSuccess, autoFocus = false }) {
  const fetcher = useFetcher();
  const [postContent, setPostContent] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showMarkdownHelper, setShowMarkdownHelper] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!postContent.trim() && !selectedImage) {
      setError("Please add text or an image to post");
      return;
    }

    setError("");
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("intent", "createPost");
      formData.append("content", postContent);
      formData.append("threadId", threadId || "");

      if (selectedImage) {
        formData.append("file", selectedImage);
      }

      fetcher.submit(formData, {
        method: "post",
        encType: "multipart/form-data",
      });
    } catch (err) {
      console.error("Error posting:", err);
      setError("Failed to post. Please try again.");
      setIsUploading(false);
    }
  };

  // Handle image selection
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be less than 5MB");
        return;
      }

      setSelectedImage(file);

      // Create a preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      setError("");
    }
  };

  // Remove selected image
  const handleRemoveImage = () => {
    setImagePreview(null);
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Auto-resize textarea
  const autoResizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(Math.max(textareaRef.current.scrollHeight, 80), 300) + "px";
    }
  };

  // Reset form after successful post
  useEffect(() => {
    if (fetcher.data && fetcher.data.success) {
      setPostContent("");
      setImagePreview(null);
      setSelectedImage(null);
      setShowPreview(false);
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (onPostSuccess) {
        onPostSuccess();
      }
    } else if (fetcher.data && !fetcher.data.success) {
      setError(fetcher.data.message || "Failed to post. Please try again.");
      setIsUploading(false);
    }
  }, [fetcher.data, onPostSuccess]);

  // Auto-resize textarea on content change
  useEffect(() => {
    autoResizeTextarea();
  }, [postContent]);

  // Focus the textarea when autoFocus is true
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Set uploading state based on fetcher state
  useEffect(() => {
    if (fetcher.state === "submitting") {
      setIsUploading(true);
    } else if (fetcher.state === "idle" && fetcher.data) {
      setIsUploading(false);
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <div className="space-y-2 bg-surface-primary p-4 rounded-lg border border-border">
      <h2 className="text-lg font-semibold text-white">Add to thread</h2>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Content Input or Preview */}
        {!showPreview ? (
          <textarea
            ref={textareaRef}
            placeholder="Write your reply using Markdown..."
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            className="w-full px-4 py-3 bg-surface-primary outline-none border border-border rounded-lg text-white placeholder-gray-500 resize-none focus:ring-0 focus:ring-blue-600 focus:border-blue-600 min-h-24"
            disabled={isUploading}
          />
        ) : (
          <div className="min-h-24 max-h-96 overflow-auto">
            <MarkdownPreview content={postContent} />
          </div>
        )}

        {/* Image preview */}
        {imagePreview && (
          <div className="relative w-full">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-h-60 rounded-lg object-contain bg-surface-secondary p-2"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 bg-surface-primary p-1 rounded-full hover:bg-surface-tertiary transition-colors"
              aria-label="Remove image"
              disabled={isUploading}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
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
        )}

        {/* Error message */}
        {error && <div className="text-red-400 text-sm px-2">{error}</div>}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Image upload button */}
            <div className="relative">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Upload image"
                disabled={isUploading}
              />
              <button
                type="button"
                className="p-2 bg-surface-tertiary hover:bg-zinc-600 border border-border rounded-lg transition-colors"
                title="Add image (Alt+I)"
                disabled={isUploading}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </button>
            </div>

            {/* Markdown Helper Toggle */}
            <button
              type="button"
              onClick={() => setShowMarkdownHelper(!showMarkdownHelper)}
              className="p-2 bg-surface-tertiary hover:bg-zinc-600 border border-border rounded-lg transition-colors"
              title="Markdown formatting help (Alt+H)"
              disabled={isUploading}
            >
              <svg
                className="w-4 h-4"
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
            </button>

            {/* Preview Toggle */}
            <PreviewToggle
              showPreview={showPreview}
              onToggle={() => setShowPreview(!showPreview)}
            />
          </div>

          <button
            type="submit"
            disabled={isUploading || (!postContent.trim() && !selectedImage)}
            className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-lg transition-colors ${
              isUploading || (!postContent.trim() && !selectedImage)
                ? "opacity-70 cursor-not-allowed"
                : ""
            }`}
          >
            {isUploading ? "Posting..." : "Post Reply (⌘+Enter)"}
          </button>
        </div>

        {/* Markdown Helper Panel */}
        {showMarkdownHelper && <MarkdownHelper />}
      </form>
    </div>
  );
}

export default PostComposer;
