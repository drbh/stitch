import React, { Suspense, useState, useEffect, startTransition } from "react";
import { Await, useFetcher } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { marked } from "marked";
import JsonViewer from "./JsonViewer";
import PostComposer from "./PostComposer";
import DeveloperCard from "./DeveloperCard";
import { useThreadActions } from "./ThreadActionsContext";
import LeafletMap from "./LeafletMap";

// In-memory image cache to prevent reloading images when switching tabs
const imageCache = new Map<string, HTMLImageElement>();

// Function to cache images
const cacheImage = (src: string, img: HTMLImageElement): void => {
  if (!imageCache.has(src)) {
    // Store a cloned version of the image to maintain the cached reference
    const clonedImg = new Image();
    clonedImg.src = img.src;
    imageCache.set(src, clonedImg);
    console.log(`Cached image: ${src}`);
  }
};

// Function to get image URL and use cache if available
const getImageUrl = (post: any, thread: any): string => {
  const imgSrc =
    thread.location === "local"
      ? post.image.startsWith("uploads/")
        ? `./local/api/${post.image}`
        : `./local/api/uploads/${post.image.split("/").pop()}`
      : post.image.startsWith("uploads/")
      ? `${thread.location}/api/${post.image}`
      : `${thread.location}/api/uploads/${post.image.split("/").pop()}`;

  // Check if this image is already cached
  if (imageCache.has(imgSrc)) {
    console.log(`Using cached image: ${imgSrc}`);
  }

  return imgSrc;
};

// Function to preload images from posts
const preloadImages = (posts: any[], thread?: any): void => {
  if (!thread) return;

  // if no window object, return (for SSR) since the Image object is not available
  if (typeof window === "undefined") return;

  posts.forEach((post) => {
    if (post.image) {
      const imgSrc = getImageUrl(post, thread);

      // Skip if already cached
      if (imageCache.has(imgSrc)) return;

      // Preload the image
      const img = new Image();
      img.src = imgSrc;
      img.onload = () => cacheImage(imgSrc, img);
      img.onerror = () => console.warn(`Failed to preload image: ${imgSrc}`);
    }
  });
};

// Types
interface Post {
  id: number;
  author: string;
  time: string;
  text: string;
  image?: string;
  [key: string]: any; // Allow for additional properties
}

interface Thread {
  id: string;
  location: string;
}

// Configure marked options for security and formatting
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

// DOMPurify helper to sanitize HTML (to prevent XSS attacks)
const sanitizeHtml = (html: string): string => {
  // In a real app, you'd use DOMPurify:
  // return DOMPurify.sanitize(html);

  // Simple sanitization for demo purposes
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/onclick/gi, "data-blocked")
    .replace(/onerror/gi, "data-blocked")
    .replace(/onload/gi, "data-blocked")
    .replace(/onmouseover/gi, "data-blocked");
};

// Individual Post Component
const ThreadPost = ({
  post,
  thread,
  isShareUrl,
  onDelete,
  showJson,
}: {
  post: Post;
  thread: Thread;
  isShareUrl: boolean;
  onDelete: (e: React.MouseEvent, postId: number) => void;
  showJson: boolean;
}) => {
  const [jsonExpanded, setJsonExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(post.text);
  const fetcher = useFetcher();

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

  // Parse the timestamp and format as relative time
  const getRelativeTime = (timestamp: string) => {
    try {
      return customFormatRelativeTime(timestamp);
    } catch (e) {
      return timestamp; // Fallback to original format if parsing fails
    }
  };

  // Generate avatar from author name
  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.split(" ");
    if (parts.length === 1) return name.substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Generate consistent color based on author name
  const getAvatarColor = (name: string) => {
    if (!name) return "#888";

    // Simple hash function for the name
    const hash = Array.from(name).reduce(
      (acc, char) => char.charCodeAt(0) + acc,
      0
    );

    // List of colors for avatars (blues to purples)
    const colors = [
      "#3498db",
      "#5d32ba",
      "#3267ba",
      "#4e23d5",
      "#2185d0",
      "#4a58d5",
      "#6a5acd",
      "#9370db",
      "#7b53c1",
      "#6570ea",
    ];

    return colors[hash % colors.length];
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

  // Render markdown text to HTML
  const renderMarkdown = (text: string) => {
    try {
      const rawHtml = marked.parse(text);
      const sanitizedHtml = sanitizeHtml(rawHtml);
      return { __html: sanitizedHtml };
    } catch (e) {
      console.error("Error rendering markdown:", e);
      return { __html: text };
    }
  };

  const relativeTime = getRelativeTime(post.time);
  const fullDate = getFormattedDate(post.time);
  const avatarColor = getAvatarColor(post.author);
  const initials = getInitials(post.author);

  return (
    <li className="bg-surface-primary p-4 rounded-md border border-border overflow-hidden">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center flex-grow min-w-0 mr-2">
          <Tooltip content={`User: ${post.author}`}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium mr-3 flex-shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {initials}
            </div>
          </Tooltip>

          <div className="min-w-0 flex-grow overflow-hidden">
            <div className="text-white font-medium truncate">{post.author}</div>
            <Tooltip content={fullDate}>
              <div className="text-gray-400 text-xs">{relativeTime}</div>
            </Tooltip>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          {!isShareUrl && (
            <>
              <button
                className="text-gray-400 hover:text-gray-200 transition-colors"
                onClick={() => setIsEditing(true)}
                aria-label="Edit post"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                className="text-gray-400 hover:text-gray-200 transition-colors"
                onClick={(e) => onDelete(e, post.id)}
                aria-label="Delete post"
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
            </>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {post.image && (
          <div className="mt-2 mb-3">
            <img
              src={getImageUrl(post, thread)}
              alt="Post attachment"
              className="rounded-md max-h-60 object-cover"
              loading="eager"
              decoding="async"
              onClick={() => {
                // simply open the image in a new tab for now - its a great viewer no need to reinvent the wheel
                window.open(getImageUrl(post, thread));
              }}
              onLoad={(e) => {
                // Add to in-memory cache after load
                const img = e.currentTarget;
                if (img.complete && img.naturalHeight !== 0) {
                  cacheImage(img.src, img);
                }
              }}
              onError={(e) => {
                e.currentTarget.src =
                  "https://via.placeholder.com/300x200?text=Image+Not+Found";
              }}
            />
          </div>
        )}

        {isEditing ? (
          <div className="space-y-3">
            <textarea
              className="w-full bg-surface-primary outline-none border border-border rounded-md p-3 text-gray-300 focus:ring-0 focus:ring-blue-600 focus:border-blue-600"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={5}
              placeholder="Edit your post..."
            />
            <div className="flex space-x-2 justify-end">
              <button
                className="px-3 py-1 bg-surface-secondary hover:bg-gray-600 text-gray-300 rounded-md text-sm"
                onClick={() => {
                  setIsEditing(false);
                  setEditedText(post.text);
                }}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm"
                onClick={() => {
                  // Submit the update to the server
                  fetcher.submit(
                    {
                      intent: "updatePost",
                      postId: String(post.id),
                      content: editedText,
                    },
                    { method: "post" }
                  );
                  setIsEditing(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          /* Render post content as Markdown */
          <div
            className="text-gray-300 markdown-content"
            dangerouslySetInnerHTML={renderMarkdown(post.text)}
          />
        )}

        {post &&
          // extract <position={}> from post
          (post.text.match(/<position=*.+>/g) || []).map((match) => {
            const pos = match.slice(10, -1);
            console.log("match", pos);
            try {
              const position = JSON.parse(pos);
              return (
                <div key={match}>
                  <LeafletMap
                    center={position}
                    zoom={13}
                    style={{
                      height: "300px",
                      width: "300px",
                      zIndex: 0,
                    }}
                  />
                </div>
              );
            } catch (error) {
              return (
                <div key={match} className="text-red-500">
                  Invalid position data: {pos}
                </div>
              );
            }
          })}

        {/* JSON Viewer */}
        {showJson && (
          <JsonViewer
            data={post}
            title="Post JSON Data"
            expandedByDefault={false}
          />
        )}
      </div>
    </li>
  );
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
      {children}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 bg-surface-primary text-xs text-gray-300 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity whitespace-nowrap z-10 border border-border">
        {content}
      </div>
    </div>
  );
};

// Skeleton Loader for Posts
const PostSkeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="bg-surface-primary p-4 rounded-md border border-border">
      <div className="flex items-center mb-4">
        <div className="w-8 h-8 rounded-full bg-surface-tertiary mr-3"></div>
        <div className="space-y-2">
          <div className="h-3 w-24 bg-surface-tertiary rounded"></div>
          <div className="h-2 w-16 bg-surface-tertiary rounded"></div>
        </div>
      </div>
      <div className="h-4 bg-surface-tertiary rounded mb-2 w-full"></div>
      <div className="h-4 bg-surface-tertiary rounded mb-2 w-5/6"></div>
      <div className="h-4 bg-surface-tertiary rounded w-4/6"></div>
    </div>
  </div>
);

// Multiple post skeletons
const PostSkeletons = () => (
  <div className="space-y-4">
    <PostSkeleton />
    <PostSkeleton />
  </div>
);

// Main Thread Post List Component
const ThreadPostList = ({
  thread,
  activeThreadPosts,
  isShareUrl,
  showJson,
  focusNewPost,
}: {
  thread: Thread;
  activeThreadPosts: Promise<Post[]>;
  isShareUrl: boolean;
  showJson: boolean;
  focusNewPost?: boolean;
}) => {
  const fetcher = useFetcher<{ success: boolean }>();
  const { state } = useThreadActions();
  const { showDevNote } = state;

  const handlePostDelete = (e: React.MouseEvent, postId: number) => {
    e.preventDefault();
    if (window.confirm("Are you sure you want to delete this post?")) {
      fetcher.submit(
        {
          intent: "deletePost",
          postId,
        },
        { method: "delete" }
      );
    }
  };

  // Preload images when posts are loaded
  useEffect(() => {
    activeThreadPosts.then((posts) => {
      // Preload all post images to avoid reloading when switching tabs
      // Using startTransition to prevent hydration mismatch errors
      startTransition(() => {
        preloadImages(posts, thread);
      });
    });
  }, [activeThreadPosts, thread]);

  // Memoize components to avoid recreation on each render
  const postCountDisplay = React.useMemo(
    () => (
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-400">
            <Suspense fallback={<span>Loading...</span>}>
              <Await resolve={activeThreadPosts}>
                {(posts) => {
                  // Trigger image preloading when posts are first displayed in a startTransition
                  // to prevent hydration errors
                  startTransition(() => {
                    preloadImages(posts, thread);
                  });

                  return (
                    <span>
                      {posts.length} {posts.length === 1 ? "post" : "posts"}
                    </span>
                  );
                }}
              </Await>
            </Suspense>
          </div>
        </div>
      </div>
    ),
    [activeThreadPosts]
  );

  // Memoize developer card to prevent recreation
  const devNoteDisplay = React.useMemo(
    () => (showDevNote ? <DeveloperCard thread={thread} /> : null),
    [showDevNote, thread]
  );

  return (
    <div className="space-y-6 mt-4">
      {postCountDisplay}

      {!isShareUrl && (
        <PostComposer
          threadId={thread.id}
          onPostSuccess={() => {
            console.log("Post success");
          }}
          autoFocus={focusNewPost}
        />
      )}

      {/* Memoize the post list to prevent unnecessary re-renders */}
      {React.useMemo(
        () => (
          <div className="space-y-4">
            <Suspense fallback={<PostSkeletons />}>
              <h2 className="text-xl text-white">Posts</h2>
              <Await resolve={activeThreadPosts}>
                {(posts) => {
                  // Use a memoized post list component
                  // Preload images inside startTransition to prevent hydration errors
                  startTransition(() => {
                    preloadImages(posts, thread);
                  });

                  if (posts.length > 0) {
                    return (
                      <ul className="space-y-4">
                        {posts.map((post) => (
                          <ThreadPost
                            key={post.id}
                            post={post}
                            thread={thread}
                            isShareUrl={isShareUrl}
                            onDelete={handlePostDelete}
                            showJson={showJson}
                          />
                        ))}
                      </ul>
                    );
                  } else {
                    return (
                      <div className="text-center py-8 text-gray-400">
                        <svg
                          className="w-12 h-12 mx-auto mb-3 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                          />
                        </svg>
                        <p>No posts yet</p>
                        <p className="text-sm mt-1">
                          Be the first to start the conversation
                        </p>
                      </div>
                    );
                  }
                }}
              </Await>
            </Suspense>
          </div>
        ),
        [activeThreadPosts, thread, isShareUrl, showJson, handlePostDelete]
      )}
    </div>
  );
};

export default ThreadPostList;
