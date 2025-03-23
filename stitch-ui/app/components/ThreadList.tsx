import React, { useState, useEffect, useRef } from "react";
import { useFetcher, Await } from "react-router-dom";
import { Suspense } from "react";
import { formatDistanceToNow } from "date-fns";

// Types
interface Thread {
  id: string;
  title: string;
  last_activity: string;
  location?: string;
  author?: string;
  post_count?: number;
  pinned?: boolean;
  unread?: boolean;
  content?: string;
}

// Search component with highlight functionality
const ThreadSearch = ({ onSearch }) => {
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef(null);

  // Apply search when term changes
  useEffect(() => {
    onSearch(searchTerm);
  }, [searchTerm, onSearch]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        // Only handle Escape key for search input
        if (
          e.key === "Escape" &&
          isSearchVisible &&
          document.activeElement === searchInputRef.current
        ) {
          setIsSearchVisible(false);
          setSearchTerm("");
          e.preventDefault();
        }
        return;
      }

      // Ctrl+F or Cmd+F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setIsSearchVisible(true);
        setTimeout(() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
          }
        }, 100);
      }

      // Escape to close search
      if (e.key === "Escape" && isSearchVisible) {
        setIsSearchVisible(false);
        setSearchTerm("");
      }

      // '/' key to focus search
      if (e.key === "/" && !isSearchVisible) {
        e.preventDefault();
        setIsSearchVisible(true);
        setTimeout(() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
          }
        }, 100);
      }

      // Simple navigation with j/k keys without modifiers (Vim style)
      if (!isSearchVisible) {
        // j key to navigate down the list of threads
        if (e.key === "j" && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          // Implement logic to select next thread in the list visually
          // This would require maintaining a selected index state
          // For now, we'll leave this for future enhancement
        }

        // k key to navigate up the list of threads
        if (e.key === "k" && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          // Implement logic to select previous thread in the list visually
          // This would require maintaining a selected index state
          // For now, we'll leave this for future enhancement
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSearchVisible]);

  return (
    <div className="mb-3">
      {!isSearchVisible ? (
        <button
          onClick={() => setIsSearchVisible(true)}
          className="flex items-center text-sm text-gray-400 hover:text-white transition-colors"
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          Search threads (Ctrl+F)
        </button>
      ) : (
        <div className="bg-surface-secondary rounded-md border border-border flex items-center pr-2">
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search in threads..."
            className="flex-1 px-3 py-2 bg-surface-secondary border-none text-white focus:outline-none rounded-md"
            autoFocus
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-gray-400 hover:text-white p-1"
              title="Clear search"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M18 6L6 18M6 6l12 12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          <button
            onClick={() => {
              setIsSearchVisible(false);
              setSearchTerm("");
            }}
            className="text-gray-400 hover:text-white p-1 ml-1"
            title="Close search"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

// Thread actions menu component
const ThreadActions = ({ thread, onDelete, onPin, onHide }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (!e.target.closest(".thread-actions-menu")) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div
      className="relative thread-actions-menu"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="p-1 text-gray-400 hover:text-white rounded-full transition-colors"
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

      {isOpen && (
        <div className="absolute right-0 mt-1 bg-surface-secondary border border-border rounded-md py-1 w-40 z-10">
          <button
            className="flex items-center w-full px-4 py-2 text-sm text-left text-gray-300 hover:bg-surface-tertiary"
            onClick={() => {
              onPin(thread);
              setIsOpen(false);
            }}
          >
            <svg
              className="w-3.5 h-3.5 mr-2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
            {thread.pinned ? "Unpin thread" : "Pin thread"}
          </button>

          <button
            className="flex items-center w-full px-4 py-2 text-sm text-left text-gray-300 hover:bg-surface-tertiary"
            onClick={() => {
              onHide(thread);
              setIsOpen(false);
            }}
          >
            <svg
              className="w-3.5 h-3.5 mr-2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
              />
            </svg>
            Hide from list
          </button>

          <div className="border-t border-border my-1"></div>

          <button
            className="flex items-center w-full px-4 py-2 text-sm text-left text-red-400 hover:bg-surface-tertiary"
            onClick={() => {
              if (
                window.confirm("Are you sure you want to delete this thread?")
              ) {
                onDelete(thread);
              }
              setIsOpen(false);
            }}
          >
            <svg
              className="w-3.5 h-3.5 mr-2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete thread
          </button>
        </div>
      )}
    </div>
  );
};

// Thread list filter/sort component
const ThreadListControls = ({
  onSort,
  onFilter,
  sortBy,
  filterBy,
  searchResultCount,
  totalCount,
}) => {
  return (
    <div className="flex justify-between items-center mb-3">
      <div className="flex space-x-2">
        <select
          value={filterBy}
          onChange={(e) => onFilter(e.target.value)}
          className="bg-surface-secondary border border-border rounded-md text-sm text-gray-300 p-1 focus:outline-none focus:border-border"
        >
          <option value="all">All threads</option>
          <option value="pinned">Pinned</option>
          <option value="unread">Unread</option>
        </select>

        {searchResultCount !== null && (
          <div className="text-sm flex items-center text-gray-400">
            <span className="ml-2">
              {searchResultCount}
              {searchResultCount === 1 ? " match" : " matches"}
              {totalCount && ` of ${totalCount}`}
            </span>
          </div>
        )}
      </div>

      <div className="flex space-x-2">
        <select
          value={sortBy}
          onChange={(e) => onSort(e.target.value)}
          className="bg-surface-secondary border border-border rounded-md text-sm text-gray-300 p-1 focus:outline-none focus:border-border"
        >
          <option value="recent">Most recent</option>
          <option value="oldest">Oldest first</option>
          <option value="alphabetical">Alphabetical</option>
        </select>
      </div>
    </div>
  );
};

// Thread skeleton loader
const ThreadSkeleton = () => {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className="animate-pulse bg-surface-secondary p-4 rounded-md border border-border"
        >
          <div className="flex justify-between">
            <div className="h-4 bg-surface-tertiary rounded w-3/4 mb-2"></div>
            <div className="h-4 w-4 bg-surface-tertiary rounded-full"></div>
          </div>
          <div className="h-3 bg-surface-tertiary rounded w-1/2 mb-3"></div>
          <div className="flex justify-between items-center">
            <div className="h-2 bg-surface-tertiary rounded w-1/4"></div>
            <div className="h-2 bg-surface-tertiary rounded w-1/5"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Empty state component
const EmptyThreadList = ({ isSearching }) => {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      {isSearching ? (
        <>
          <svg
            className="w-12 h-12 text-gray-500 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <h3 className="text-lg font-medium text-white mb-1">
            No matches found
          </h3>
          <p className="text-gray-400 max-w-sm">
            Try adjusting your search terms or filters
          </p>
        </>
      ) : (
        <>
          <svg
            className="w-12 h-12 text-gray-500 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <h3 className="text-lg font-medium text-white mb-1">
            No threads yet
          </h3>
          <p className="text-gray-400 max-w-sm mb-4">
            Create your first thread to start organizing your content
          </p>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors">
            Create New Thread
          </button>
        </>
      )}
    </div>
  );
};

// Highlight component for search matches
const Highlight = ({ text, searchTerm }) => {
  if (!searchTerm || !text) return <>{text}</>;

  const parts = text.split(new RegExp(`(${searchTerm})`, "gi"));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === searchTerm.toLowerCase() ? (
          <span
            key={i}
            className="bg-yellow-300 text-black font-medium px-0.5 rounded"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

// Format relative time from timestamp
const customFormatRelativeTime = (timestamp: string) => {
  // TODO: improve to handle different timezones based on caller
  //
  // for now we force timezone to New York to align the front and back end
  const timeZone = "America/New_York";
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

// Main ThreadList component
function ThreadList({
  threads,
  setActiveThread,
  activeThread,
  createNewThread,
}: {
  threads: Promise<Thread[]>;
  activeThread: Thread | null;
  setActiveThread: (thread: Thread | null) => void;
  createNewThread?: () => void;
}) {
  const fetcher = useFetcher<{ success: boolean }>();
  const [sortBy, setSortBy] = useState("recent");
  const [filterBy, setFilterBy] = useState("all");
  const [hiddenThreads, setHiddenThreads] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResultCount, setSearchResultCount] = useState(null);

  // Handle thread deletion
  const handleThreadDelete = (thread) => {
    fetcher.submit(
      {
        intent: "deleteThread",
        threadId: thread.id,
        server: thread.location,
      },
      { method: "delete" }
    );
  };

  // Handle thread pinning/unpinning
  const handleThreadPin = (thread) => {
    // In a real implementation, this would submit to an API
    console.log(
      `${thread.pinned ? "Unpinning" : "Pinning"} thread:`,
      thread.id
    );
    // Simulating pin toggle for demo purposes
    thread.pinned = !thread.pinned;
  };

  // Handle thread hiding
  const handleThreadHide = (thread) => {
    const threadKey = `${thread.id}-${thread.location}`;
    setHiddenThreads((prev) => [...prev, threadKey]);
  };

  // Check if a thread matches the search term
  const threadMatchesSearch = (thread, term) => {
    if (!term) return true;

    const searchLower = term.toLowerCase();
    return (
      thread.title.toLowerCase().includes(searchLower) ||
      (thread.content && thread.content.toLowerCase().includes(searchLower)) ||
      (thread.author && thread.author.toLowerCase().includes(searchLower))
    );
  };

  // Reset active thread after successful deletion
  useEffect(() => {
    if (fetcher.data && fetcher.data.success) {
      setActiveThread(null);
    }
  }, [fetcher.data, setActiveThread]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="w-full">
          <div className="flex justify-between items-center">
            <h2 className="text-xl text-white">Threads</h2>

            {createNewThread && (
              <button
                onClick={createNewThread}
                // className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded border border-border transition-colors"
                className="flex justify-between bg-surface-primary w-16 text-content-primary px-1.5 py-0.5 text-sm rounded border border-border hover:bg-surface-secondary transition-colors"
                aria-label="New Thread"
              >
                <div className="mt-[2.5px]">
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
                    <path d="M12 5v14M5 12h14"></path>
                  </svg>
                </div>
                {/* <span>New Thread</span> */}
                <div className="text-xs bg-surface-tertiary text-content-tertiary px-1.5 py-0.5 rounded border border-border">
                  ^N
                </div>
              </button>
            )}
          </div>
          <div className="text-sm text-gray-400">
            <Suspense fallback={<span>Loading...</span>}>
              <Await resolve={threads}>
                {(resolvedThreads) => {
                  const visibleCount = resolvedThreads.filter((thread) => {
                    const threadKey = `${thread.id}-${thread.location}`;
                    return !hiddenThreads.includes(threadKey);
                  }).length;
                  return (
                    <span>
                      {visibleCount} thread{visibleCount !== 1 ? "s" : ""}
                    </span>
                  );
                }}
              </Await>
            </Suspense>
          </div>
        </div>
      </div>

      <Suspense fallback={<ThreadSkeleton />}>
        <Await resolve={threads}>
          {(resolvedThreads) => {
            // Add search component
            return (
              <>
                <ThreadSearch onSearch={setSearchTerm} />

                {(() => {
                  // Filter out hidden threads
                  let filteredThreads = resolvedThreads.filter((thread) => {
                    const threadKey = `${thread.id}-${thread.location}`;
                    return !hiddenThreads.includes(threadKey);
                  });

                  // Apply search filter
                  const searchedThreads = searchTerm
                    ? filteredThreads.filter((thread) =>
                        threadMatchesSearch(thread, searchTerm)
                      )
                    : filteredThreads;

                  // Update search count outside of render
                  React.useEffect(() => {
                    if (searchTerm) {
                      setSearchResultCount(searchedThreads.length);
                    } else {
                      setSearchResultCount(null);
                    }
                  }, [searchTerm, searchedThreads.length]);

                  // Continue with filtered threads
                  filteredThreads = searchedThreads;

                  // Apply additional filters
                  if (filterBy === "pinned") {
                    filteredThreads = filteredThreads.filter(
                      (thread) => thread.pinned
                    );
                  } else if (filterBy === "unread") {
                    filteredThreads = filteredThreads.filter(
                      (thread) => thread.unread
                    );
                  }

                  // Apply sorting
                  if (sortBy === "recent") {
                    filteredThreads.sort(
                      (a, b) =>
                        new Date(b.last_activity).getTime() -
                        new Date(a.last_activity).getTime()
                    );
                  } else if (sortBy === "oldest") {
                    filteredThreads.sort(
                      (a, b) =>
                        new Date(a.last_activity).getTime() -
                        new Date(b.last_activity).getTime()
                    );
                  } else if (sortBy === "alphabetical") {
                    filteredThreads.sort((a, b) =>
                      a.title.localeCompare(b.title)
                    );
                  }

                  // Group pinned threads at the top when not filtered or sorted alphabetically
                  if (filterBy !== "pinned" && sortBy !== "alphabetical") {
                    filteredThreads.sort((a, b) => {
                      if (a.pinned && !b.pinned) return -1;
                      if (!a.pinned && b.pinned) return 1;
                      return 0;
                    });
                  }

                  const totalVisibleCount = resolvedThreads.filter((thread) => {
                    const threadKey = `${thread.id}-${thread.location}`;
                    return !hiddenThreads.includes(threadKey);
                  }).length;

                  if (filteredThreads.length === 0) {
                    return <EmptyThreadList isSearching={!!searchTerm} />;
                  }

                  return (
                    <>
                      <ThreadListControls
                        onSort={setSortBy}
                        onFilter={setFilterBy}
                        sortBy={sortBy}
                        filterBy={filterBy}
                        searchResultCount={searchResultCount}
                        totalCount={searchTerm ? totalVisibleCount : null}
                      />

                      <ul className="space-y-2">
                        {filteredThreads.map((thread) => (
                          <li
                            key={thread.id + thread.location!}
                            onClick={() => setActiveThread(thread)}
                            className={`p-3 rounded-md outline-none border transition-colors ${
                              activeThread?.id === thread.id &&
                              activeThread?.location === thread.location
                                ? "bg-surface-secondary border-blue-600 text-white"
                                : "bg-surface-primary border-border text-gray-200 hover:bg-surface-secondary"
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center">
                                  {thread.pinned && (
                                    <svg
                                      className="w-3 h-3 text-blue-400 mr-1 flex-shrink-0"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path d="M9.41.6c.46-.9 1.73-.9 2.18 0l1.06 2.07 2.35.34c1 .14 1.4 1.34.67 2.03l-1.7 1.64.4 2.33c.17.97-.86 1.7-1.74 1.25L10 9.12l-2.11 1.14c-.88.45-1.91-.28-1.74-1.25l.4-2.33-1.7-1.64c-.73-.69-.33-1.89.67-2.03l2.35-.34L9.41.6z" />
                                    </svg>
                                  )}

                                  {thread.unread && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-1.5 flex-shrink-0"></div>
                                  )}

                                  <h3 className="font-medium truncate">
                                    <Highlight
                                      text={thread.title}
                                      searchTerm={searchTerm}
                                    />
                                  </h3>
                                </div>

                                <p className="text-sm text-gray-400 truncate mt-1">
                                  {customFormatRelativeTime(
                                    thread.last_activity
                                  )}
                                  {thread.author && (
                                    <>
                                      {" • "}
                                      <Highlight
                                        text={thread.author}
                                        searchTerm={searchTerm}
                                      />
                                    </>
                                  )}
                                  {thread.post_count &&
                                    ` • ${thread.post_count} post${
                                      thread.post_count !== 1 ? "s" : ""
                                    }`}
                                </p>

                                {searchTerm &&
                                  thread.content &&
                                  thread.content
                                    .toLowerCase()
                                    .includes(searchTerm.toLowerCase()) && (
                                    <div className="mt-2 text-sm text-gray-400 line-clamp-2">
                                      <Highlight
                                        text={getContextAroundMatch(
                                          thread.content,
                                          searchTerm
                                        )}
                                        searchTerm={searchTerm}
                                      />
                                    </div>
                                  )}
                              </div>

                              <ThreadActions
                                thread={thread}
                                onDelete={handleThreadDelete}
                                onPin={handleThreadPin}
                                onHide={handleThreadHide}
                              />
                            </div>

                            <div className="flex items-center justify-between mt-2">
                              {thread.location && (
                                <span className="text-xs text-gray-500 truncate">
                                  {thread.location}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  );
                })()}
              </>
            );
          }}
        </Await>
      </Suspense>
      <div className="w-full h-24"></div>
    </div>
  );
}

// Helper function to get content context around a search match
function getContextAroundMatch(text, searchTerm, contextLength = 50) {
  if (!text || !searchTerm) return text;

  const lowerText = text.toLowerCase();
  const lowerSearchTerm = searchTerm.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerSearchTerm);

  if (matchIndex === -1) return text.substring(0, 100) + "...";

  const startIndex = Math.max(0, matchIndex - contextLength);
  const endIndex = Math.min(
    text.length,
    matchIndex + searchTerm.length + contextLength
  );

  let excerpt = text.substring(startIndex, endIndex);

  // Add ellipsis if we're not showing from the beginning or end
  if (startIndex > 0) excerpt = "..." + excerpt;
  if (endIndex < text.length) excerpt = excerpt + "...";

  return excerpt;
}

export default ThreadList;
