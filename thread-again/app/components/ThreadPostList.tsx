import React, {
  Ref,
  Suspense,
  forwardRef,
  useState,
  useImperativeHandle,
  RefObject,
} from "react";
import { Await, useFetcher } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { marked } from "marked";
import JsonViewer from "./JsonViewer";
import ActivityChart from "./ActivityChart";
import PostComposer from "./PostComposer";
import DeveloperCard from "./DeveloperCard";

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

  // Parse the timestamp and format as relative time
  const getRelativeTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true });
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
    <li className="bg-surface-primary p-4 rounded-md border border-border">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center">
          <Tooltip content={`User: ${post.author}`}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium mr-3"
              style={{ backgroundColor: avatarColor }}
            >
              {initials}
            </div>
          </Tooltip>

          <div>
            <div className="text-white font-medium">{post.author}</div>
            <Tooltip content={fullDate}>
              <div className="text-gray-400 text-xs">{relativeTime}</div>
            </Tooltip>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {!isShareUrl && (
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
          )}
        </div>
      </div>

      <div className="space-y-3">
        {post.image && (
          <div className="mt-2 mb-3">
            <img
              src={`${
                thread.location === "local" ? "./local" : thread.location
              }/api/${post.image}`}
              alt="Post attachment"
              className="rounded-md max-h-60 object-cover"
              onError={(e) => {
                e.currentTarget.src =
                  "https://via.placeholder.com/300x200?text=Image+Not+Found";
              }}
            />
          </div>
        )}

        {/* Render post content as Markdown */}
        <div
          className="text-gray-300 markdown-content"
          dangerouslySetInnerHTML={renderMarkdown(post.text)}
        />

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
const ThreadPostList = forwardRef(
  (
    {
      thread,
      activeThreadPosts,
      isShareUrl,
    }: {
      thread: Thread;
      activeThreadPosts: Post[];
      isShareUrl: boolean;
    },
    ref
  ) => {
    const fetcher = useFetcher<{ success: boolean }>();
    const [showJson, setShowJson] = useState(false);
    const [showDevNote, setShowDevNote] = useState(false);
    const [showActivityChart, setShowActivityChart] = useState(true);

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

    useImperativeHandle(
      ref,
      () => {
        console.log("ThreadPostList ref created");
        return {
          toggleDevNote: () => {
            let past = showDevNote;
            setShowDevNote((prev) => !prev);
            return !past;
          },
          toggleActivityChart: () => {
            let past = showActivityChart;
            setShowActivityChart((prev) => !prev);
            return !past;
          },
          toggleShowJson: () => {
            let past = showJson;
            setShowJson((prev) => !prev);
            return !past;
          },
          states: {
            showJson,
            showDevNote,
            showActivityChart,
          },
        };
      },
      [showJson, showDevNote, showActivityChart]
    );

    return (
      <div className="space-y-6 mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-400">
              <Suspense fallback={<span>Loading...</span>}>
                <Await resolve={activeThreadPosts}>
                  {(posts) => (
                    <span>
                      {posts.length} {posts.length === 1 ? "post" : "posts"}
                    </span>
                  )}
                </Await>
              </Suspense>
            </div>
          </div>
        </div>

        {showDevNote && <DeveloperCard thread={thread} />}

        {/* Add Activity Chart (conditionally rendered) */}
        {showActivityChart && (
          <Suspense
            fallback={
              <div className="bg-zinc-900 rounded-md border border-border p-4 mb-6 animate-pulse">
                <div className="h-5 bg-zinc-800 rounded w-1/3 mb-4"></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="bg-zinc-800 rounded-md p-3 border border-border"
                    >
                      <div className="h-2 bg-surface-tertiary rounded w-1/2 mb-2"></div>
                      <div className="h-5 bg-surface-tertiary rounded w-1/3"></div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 mb-4">
                  {Array(35)
                    .fill(0)
                    .map((_, i) => (
                      <div
                        key={i}
                        className="w-3 h-3 bg-zinc-800 rounded-sm"
                      ></div>
                    ))}
                </div>
              </div>
            }
          >
            <Await resolve={activeThreadPosts}>
              {(posts) => (
                <ActivityChart
                  posts={posts}
                  weeksToShow={26}
                  colorTheme="blue"
                />
              )}
            </Await>
          </Suspense>
        )}

        <PostComposer
          threadId={thread.id}
          onPostSuccess={() => {
            console.log("Post success");
          }}
        />

        <div className="space-y-4">
          <Suspense fallback={<PostSkeletons />}>
            <h2 className="text-xl text-white">Posts</h2>
            <Await resolve={activeThreadPosts}>
              {(posts) =>
                posts.length > 0 ? (
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
                ) : (
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
                )
              }
            </Await>
          </Suspense>
        </div>
      </div>
    );
  }
);

export default ThreadPostList;
