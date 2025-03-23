import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "@remix-run/react";
import type { Thread } from "~/clients/types";

type Command = {
  id: string;
  name: string;
  description: string;
  shortcut?: string;
  icon?: React.ReactNode;
  action: () => void;
  category: "navigation" | "thread" | "view" | "settings" | "system";
};

type CommandPaletteProps = {
  isOpen: boolean;
  onClose: () => void;
  setActiveThread: (thread: Thread | null) => void;
  threads: Promise<Thread[]>;
  openSettings: () => void;
  toggleTheme: () => void;
  currentTheme: "dark" | "light";
  createNewThread?: () => void;
  createNewPost?: () => void;
};

// Define the types for our info card data
type InfoStep = {
  id: string;
  title: string;
  description: string | React.ReactNode;
  icon?: React.ReactNode;
  tips?: { label: string; shortcut?: string }[];
  customContent?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
};

type InfoCardType = "onboarding" | "alert" | "notification";

type InfoCardProps = {
  dismissInfoCard: () => void;
  type?: InfoCardType;
  steps?: InfoStep[];
  currentStepId?: string;
  persistKey?: string; // Optional key to save progress in localStorage
  onStepChange: (step: InfoStep) => void;
  onComplete?: () => void;
};

const DEFAULT_ONBOARDING_STEPS: InfoStep[] = [
  {
    id: "welcome",
    title: "Welcome to Stitch!",
    description: (
      <div className="space-y-2">
        <br />
        <span className="font-semibold">Stitch</span> is a powerful and simple
        tool for creating and managing threads.
        <br />
        <br />
        <span className="font-semibold">Let's get started!</span>
        <p>
          The command palette gives you quick access to all app features. Let's
          walk through the basics. In a couple short steps, you'll be a pro!
        </p>
        <br />
        <span className="font-semibold">3 things to always remember:</span>
        <ul className="list-disc list-inside">
          <li>Command Palette contains all app features</li>
          <li>Use the search bar to find what you need</li>
          <li>Be a good person</li>
        </ul>
        <br />
      </div>
    ),
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    ),
    tips: [{ label: "Open/Close the command palette", shortcut: "⌘K" }],
  },
  {
    id: "welcome-2",
    title: "Welcome to Command Palette!",
    description:
      "The command palette gives you quick access to all app features. Let's walk through the basics.",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    ),
    tips: [
      { label: "navigate", shortcut: "↑↓" },
      { label: "select", shortcut: "Enter" },
      { label: "dismiss", shortcut: "Esc" },
    ],
  },
  {
    id: "navigation",
    title: "Quick Navigation",
    description:
      "Use the command palette to navigate between different sections of the app instantly.",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
      </svg>
    ),
    tips: [
      { label: "Home", shortcut: "G H" },
      { label: "Docs", shortcut: "G D" },
    ],
  },
  {
    id: "search",
    title: "Powerful Search (*coming soon)",
    description:
      "Simply start typing to search for commands, threads, or any app feature. (one day)",
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    ),
    tips: [
      { label: "type to search" },
      { label: "search threads", shortcut: "/" },
    ],
  },
];

const DEFAULT_ALERT = {
  id: "alert",
  title: "Important Alert",
  description:
    "This is an important notification that requires your attention.",
  icon: (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-amber-500"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  ),
  action: {
    label: "Acknowledge",
    onClick: () => {},
  },
};

const InfoCard = ({
  dismissInfoCard,
  type = "onboarding",
  steps = DEFAULT_ONBOARDING_STEPS,
  currentStepId,
  persistKey = "infoCardProgress",
  onStepChange,
  onComplete,
}: InfoCardProps) => {
  // For a single alert, we convert it to a single step wizard
  const allSteps =
    type === "alert" && steps.length === 0 ? [DEFAULT_ALERT] : steps;

  // Get the initial step index from localStorage or props
  const getInitialStepIndex = () => {
    if (currentStepId) {
      const index = allSteps.findIndex((step) => step.id === currentStepId);
      return index >= 0 ? index : 0;
    }

    if (persistKey) {
      const savedProgress = localStorage.getItem(persistKey);
      if (savedProgress) {
        const parsed = JSON.parse(savedProgress);
        const index = allSteps.findIndex(
          (step) => step.id === parsed.currentStepId
        );
        return index >= 0 ? index : 0;
      }
    }

    return 0;
  };

  const [currentStepIndex, setCurrentStepIndex] = useState(
    getInitialStepIndex()
  );
  const currentStep = allSteps[currentStepIndex];
  const totalSteps = allSteps.length;
  const isMultiStep = totalSteps > 1;

  // Save progress to localStorage when current step changes
  useEffect(() => {
    if (persistKey && currentStep) {
      localStorage.setItem(
        persistKey,
        JSON.stringify({
          currentStepId: currentStep.id,
          completedStepIds: allSteps
            .slice(0, currentStepIndex)
            .map((step) => step.id),
        })
      );
    }
  }, [currentStepIndex, currentStep, persistKey, allSteps]);

  // Call onStepChange callback when current step changes
  useEffect(() => {
    if (onStepChange) {
      onStepChange(currentStep);
    }
  }, [currentStep, onStepChange]);

  const goToNextStep = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      // Last step completed
      if (onComplete) {
        onComplete();
      }
      dismissInfoCard();
    }
  };

  const goToPrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleAction = () => {
    if (currentStep.action && currentStep.action.onClick) {
      currentStep.action.onClick();
    }

    if (isMultiStep) {
      goToNextStep();
    } else {
      dismissInfoCard();
    }
  };

  // Get the icon color based on card type
  const getIconColorClass = () => {
    switch (type) {
      case "alert":
        return "text-amber-500";
      case "notification":
        return "text-purple-500";
      default:
        return "text-blue-500";
    }
  };

  // Get the border color based on card type
  const getBorderColorClass = () => {
    switch (type) {
      case "alert":
        return "border-amber-200";
      case "notification":
        return "border-purple-200";
      default:
        return "border-border";
    }
  };

  return (
    <div
      className={`w-full max-w-xl bg-surface-secondary border ${getBorderColorClass()} shadow-lg rounded-lg overflow-hidden`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-4 flex items-start">
        {/* Icon */}
        {currentStep.icon && (
          <div className={`flex-shrink-0 mr-4 mt-1 ${getIconColorClass()}`}>
            {currentStep.icon}
          </div>
        )}

        <div className="flex-grow">
          {/* Header */}
          <div className="flex justify-between items-start">
            <h3 className="text-lg font-medium text-content-primary">
              {currentStep.title}
            </h3>
            <button
              onClick={dismissInfoCard}
              className="text-content-tertiary hover:text-content-primary ml-2 p-1"
              aria-label="Close"
            >
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
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Description */}
          <div className="text-content-secondary mt-1">
            {currentStep.description}
          </div>

          {/* Custom content */}
          {currentStep.customContent && (
            <div className="mt-3">{currentStep.customContent}</div>
          )}

          {/* Tips */}
          {currentStep.tips && currentStep.tips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {currentStep.tips.map((tip, index) => (
                <div
                  key={index}
                  className="flex items-center text-xs text-content-secondary bg-surface-tertiary px-2 py-1 rounded-md"
                >
                  {tip.shortcut && (
                    <span className="font-semibold mr-1">{tip.shortcut}</span>
                  )}
                  {tip.label}
                </div>
              ))}
            </div>
          )}

          {/* Navigation and Actions */}
          <div className="mt-4 flex justify-between items-center">
            {/* Step indicator */}
            {isMultiStep && (
              <div className="flex items-center space-x-1">
                {allSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 w-1.5 rounded-full ${
                      index === currentStepIndex
                        ? "bg-blue-500"
                        : index < currentStepIndex
                        ? "bg-blue-300"
                        : "bg-gray-300"
                    }`}
                  ></div>
                ))}
                <span className="ml-2 text-xs text-content-tertiary">
                  {currentStepIndex + 1} of {totalSteps}
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-2 ml-auto">
              {isMultiStep && currentStepIndex > 0 && (
                <button
                  onClick={goToPrevStep}
                  className="px-3 py-1.5 text-sm text-content-secondary border border-border rounded-md hover:bg-surface-tertiary"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleAction}
                className="px-3 py-1.5 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600"
              >
                {currentStep.action?.label ||
                  (currentStepIndex === totalSteps - 1 ? "Finish" : "Next")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function CommandPalette({
  isOpen,
  onClose,
  setActiveThread,
  threads,
  openSettings,
  toggleTheme,
  currentTheme,
  createNewThread,
  createNewPost,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [allThreads, setAllThreads] = useState<Thread[]>([]);
  const [allCommands, setAllCommands] = useState<Command[]>([]);
  const [showInfoCard, setShowInfoCard] = useState(true);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const commandRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const commandListRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Check if this is the first time using the app
  useEffect(() => {
    const hasSeenInfoCard = localStorage.getItem("hasSeenCommandPaletteInfo");
    setShowInfoCard(hasSeenInfoCard !== "true");
  }, []);

  // Dismiss the info card and remember the choice
  const dismissInfoCard = () => {
    setShowInfoCard(false);
    localStorage.setItem("hasSeenCommandPaletteInfo", "true");
  };

  // if hasSeenCommandPaletteInfo is true thatn set showCommandPalette to true
  useEffect(() => {
    if (!showInfoCard) {
      setShowCommandPalette(true);
    }
  }, [showInfoCard]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      // Focus the input when the palette opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Load threads
  useEffect(() => {
    const loadThreads = async () => {
      try {
        const loadedThreads = await threads;
        setAllThreads(loadedThreads);
      } catch (error) {
        console.error("Failed to load threads:", error);
      }
    };
    loadThreads();
  }, [threads]);

  // Define base commands
  useEffect(() => {
    const baseCommands: Command[] = [
      {
        id: "home",
        name: "Go to Home",
        description: "Navigate to the home page",
        shortcut: "G H",
        icon: (
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
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        ),
        action: () => {
          navigate("/");
          onClose();
        },
        category: "navigation",
      },
      {
        id: "docs",
        name: "Go to Documentation",
        description: "Open the documentation page",
        shortcut: "G D",
        icon: (
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
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        ),
        action: () => {
          navigate("/docs");
          onClose();
        },
        category: "navigation",
      },
      {
        id: "settings",
        name: "Open Settings",
        description: "Open the settings panel",
        shortcut: "⌘,",
        icon: (
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
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        ),
        action: () => {
          openSettings();
          onClose();
        },
        category: "settings",
      },
      {
        id: "theme-toggle",
        name: `Switch to ${currentTheme === "dark" ? "Light" : "Dark"} Theme`,
        description: `Toggle between dark and light theme`,
        shortcut: "⌘T",
        icon:
          currentTheme === "dark" ? (
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
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          ) : (
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
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          ),
        action: () => {
          toggleTheme();
          onClose();
        },
        category: "settings",
      },
      {
        id: "close-thread",
        name: "Close Current Thread",
        description: "Close the currently active thread",
        shortcut: "Esc",
        icon: (
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
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ),
        action: () => {
          setActiveThread(null);
          onClose();
        },
        category: "thread",
      },
      {
        id: "search-threads",
        name: "Search Threads",
        description: "Search through all threads",
        shortcut: "/",
        icon: (
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
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        ),
        action: () => {
          // This will rely on the global keyboard shortcut for searching
          onClose();
          // Simulate the / keypress after a short delay
          setTimeout(() => {
            const event = new KeyboardEvent("keydown", { key: "/" });
            document.dispatchEvent(event);
          }, 100);
        },
        category: "thread",
      },
      {
        id: "new-thread",
        name: "New Thread",
        description: "Create a new thread",
        shortcut: "⌘N",
        icon: (
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
        ),
        action: () => {
          console.log("Creating new thread");
          if (createNewThread) {
            createNewThread();
          }
          onClose();
        },
        category: "thread",
      },
      {
        id: "new-post",
        name: "New Post",
        description: "Add a post to the current thread",
        shortcut: "⌘P",
        icon: (
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
            <path d="M12 8v8M8 12h8"></path>
            <rect x="3" y="3" width="18" height="18" rx="2"></rect>
          </svg>
        ),
        action: () => {
          if (createNewPost) {
            createNewPost();
          }
          onClose();
        },
        category: "thread",
      },
      {
        id: "new-document",
        name: "New Document",
        description: "Add a document to the current thread",
        shortcut: "⌘D",
        icon: (
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
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="9" y1="15" x2="15" y2="15"></line>
            <line x1="12" y1="12" x2="12" y2="18"></line>
          </svg>
        ),
        action: () => {
          console.log("Creating new document");
          onClose();
        },
        category: "thread",
      },
      {
        id: "new-webhook",
        name: "New Webhook",
        description: "Add a webhook to the current thread",
        shortcut: "⌘W",
        icon: (
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
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
        ),
        action: () => {
          console.log("Creating new webhook");
          onClose();
        },
        category: "thread",
      },
      {
        id: "new-thread-api-key",
        name: "New Thread API Key",
        description: "Generate a new API key for the current thread",
        shortcut: "⌘K",
        icon: (
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
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
          </svg>
        ),
        action: () => {
          console.log("Creating new API key");
          onClose();
        },
        category: "thread",
      },
      {
        id: "next-thread",
        name: "Next Thread",
        description: "Navigate to next thread in list",
        shortcut: "⌘↓",
        icon: (
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
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        ),
        action: () => {
          // This relies on the KeyboardShortcuts component
          onClose();
        },
        category: "navigation",
      },
      {
        id: "prev-thread",
        name: "Previous Thread",
        description: "Navigate to previous thread in list",
        shortcut: "⌘↑",
        icon: (
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
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        ),
        action: () => {
          // This relies on the KeyboardShortcuts component
          onClose();
        },
        category: "navigation",
      },
    ];

    // Add thread-specific commands
    const threadCommands = allThreads.map((thread) => ({
      id: `thread-${thread.id}-${thread.location}`,
      name: `Open Thread: ${thread.title || `Thread #${thread.id}`}`,
      description: thread.description || `Navigate to thread #${thread.id}`,
      icon: (
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
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      ),
      action: () => {
        setActiveThread(thread);
        onClose();
      },
      category: "thread",
    }));

    setAllCommands([...baseCommands, ...threadCommands]);
  }, [
    setActiveThread,
    openSettings,
    toggleTheme,
    currentTheme,
    allThreads,
    navigate,
    onClose,
    createNewThread,
    createNewPost,
  ]);

  // Filter commands based on search query
  useEffect(() => {
    // If no query, show all commands
    if (!query) {
      setFilteredCommands(allCommands);
      return;
    }

    // Simple fuzzy search: break query into characters and check if they appear in sequence
    const fuzzyMatch = (str: string, pattern: string) => {
      pattern = pattern.toLowerCase();
      str = str.toLowerCase();
      let patternIdx = 0;
      let strIdx = 0;
      while (patternIdx < pattern.length && strIdx < str.length) {
        if (pattern[patternIdx] === str[strIdx]) {
          patternIdx++;
        }
        strIdx++;
      }
      return patternIdx === pattern.length;
    };

    const searchWords = query.toLowerCase().split(/\s+/);
    const filtered = allCommands.filter((command) => {
      // Search in command name and description
      const searchText = `${command.name} ${command.description}`.toLowerCase();
      // Check if all search words are found in the command
      return (
        searchWords.every((word) => searchText.includes(word)) ||
        fuzzyMatch(command.name, query)
      );
    });

    setFilteredCommands(filtered);
    // Select first item if available
    if (filtered.length > 0 && !filtered.some((cmd) => cmd.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [query, allCommands, selectedId]);

  // Set up a system to collect all visible command elements
  useEffect(() => {
    // When filtered commands change, we need to update the selected ID
    if (filteredCommands.length > 0 && !selectedId) {
      setSelectedId(filteredCommands[0].id);
    } else if (filteredCommands.length === 0) {
      setSelectedId(null);
    }
  }, [filteredCommands, selectedId]);

  // Function to get all focusable command elements in their visual order
  const getOrderedCommandElements = () => {
    const elements: HTMLDivElement[] = [];
    const map = commandRefs.current;
    // Only get elements that are currently in the filtered commands
    filteredCommands.forEach((cmd) => {
      const element = map.get(cmd.id);
      if (element) {
        elements.push(element);
      }
    });
    // Sort elements by their vertical position
    return elements.sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      return aRect.top - bRect.top;
    });
  };

  // Navigate to the next or previous command
  const navigateCommands = (direction: "next" | "prev") => {
    if (!selectedId || filteredCommands.length === 0) {
      return;
    }

    const elements = getOrderedCommandElements();
    if (elements.length === 0) return;

    // Find the index of the currently selected element
    const currentIndex = elements.findIndex(
      (el) => el.getAttribute("data-id") === selectedId
    );

    let nextIndex;
    if (direction === "next") {
      nextIndex = currentIndex < elements.length - 1 ? currentIndex + 1 : 0;
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : elements.length - 1;
    }

    const nextId = elements[nextIndex].getAttribute("data-id");
    if (nextId) {
      setSelectedId(nextId);
      // Scroll into view if needed
      elements[nextIndex].scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        navigateCommands("next");
        break;
      case "ArrowUp":
        e.preventDefault();
        navigateCommands("prev");
        break;
      case "Enter":
        e.preventDefault();
        if (selectedId) {
          const command = filteredCommands.find((cmd) => cmd.id === selectedId);
          if (command) {
            command.action();
          }
        }
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  };

  // Handle command execution
  const executeCommand = (command: Command) => {
    console.log("Executing", command);
    command.action();
  };

  // Register a ref for a command element
  const registerCommandRef = (id: string, element: HTMLDivElement | null) => {
    if (element) {
      commandRefs.current.set(id, element);
    } else {
      commandRefs.current.delete(id);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0
      filter
      backdrop-blur-[1px]
      backdrop-grayscale
      backdrop-brightness-80
      flex items-start justify-center pt-[15vh] z-[2000]"
      onClick={onClose}
    >
      <div className="flex flex-col items-center justify-start w-full space-y-4">
        {showInfoCard && (
          <InfoCard
            dismissInfoCard={dismissInfoCard}
            onStepChange={(step) => {
              // console.log("Step changed:", step);
              // if it shows the last step, close the command palette
              if (step.id === "welcome") {
                setShowCommandPalette(false);
              } else {
                setShowCommandPalette(true);
              }
            }}
          />
        )}

        {showCommandPalette && (
          <div
            className="w-full max-w-xl bg-surface-secondary border border-border shadow-lg rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="p-4 border-b border-border flex items-center">
              <svg
                className="w-5 h-5 text-content-tertiary mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                ref={inputRef}
                type="text"
                placeholder="Search commands..."
                className="flex-grow bg-surface-secondary border-none focus:ring-0 text-content-primary outline-none"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className="text-xs text-content-tertiary px-2 py-1 rounded-md border border-border">
                esc
              </div>
            </div>

            {/* Results */}
            <div ref={commandListRef} className="overflow-y-auto max-h-[50vh]">
              {filteredCommands.length === 0 ? (
                <div className="p-4 text-center text-content-tertiary">
                  No commands found
                </div>
              ) : (
                <div>
                  {/* Group commands by category */}
                  {["navigation", "thread", "view", "settings", "system"].map(
                    (category) => {
                      const categoryCommands = filteredCommands.filter(
                        (cmd) => cmd.category === category
                      );
                      if (categoryCommands.length === 0) return null;
                      return (
                        <div key={category} className="mb-2">
                          <div className="px-4 py-1 text-xs text-content-tertiary uppercase">
                            {category}
                          </div>
                          {categoryCommands.map((command) => {
                            const isSelected = command.id === selectedId;
                            return (
                              <div
                                key={command.id}
                                ref={(el) => registerCommandRef(command.id, el)}
                                data-id={command.id}
                                className={`px-4 py-2 flex items-center cursor-pointer hover:bg-surface-tertiary ${
                                  isSelected ? "bg-surface-tertiary" : ""
                                }`}
                                onClick={() => executeCommand(command)}
                                onMouseEnter={() => setSelectedId(command.id)}
                              >
                                {command.icon && (
                                  <div className="mr-3 text-content-secondary">
                                    {command.icon}
                                  </div>
                                )}
                                <div className="flex-grow">
                                  <div className="font-medium text-content-primary">
                                    {command.name}
                                  </div>
                                  {command.description && (
                                    <div className="text-xs text-content-tertiary">
                                      {command.description}
                                    </div>
                                  )}
                                </div>
                                {command.shortcut && (
                                  <div className="text-xs text-content-tertiary ml-2 px-2 py-1 rounded-md border border-border">
                                    {command.shortcut}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
