import React from "react";
import type { Thread } from "~/clients/types";
import ThreadActionsMenu from "./ThreadActionsMenu";
import { formatDistanceToNow } from "date-fns";

// Define tab types for better type safety
type TabType = "posts" | "documents" | "webhooks" | "access" | "shareUrl";

// Define counts type
type CountsType = {
  posts: number;
  documents: number;
  webhooks: number;
  access: number;
};

  // Format relative time from timestamp
  const customFormatRelativeTimeUTC = (timestamp: string) => {
    // TODO: adjust timezones to align throughout the app
    // UTC timezone
    const timeZone = "UTC";
    const currentTimeWithOffset = new Date().toLocaleString("en-US", {
      timeZone,
    });
    const currentTime = new Date(currentTimeWithOffset);

    const diff = currentTime.getTime() - new Date(timestamp).getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? "s" : ""} ago`;
    }

    if (hours > 0) {
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    }

    if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    }

    return `${seconds} second${seconds > 1 ? "s" : ""} ago`;
  };


// Format timestamp for full date display in tooltip
const getFormattedDate = (timestamp: string) => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
  } catch (e) {
    return timestamp;
  }
};

// Parse the timestamp and format as relative time
const getRelativeTime = (timestamp: string) => {
  try {
    const date = new Date(timestamp);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (e) {
    return timestamp; // Fallback to original format if parsing fails
  }
};

// Tooltip Component
const Tooltip = ({
  content,
  children,
}: {
  content: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="relative group">
      <div className="absolute top-full mt-1 px-2 py-1 bg-surface-primary text-xs text-gray-300 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity whitespace-nowrap z-10 border border-border">
        {content}
      </div>
      {children}
    </div>
  );
};

const ThreadHeader = ({
  activeThread,
  isOpen,
  setIsOpen,
  currentTab,
  handleTabChange,
  counts,
  isShareUrl,
  handleShareUrlCreate,
  shareUrl,
}: {
  activeThread: Thread;
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  currentTab: TabType;
  handleTabChange: (tab: TabType) => void;
  counts: CountsType;
  isShareUrl: boolean;
  handleShareUrlCreate: () => void;
  shareUrl: string;
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {activeThread && activeThread.title ? (
          <>
            <div className="flex flex-col space-y-1">
              <h2 className="text-2xl font-bold text-content-accent">
                {activeThread.title}
              </h2>

              {shareUrl && shareUrl.length > 10 && (
                <Tooltip content={`${shareUrl}`}>
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    {shareUrl.substring(0, 20)} ..{" "}
                    {shareUrl.substring(shareUrl.length - 20)}
                  </a>
                </Tooltip>
              )}
            </div>
          </>
        ) : (
          <div className="animate-pulse space-y-4">
            <div className="bg-surface-primary mb-2 rounded-md min-w-64">
              <div className="h-4 bg-surface-tertiary rounded mb-2 w-full"></div>
              <div className="h-4 bg-surface-tertiary rounded mb-2 w-5/6"></div>
              <div className="h-4 bg-surface-tertiary rounded w-4/6"></div>
            </div>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <div className="px-3 py-1 border border-border rounded-lg text-xs text-content-accent">
            {shareUrl && shareUrl.length > 10
              ? "Public Link Created"
              : "Private"}
          </div>

          <div
            className="relative thread-actions-menu justify-end"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="text-gray-400 hover:text-white rounded-full transition-colors"
              onClick={() => setIsOpen(!isOpen)}
              title="Thread actions"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </button>

            {isOpen && <ThreadActionsMenu setIsOpen={setIsOpen} />}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-content-secondary">
          <Tooltip content={getFormattedDate(activeThread.last_activity)}>
            <div className="text-gray-400 text-xs">
              {customFormatRelativeTimeUTC(activeThread.last_activity)}
            </div>
          </Tooltip>
        </div>

        {/* Tab indicators */}
        <div className="flex space-x-6 pr-1">
          {/* Posts with counter */}
          <button
            className={`flex items-center space-x-1 transition-colors relative ${
              currentTab === "posts"
                ? "text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
            title="Posts"
            onClick={() => handleTabChange("posts")}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <span
              className={`text-xs font-medium ${
                currentTab === "posts" ? "text-white" : "text-gray-600"
              }`}
            >
              {counts.posts}
            </span>
            {currentTab === "posts" && (
              <div className="absolute h-0.5 w-full bg-white rounded bottom-0 left-0 -mb-1.5" />
            )}
          </button>

          {/* Documents with counter */}
          <button
            className={`flex items-center space-x-1 transition-colors relative ${
              currentTab === "documents"
                ? "text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
            title="Documents"
            onClick={() => handleTabChange("documents")}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            <span
              className={`text-xs font-medium ${
                currentTab === "documents" ? "text-white" : "text-gray-600"
              }`}
            >
              {counts.documents}
            </span>
            {currentTab === "documents" && (
              <div className="absolute h-0.5 w-full bg-white rounded bottom-0 left-0 -mb-1.5" />
            )}
          </button>

          {/* Webhooks */}
          <button
            className={`flex items-center space-x-1 transition-colors relative ${
              currentTab === "webhooks"
                ? "text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
            title="Webhooks"
            onClick={() => handleTabChange("webhooks")}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <span
              className={`text-xs font-medium ${
                currentTab === "webhooks" ? "text-white" : "text-gray-600"
              }`}
            >
              {counts.webhooks}
            </span>
            {currentTab === "webhooks" && (
              <div className="absolute h-0.5 w-full bg-white rounded bottom-0 left-0 -mb-1.5" />
            )}
          </button>

          {/* Access with counter */}
          <button
            className={`flex items-center space-x-1 transition-colors relative ${
              currentTab === "access"
                ? "text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
            title="Access"
            onClick={() => handleTabChange("access")}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span
              className={`text-xs font-medium ${
                currentTab === "access" ? "text-white" : "text-gray-600"
              }`}
            >
              {counts.access}
            </span>
            {currentTab === "access" && (
              <div className="absolute h-0.5 w-full bg-white rounded bottom-0 left-0 -mb-1.5" />
            )}
          </button>

          {/* Share URL */}
          <button
            className={`flex items-center space-x-1 transition-colors relative ${
              currentTab === "shareUrl"
                ? "text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
            title={isShareUrl ? "View Share URL" : "Create Share URL"}
            onClick={() => {
              if (!isShareUrl) {
                handleShareUrlCreate();
              }
            }}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            {currentTab === "shareUrl" && (
              <div className="absolute h-0.5 w-full bg-white rounded bottom-0 left-0 -mb-1.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThreadHeader;
