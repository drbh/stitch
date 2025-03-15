import React, { useState, useEffect, useRef, memo, forwardRef } from "react";
import { useFetcher } from "@remix-run/react";
import type {
  Thread,
  Webhook,
  Document as TDocument,
  APIKey,
  Post,
} from "~/clients/types";
import ThreadPostList from "~/components/ThreadPostList";
import ThreadHeader from "~/components/ThreadHeader";
import ThreadTabBar, { ThreadTab } from "~/components/ThreadTabBar";
import DocumentsTab from "~/components/DocumentsTab";
import AccessTab from "~/components/AccessTab";
import WebhooksTab from "~/components/WebhooksTab";

// Memoized wrapper to prevent unnecessary rerenders
const ThreadPostListWrapper = memo(forwardRef((props, ref) => {
  return <ThreadPostList {...props} ref={ref} />;
}));

export default function MainContent({
  activeThread,
  activeThreadPosts,
  activeThreadWebhooks,
  activeThreadDocuments,
  activeThreadApiKeys,
  isShareUrl,
}: {
  activeThread: Thread | null;
  activeThreadPosts: Promise<Post[]>;
  activeThreadWebhooks: Promise<Webhook[]>;
  activeThreadDocuments: Promise<TDocument[]>;
  activeThreadApiKeys: Promise<APIKey[]>;
  isShareUrl: boolean;
}) {
  const [currentTab, setCurrentTab] = useState(ThreadTab.Posts);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const fetcher = useFetcher<{ success: boolean }>();
  const ref = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [stateMirror, setStateMirror] = useState({
    showJson: false,
    showDevNote: false,
    showActivityChart: true
  });
  const [counts, setCounts] = useState({
    posts: 0,
    settings: 0,
    documents: 0,
    access: 0,
  });
  const [url, setUrl] = useState("");

  // Handle tab navigation - memoize to prevent rerenders
  const handleTabChange = React.useCallback((tab: ThreadTab) => {
    setCurrentTab(tab);
  }, []);

  // Create share URL
  const handleShareUrlCreate = async () => {
    if (activeThread && activeThread.share_pubkey) return;

    const { hash, preimage } = await creatEphemeralPubKeySignature();

    fetcher.submit(
      {
        intent: "shareUrlCreate",
        preimage,
      },
      { method: "post" }
    );

    const urlValues = {
      t: "5",
      s: "http://localhost:8787",
      token: hash,
    };

    const url = new URL(window.location.toString());
    for (const key in urlValues) {
      url.searchParams.set(key, urlValues[key]);
    }

    setShareUrl(url.toString());
  };

  // The DocumentsTab now handles document submission internally
  // This function is kept for backward compatibility if needed
  const handleDocumentSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const title = form[0].value;
    const content = form[1].value;
    if (!title || !content) return;

    fetcher.submit(
      {
        intent: "createDocument",
        title,
        content,
        type: "text",
      },
      { method: "post" }
    );
  };

  const handleDocumentRemove = (e: React.MouseEvent, docId: string) => {
    e.preventDefault();
    fetcher.submit(
      {
        intent: "deleteDocument",
        docId,
      },
      { method: "delete" }
    );
  };

  // API key handlers
  const handleApiKeySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = form[0].value;
    if (!name) return;

    fetcher.submit(
      {
        intent: "createApiKey",
        name,
      },
      { method: "post" }
    );
  };

  const updateAPIKey = (updated: APIKey) => {
    fetcher.submit(
      {
        intent: "updated",
        updated: JSON.stringify(updated),
      },
      { method: "post" }
    );
  };

  const removeAPIKey = (id: string) => {
    fetcher.submit(
      {
        intent: "removeApiKey",
        id,
      },
      { method: "post" }
    );
  };

  // Load data and update counts
  useEffect(() => {
    activeThreadWebhooks.then((webhooks) => {
      setCounts((prev) => ({ ...prev, settings: webhooks.length }));
    });
    activeThreadDocuments.then((documents) => {
      setCounts((prev) => ({ ...prev, documents: documents.length }));
    });
    activeThreadApiKeys.then((apiKeys) => {
      setCounts((prev) => ({ ...prev, access: apiKeys.length }));
    });
    activeThreadPosts.then((posts) => {
      setCounts((prev) => ({ ...prev, posts: posts.length }));
    });

    if (window.location.origin && activeThread) {
      const currentUrl = window.location.origin;
      const shareUrl = `${currentUrl}/?t=${activeThread.id}&s=${activeThread.location}&token=${activeThread.share_pubkey}`;
      setUrl(shareUrl);
    }

    return () => {
      setCounts({ posts: 0, settings: 0, documents: 0, access: 0 });
    };
  }, [
    activeThreadWebhooks,
    activeThreadDocuments,
    activeThreadApiKeys,
    activeThreadPosts,
    activeThread,
  ]);

  // Initialize state mirror with default values
  // then attach listeners only when necessary
  const initStateMirror = React.useCallback(() => {
    if (ref.current && ref.current.states) {
      setStateMirror(ref.current.states);
    }
  }, []);

  // Only get a reference to the threadPostList when Posts tab is active
  useEffect(() => {
    if (currentTab === ThreadTab.Posts) {
      // Delay to ensure component is rendered
      const timer = setTimeout(initStateMirror, 100);
      return () => clearTimeout(timer);
    }
  }, [currentTab, initStateMirror]);

  // Handle clicking outside the actions menu
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (!e.target.closest(".thread-actions-menu")) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <main className="flex-1 h-[calc(100vh-64px)] overflow-y-auto bg-surface-primary p-6">
      {activeThread ? (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Thread header with actions menu */}
          <ThreadHeader
            activeThread={activeThread}
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            ref={ref}
            stateMirror={stateMirror}
            setStateMirror={setStateMirror}
            currentTab={currentTab}
            handleTabChange={handleTabChange}
            counts={counts}
            isShareUrl={isShareUrl}
            handleShareUrlCreate={handleShareUrlCreate}
          />

          {/* Tab content - Use React.memo to prevent unnecessary rerenders */}
          {currentTab === ThreadTab.Posts ? (
            <ThreadPostListWrapper
              thread={activeThread}
              isShareUrl={isShareUrl}
              activeThreadPosts={activeThreadPosts}
              ref={ref}
            />
          ) : currentTab === ThreadTab.Webhooks ? (
            <WebhooksTab activeThreadWebhooks={activeThreadWebhooks} />
          ) : currentTab === ThreadTab.Documents ? (
            <DocumentsTab
              thread={activeThread}
              isShareUrl={isShareUrl}
              handleDocumentSubmit={handleDocumentSubmit}
              activeThreadDocuments={activeThreadDocuments}
              handleDocumentRemove={handleDocumentRemove}
            />
          ) : currentTab === ThreadTab.Access ? (
            <AccessTab
              handleApiKeySubmit={handleApiKeySubmit}
              activeThreadApiKeys={activeThreadApiKeys}
              updateAPIKey={updateAPIKey}
              removeAPIKey={removeAPIKey}
            />
          ) : null}
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-content-tertiary">
          Select a thread to view details
        </div>
      )}

      <div className="mt-20 text-center text-gray-400 text-sm" />
    </main>
  );
}

// Create a unique ephemeral value and its hash commitment.
async function creatEphemeralPubKeySignature() {
  const timestamp = new Date().getTime();
  // Create a random 8-byte nonce
  const nonce = crypto.getRandomValues(new Uint8Array(8));
  const nonceHex = Array.from(nonce)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Preimage: unique ephemeral value
  const noncePreimage = crypto.getRandomValues(new Uint8Array(20));
  const noncePreimageHex = Array.from(noncePreimage)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const preimage = noncePreimageHex;

  const data = new TextEncoder().encode(preimage);
  // Compute the SHA-256 hash of the preimage.
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashHex = buf2hex(hashBuffer);

  return { hash: hashHex, preimage };
}

const buf2hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
