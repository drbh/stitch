import React from "react";

// Tab enum for ThreadTabBar
export enum ThreadTab {
  Posts = "posts",
  Webhooks = "webhooks",
  Documents = "documents",
  Access = "access",
}

export default function ThreadTabBar({
  currentTab,
  handleTabChange,
  counts,
  isShareUrl,
  handleShareUrlCreate
}: {
  currentTab: ThreadTab;
  handleTabChange: (tab: ThreadTab) => void;
  counts: { posts: number; settings: number; documents: number; access: number; };
  isShareUrl: boolean;
  handleShareUrlCreate: () => void;
}) {
  return (
    <div className="flex space-x-4 overflow-x-auto pb-4">
      <button
        onClick={() => handleTabChange(ThreadTab.Posts)}
        className={`${
          currentTab === "posts"
            ? "bg-surface-secondary border border-border text-content-primary"
            : "bg-surface-primary border border-border text-gray-200 hover:bg-surface-tertiary"
        } px-6 py-2 rounded-lg font-medium`}
      >
        Posts
        <span className="ml-2 text-xs text-content-secondary">
          ({counts.posts})
        </span>
      </button>
      <button
        onClick={() => handleTabChange(ThreadTab.Documents)}
        className={`${
          currentTab === "documents"
            ? "bg-surface-secondary border border-border text-content-primary"
            : "bg-surface-primary border border-border text-gray-200 hover:bg-surface-tertiary"
        } px-6 py-2 rounded-lg font-medium`}
      >
        Documents
        <span className="ml-2 text-xs text-content-secondary">
          ({counts.documents})
        </span>
      </button>
      <div></div>
      {/* TODO handle share better */}
      {!isShareUrl && (
        <>
          <button
            onClick={() => handleTabChange(ThreadTab.Webhooks)}
            className={`${
              currentTab === "webhooks"
                ? "bg-surface-secondary border border-border text-content-primary"
                : "bg-surface-primary border border-border text-gray-200 hover:bg-surface-tertiary"
            } px-6 py-2 rounded-lg font-medium`}
          >
            Webhooks
            <span className="ml-2 text-xs text-content-secondary">
              ({counts.settings})
            </span>
          </button>

          <button
            onClick={() => handleTabChange(ThreadTab.Access)}
            className={`${
              currentTab === "access"
                ? "bg-surface-secondary border border-border text-content-primary"
                : "bg-surface-primary border border-border text-gray-200 hover:bg-surface-tertiary"
            } px-6 py-2 rounded-lg font-medium`}
          >
            Access
            <span className="ml-2 text-xs text-content-secondary">
              ({counts.access})
            </span>
          </button>
          <button
            onClick={handleShareUrlCreate}
            className="bg-surface-primary border border-border max-h-10 overflow-truncate truncate text-content-accent px-6 py-2 rounded-lg font-medium"
          >
            Share URL
          </button>
        </>
      )}
    </div>
  );
}
