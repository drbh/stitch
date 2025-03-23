import React, { useState, useEffect, Suspense, useRef } from "react";
import { useLoaderData, useFetcher, Await } from "@remix-run/react";
import type {
  Thread,
  BackendConnection,
  Document as TDocument,
  APIKey,
  Webhook,
  Post,
} from "~/clients/types";
import ThreadComposer from "~/components/ThreadComposer";
import ThreadList from "~/components/ThreadList";
import CloseIcon from "~/components/CloseIcon";

function Sidebar({
  servers,
  threads,
  setActiveThread,
  activeThread,
  showMenu,
  setShowMenu,
  createNewThread,
  userProfileObj,
}: {
  servers: string[];
  threads: Promise<Thread[]>;
  setActiveThread: (thread: Thread | null) => void;
  activeThread: Thread | null;
  showMenu: boolean;
  setShowMenu: (showMenu: boolean) => void;
  createNewThread: () => void;
  userProfileObj: any;
}) {
  // const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [manuallyClosed, setManuallyClosed] = useState(false);

  // Handle window resize and set mobile state
  useEffect(() => {
    const handleResize = () => {
      if (!manuallyClosed && window.innerWidth >= 1024) {
        // setShowMenu(true);
      }
      // setIsMobile(window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close sidebar when a thread is selected on mobile
  useEffect(() => {
    if (isMobile && activeThread) {
      setShowMenu(false);
    }
  }, [activeThread, isMobile]);
  const dummyProfileJwt = userProfileObj;

  return (
    <>
      {/* Mobile Toggle Button */}
      {isMobile && showMenu && (
        <div
          className="fixed inset-0 bg-black/50 z-20"
          onClick={() => setShowMenu(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          bg-surface-primary
          fixed lg:relative top-16
          w-80 h-[calc(100vh-64px)]
          border-r border-border
          overflow-y-auto
          transition-transform duration-400 ease-in-out
          z-30 lg:z-auto
          lg:top-0 left-0
          ${showMenu ? "translate-x-0" : "-translate-x-full"}
          ${
            showMenu
              ? "transition-all duration-100 w-80"
              : "transition-all duration-100 w-0"
          }
          `}
        // ${showMenu ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      >
        <div className="p-4 space-y-6 w-80 overflow-hidden">
          {/* <ThreadComposer servers={servers} /> */}
          <ThreadList
            threads={threads}
            setActiveThread={setActiveThread}
            activeThread={activeThread}
            createNewThread={createNewThread}
          />
        </div>

        {/*  */}
        <div
          className="
        fixed bottom-0 left-0 w-80 border-t border-border bg-surface-secondary
        mb-10
        "
        >
          <div className="p-4 flex items-center justify-between">
            {/* Avatar and Name */}
            {dummyProfileJwt && (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <img
                    src={dummyProfileJwt.avatar}
                    alt="avatar"
                    className="w-8 h-8 rounded-full"
                  />
                </div>
                <span className="text-sm font-medium text-foreground">
                  <span className="text-sm font-medium text-foreground pr-4">
                    {dummyProfileJwt.name}
                  </span>{" "}
                  <span className="text-muted-foreground opacity-50">
                    (
                    {dummyProfileJwt.email.length > 16
                      ? dummyProfileJwt.email.slice(0, 20) + "..."
                      : dummyProfileJwt.email}
                    )
                  </span>
                </span>
              </div>
            )}

            {!dummyProfileJwt && (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-muted-foreground"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                  </svg>
                </div>
                <span className="text-sm font-medium text-foreground">
                  Anonymous User
                </span>
              </div>
            )}

            {/* Status indicator and menu */}
            <div className="flex items-center space-x-2">
              {/* Status indicator - green dot for online */}
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>

              {/* Menu icon */}
              <button
                className="p-1 rounded-sm hover:bg-primary-50"
                onClick={() => {
                  // redirect to the account page
                  // if were on stitch.sh, we can just redirect account.stitch.sh
                  if (window.location.hostname === "stitch.sh") {
                    window.location.href = "https://account.stitch.sh";
                  }
                  // if were on localhost, we can redirect to localhost:3000/account
                  else if (window.location.hostname === "localhost") {
                    window.location.href = "http://localhost:5173";
                  }
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-muted-foreground"
                >
                  <circle cx="12" cy="12" r="1"></circle>
                  <circle cx="19" cy="12" r="1"></circle>
                  <circle cx="5" cy="12" r="1"></circle>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
