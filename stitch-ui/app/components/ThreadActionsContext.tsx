import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { useFetcher } from "@remix-run/react";

type ThreadActionsState = {
  showJson: boolean;
  showDevNote: boolean;
  showActivityChart: boolean;
};

type ThreadActionsContextType = {
  state: ThreadActionsState;
  toggleShowJson: () => boolean;
  toggleDevNote: () => boolean;
  toggleActivityChart: () => boolean;
};

const ThreadActionsContext = createContext<ThreadActionsContextType | null>(
  null
);

export function useThreadActions() {
  const context = useContext(ThreadActionsContext);
  if (!context) {
    throw new Error(
      "useThreadActions must be used within a ThreadActionsProvider"
    );
  }
  return context;
}

// Get initial state from SSR data
export function getInitialThreadActionsState(
  request: Request
): ThreadActionsState {
  // Get cookie from request
  const cookie = request.headers.get("Cookie");
  const threadViewingState = cookie
    ?.split(";")
    .find((c) => c.trim().startsWith("threadViewingState="));

  // Default state
  const defaultState: ThreadActionsState = {
    showJson: false,
    showDevNote: false,
    showActivityChart: true,
  };

  if (!threadViewingState) {
    return defaultState;
  }

  try {
    // Parse state from cookie value
    const state = JSON.parse(
      decodeURIComponent(threadViewingState.split("=")[1])
    );
    return {
      ...defaultState,
      ...state,
    };
  } catch (e) {
    console.error("Error parsing threadViewingState cookie:", e);
    return defaultState;
  }
}

export function ThreadActionsProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: ThreadActionsState;
}) {
  const [state, setState] = useState<ThreadActionsState>(
    initialState || {
      showJson: false,
      showDevNote: false,
      showActivityChart: true,
    }
  );

  const fetcher = useFetcher();

  // Update cookie when state changes
  const updateCookie = (newState: ThreadActionsState) => {
    // Only update cookie on client-side
    if (typeof document === "undefined") return;

    fetcher.submit(
      {
        intent: "updateThreadViewingState",
        state: JSON.stringify(newState),
      },
      { method: "post" }
    );
  };

  const toggleShowJson = () => {
    const newValue = !state.showJson;
    const newState = { ...state, showJson: newValue };
    setState(newState);
    updateCookie(newState);
    return newValue;
  };

  const toggleDevNote = () => {
    const newValue = !state.showDevNote;
    const newState = { ...state, showDevNote: newValue };
    setState(newState);
    updateCookie(newState);
    return newValue;
  };

  const toggleActivityChart = () => {
    const newValue = !state.showActivityChart;
    const newState = { ...state, showActivityChart: newValue };
    setState(newState);
    updateCookie(newState);
    return newValue;
  };

  return (
    <ThreadActionsContext.Provider
      value={{
        state,
        toggleShowJson,
        toggleDevNote,
        toggleActivityChart,
      }}
    >
      {children}
    </ThreadActionsContext.Provider>
  );
}
