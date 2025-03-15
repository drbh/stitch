import React, { createContext, useContext, useState, ReactNode } from "react";

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

export function ThreadActionsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThreadActionsState>({
    showJson: false,
    showDevNote: false,
    showActivityChart: true,
  });

  const toggleShowJson = () => {
    const newValue = !state.showJson;
    setState((prev) => ({ ...prev, showJson: newValue }));
    return newValue;
  };

  const toggleDevNote = () => {
    const newValue = !state.showDevNote;
    setState((prev) => ({ ...prev, showDevNote: newValue }));
    return newValue;
  };

  const toggleActivityChart = () => {
    const newValue = !state.showActivityChart;
    setState((prev) => ({ ...prev, showActivityChart: newValue }));
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
