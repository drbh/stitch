import React, { useEffect, useState } from "react";
import type { Thread } from "~/clients/types";

interface KeyboardShortcutsProps {
  setActiveThread: (thread: Thread | null) => void;
  toggleCommandPalette: () => void;
  toggleSettings: () => void;
  toggleTheme: () => void;
  currentThreadIndex?: number | Promise<number>;
  threads?: Thread[] | Promise<Thread[]>;
  toggleNewThread?: () => void;
  createNewPost?: () => void;
  toggleSidebar: () => void;
}

export default function KeyboardShortcuts({
  setActiveThread,
  toggleCommandPalette,
  toggleSettings,
  toggleTheme,
  currentThreadIndex = -1,
  threads = [],
  toggleNewThread,
  createNewPost,
  toggleSidebar,
}: KeyboardShortcutsProps) {
  const [resolvedThreads, setResolvedThreads] = useState<Thread[]>([]);
  const [resolvedIndex, setResolvedIndex] = useState<number>(-1);

  // Resolve the threads and index if they're promises
  useEffect(() => {
    const resolveThreads = async () => {
      try {
        if (threads instanceof Promise) {
          const resolved = await threads;
          setResolvedThreads(resolved);
        } else {
          setResolvedThreads(threads);
        }

        if (currentThreadIndex instanceof Promise) {
          const resolvedIdx = await currentThreadIndex;
          setResolvedIndex(resolvedIdx >= 0 ? resolvedIdx : -1);
        } else {
          setResolvedIndex(currentThreadIndex >= 0 ? currentThreadIndex : -1);
        }
      } catch (error) {
        console.error("Error resolving threads or index:", error);
        setResolvedThreads([]);
        setResolvedIndex(-1);
      }
    };

    resolveThreads();
  }, [threads, currentThreadIndex]);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        // except for the command palette we'll close it
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          e.preventDefault();
          toggleCommandPalette();
          return;
        }

        // allow closing the new thread input
        if (e.metaKey || e.ctrlKey) {
          if (e.key === "n" && toggleNewThread) {
            toggleNewThread();
          }
        }

        // allow theme toggle
        if (e.metaKey || e.ctrlKey) {
          if (e.key === "t") {
            toggleTheme();
          }
        }

        // allow sidebar toggle
        if (e.metaKey || e.ctrlKey) {
          if (e.key === "b") {
            toggleSidebar();
          }
        }
        return;
      }

      // Command Palette (already implemented in root.tsx)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        console.log("Opening command palette with Cmd/Ctrl+K");
        e.preventDefault();
        toggleCommandPalette();
        return;
      }

      // Navigation shortcuts
      switch (e.key) {
        // Settings
        case ",":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            toggleSettings();
          }
          break;

        // Theme toggle
        case "t":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            toggleTheme();
          }
          break;

        // Sidebar toggle
        case "b":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            toggleSidebar();
          }
          break;

        // New thread
        case "n":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            if (toggleNewThread) {
              toggleNewThread();
            }
          }
          break;

        // New post in current thread
        case "p":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            if (createNewPost) {
              createNewPost();
            }
          }
          break;

        // Thread navigation - using resolvedThreads and resolvedIndex
        case "ArrowDown":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (
              resolvedThreads.length > 0 &&
              resolvedIndex < resolvedThreads.length - 1
            ) {
              console.log(
                "Moving to next thread with ArrowDown",
                resolvedIndex + 1
              );
              setActiveThread(resolvedThreads[resolvedIndex + 1]);
            }
          }
          break;

        case "ArrowUp":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (resolvedThreads.length > 0 && resolvedIndex > 0) {
              console.log(
                "Moving to previous thread with ArrowUp",
                resolvedIndex - 1
              );
              setActiveThread(resolvedThreads[resolvedIndex - 1]);
            }
          }
          break;

        case "j":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            if (
              resolvedThreads.length > 0 &&
              resolvedIndex < resolvedThreads.length - 1
            ) {
              console.log("Moving to next thread with j", resolvedIndex + 1);
              setActiveThread(resolvedThreads[resolvedIndex + 1]);
            }
          }
          break;

        case "k":
          if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
            e.preventDefault();
            if (resolvedThreads.length > 0 && resolvedIndex > 0) {
              console.log(
                "Moving to previous thread with k",
                resolvedIndex - 1
              );
              setActiveThread(resolvedThreads[resolvedIndex - 1]);
            }
          }
          break;

        // Close current thread (Escape already implemented in _index.tsx)
        case "Escape":
          // Don't need to handle here as it's already implemented
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    toggleCommandPalette,
    toggleSettings,
    toggleTheme,
    setActiveThread,
    resolvedIndex, // Use resolved values
    resolvedThreads, // Use resolved values
    toggleNewThread,
    createNewPost,
  ]);

  // This component doesn't render anything
  return null;
}
