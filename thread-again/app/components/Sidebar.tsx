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

function ThreadSettingView({
  activeThreadWebhooks,
}: {
  activeThreadWebhooks: Promise<Webhook[]>;
}) {
  const fetcher = useFetcher<{ success: boolean }>();

  const handleWebhookSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const url = form[0].value;
    const secret = form[1].value || "";
    if (!url) return;

    fetcher.submit(
      {
        intent: "createWebhook",
        url,
        secret,
      },
      { method: "post" }
    );
  };

  const handleWebhookRemove = (e: React.MouseEvent, webhookId: number) => {
    e.preventDefault();
    fetcher.submit(
      {
        intent: "removeWebhook",
        webhookId,
      },
      { method: "delete" }
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-content-accent">Settings</h2>

      <div className="bg-surface-secondary rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-content-accent mb-2">
          Add Webhook
        </h3>
        <form className="space-y-4" onSubmit={handleWebhookSubmit}>
          <input
            type="text"
            placeholder="Webhook URL"
            className="w-full px-4 py-2 bg-surface-tertiary border border-border rounded-lg focus:ring-2 focus:ring-border-focus focus:border-transparent"
          />
          <input
            type="text"
            placeholder="Webhook Secret"
            required={false}
            className="w-full px-4 py-2 bg-surface-tertiary border border-border rounded-lg focus:ring-2 focus:ring-border-focus focus:border-transparent"
          />
          <button
            type="submit"
            className="w-full px-4 py-2 bg-interactive hover:bg-interactive-hover active:bg-interactive-active text-content-primary font-medium rounded-lg transition-colors"
          >
            Add Webhook
          </button>
        </form>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-content-accent mb-2">
          Webhooks
        </h3>
        <Suspense
          fallback={
            // a skeleton loader
            <div className="space-y-4">
              <div className="animate-pulse bg-surface-tertiary p-4 rounded-lg h-24"></div>
            </div>
          }
        >
          <Await resolve={activeThreadWebhooks}>
            {(webhooks) => (
              <ul className="space-y-4">
                {webhooks &&
                  webhooks.map((webhook, idx) => (
                    <li
                      key={webhook.id}
                      className="bg-surface-tertiary p-4 rounded-lg"
                    >
                      <button
                        className="text-xs text-content-accent float-right mt-1"
                        onClick={(e) => handleWebhookRemove(e, webhook.id)}
                      >
                        <CloseIcon />
                      </button>
                      <div>{webhook.url}</div>
                      <div>{webhook.secret}</div>
                    </li>
                  ))}
              </ul>
            )}
          </Await>
        </Suspense>
      </div>
    </div>
  );
}

export default Sidebar;
