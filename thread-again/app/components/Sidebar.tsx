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
}: {
  servers: string[];
  threads: Promise<Thread[]>;
  setActiveThread: (thread: Thread | null) => void;
  activeThread: Thread | null;
  showMenu: boolean;
  setShowMenu: (showMenu: boolean) => void;
}) {
  // const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Handle window resize and set mobile state
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
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
          transition-transform duration-300 ease-in-out
          z-30 lg:z-auto
          lg:top-0 left-0
          ${showMenu ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="p-6 space-y-6">
          <ThreadComposer servers={servers} />
          <ThreadList
            threads={threads}
            setActiveThread={setActiveThread}
            activeThread={activeThread}
          />
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
