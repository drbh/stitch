import React from "react";
import { useThreadActions } from "./ThreadActionsContext";

const ThreadActionsMenu = ({
  setIsOpen,
}: {
  setIsOpen: (value: boolean) => void;
}) => {
  const { state, toggleShowJson, toggleDevNote, toggleActivityChart } =
    useThreadActions();

  return (
    <div className="absolute right-0 mt-1 bg-surface-secondary border border-border rounded-md  py-1 w-40 z-10">
      <button
        className="flex items-center w-full px-4 py-2 text-sm text-left text-red-400 hover:bg-surface-tertiary"
        onClick={toggleShowJson}
      >
        <svg
          className="w-3 h-3 mr-1"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle
            fill={state.showJson ? "#000" : "#fff"}
            cx="12"
            cy="12"
            r="10"
          ></circle>
        </svg>
        Raw JSON
      </button>
      <button
        className="flex items-center w-full px-4 py-2 text-sm text-left text-red-400 hover:bg-surface-tertiary"
        onClick={toggleDevNote}
      >
        <svg
          className="w-3 h-3 mr-1"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle
            fill={state.showDevNote ? "#000" : "#fff"}
            cx="12"
            cy="12"
            r="10"
          ></circle>
        </svg>
        Endpoint Info
      </button>
      <button
        className="flex items-center w-full px-4 py-2 text-sm text-left text-red-400 hover:bg-surface-tertiary"
        onClick={toggleActivityChart}
      >
        <svg
          className="w-3 h-3 mr-1"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle
            fill={state.showActivityChart ? "#000" : "#fff"}
            cx="12"
            cy="12"
            r="10"
          ></circle>
        </svg>
        Activity Chart
      </button>

      <div className="border-t border-border my-1"></div>
      <button
        className="flex items-center w-full px-4 py-2 text-sm text-left text-red-400 hover:bg-surface-tertiary"
        onClick={() => {
          if (window.confirm("Are you sure you want to delete this thread?")) {
            // onDelete(thread);
          }
          // setIsOpen(false);
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
  );
};

export default ThreadActionsMenu;
