import React, { useState, useEffect, Suspense } from "react";
import { useLoaderData, useFetcher, Await } from "@remix-run/react";
import type { Webhook } from "~/clients/types";
import CloseIcon from "~/components/CloseIcon";
import JsonViewer from "~/components/JsonViewer";

interface WebhookFormState {
  url: string;
  secret: string;
  eventTypes: {
    post_created: boolean;
    post_updated: boolean;
    post_deleted: boolean;
    document_created: boolean;
    document_updated: boolean;
    document_deleted: boolean;
  };
}

// Event types for webhook testing
const EVENT_TYPES = [
  "post_created",
  "post_updated",
  "post_deleted",
  "document_created",
  "document_updated",
  "document_deleted",
];

function WebhooksTab({
  activeThreadWebhooks,
}: {
  activeThreadWebhooks: Promise<Webhook[]>;
}) {
  const fetcher = useFetcher<{
    success: boolean;
    message?: string;
    status?: number;
    data?: any;
    headers?: Record<string, string>;
    sentPayload?: any;
  }>();

  const [webhookForm, setWebhookForm] = useState<WebhookFormState>({
    url: "",
    secret: "",
    eventTypes: {
      post_created: true,
      post_updated: true,
      post_deleted: true,
      document_created: true,
      document_updated: true,
      document_deleted: true,
    },
  });
  const [selectedEventType, setSelectedEventType] = useState("post_created");
  const [testResponse, setTestResponse] = useState<{
    data: any;
    status: number;
    headers: Record<string, string>;
  } | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [webhookHistory, setWebhookHistory] = useState<
    Array<{ timestamp: string; status: number; payload: any }>
  >([]);
  const [isFormVisible, setIsFormVisible] = useState(false);

  const handleWebhookSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { url, secret, eventTypes } = webhookForm;
    if (!url) return;

    fetcher.submit(
      {
        intent: "createWebhook",
        url,
        secret,
        eventTypes: JSON.stringify(eventTypes),
      },
      { method: "post" }
    );

    // Reset form after submission
    setWebhookForm({
      ...webhookForm,
      url: "",
      secret: "",
    });
    setIsFormVisible(false);
  };

  const handleWebhookRemove = (e: React.MouseEvent, webhookId: number) => {
    e.preventDefault();
    e.stopPropagation();
    fetcher.submit(
      {
        intent: "removeWebhook",
        webhookId,
      },
      { method: "delete" }
    );

    // If the removed webhook was selected, clear the selection
    if (selectedWebhook?.id === webhookId) {
      setSelectedWebhook(null);
      setTestResponse(null);
    }
  };

  const handleTestWebhook = () => {
    if (!selectedWebhook) return;

    // Submit to our backend action to trigger the webhook test
    fetcher.submit(
      {
        intent: "testWebhook",
        webhookId: String(selectedWebhook.id),
        eventType: selectedEventType,
      },
      { method: "post" }
    );
  };

  // Effect to handle fetcher state changes for webhook testing
  useEffect(() => {
    // Only process completed test webhook requests
    if (fetcher.state === "idle" && fetcher.data && fetcher.data.sentPayload) {
      // We know this is a response from a test webhook request
      if (fetcher.data.success) {
        setTestResponse({
          data: fetcher.data.data,
          status: fetcher.data.status || 0,
          headers: fetcher.data.headers || {},
        });

        // Add to history
        setWebhookHistory((prev) => [
          {
            timestamp: new Date().toISOString(),
            status: fetcher.data.status || 0,
            payload: fetcher.data.sentPayload,
          },
          ...prev,
        ]);
      } else {
        setTestResponse({
          data: { error: fetcher.data.message || "Test failed" },
          status: 0,
          headers: {},
        });
      }
    }
  }, [fetcher.state, fetcher.data]);

  // Helper to format the webhook events selection from the form
  const getEventTypesString = () => {
    const { eventTypes } = webhookForm;
    return Object.entries(eventTypes)
      .filter(([_, isSelected]) => isSelected)
      .map(([event]) => event)
      .join(", ");
  };

  // Disable the test button while a test is in progress
  const isTestingInProgress =
    fetcher.state !== "idle" && fetcher.data?.sentPayload;

  // Get history for the selected webhook
  const selectedWebhookHistory = webhookHistory.filter(
    (entry) => entry.payload?.webhookId === selectedWebhook?.id
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-content-accent">Webhooks</h2>
        <button
          onClick={() => setIsFormVisible(!isFormVisible)}
          className="px-4 py-2 bg-interactive hover:bg-interactive-hover active:bg-interactive-active text-white font-medium rounded-lg transition-colors"
        >
          {isFormVisible ? "Cancel" : "Add Webhook"}
        </button>
      </div>

      {/* Create Webhook Form - Only visible when needed */}
      {isFormVisible && (
        <div className="bg-surface-primary border border-border rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-content-accent mb-4">
            Add Webhook
          </h3>
          <form className="space-y-4" onSubmit={handleWebhookSubmit}>
            <div>
              <label
                htmlFor="webhookUrl"
                className="block text-sm font-medium text-content-secondary mb-1"
              >
                Webhook URL <span className="text-red-500">*</span>
              </label>
              <input
                id="webhookUrl"
                type="url"
                placeholder="https://example.com/webhook"
                value={webhookForm.url}
                onChange={(e) =>
                  setWebhookForm({ ...webhookForm, url: e.target.value })
                }
                className="w-full px-4 py-2 bg-surface-tertiary border border-border rounded-lg focus:ring-0 focus:ring-border-focus focus:border-transparent"
                required
              />
              <p className="text-xs text-content-tertiary mt-1">
                The URL that will receive webhook POST requests
              </p>
            </div>

            <div>
              <label
                htmlFor="webhookSecret"
                className="block text-sm font-medium text-content-secondary mb-1"
              >
                Webhook Secret
              </label>
              <input
                id="webhookSecret"
                type="text"
                placeholder="Optional: A secret string to verify webhook authenticity"
                value={webhookForm.secret}
                onChange={(e) =>
                  setWebhookForm({ ...webhookForm, secret: e.target.value })
                }
                className="w-full px-4 py-2 bg-surface-tertiary border border-border rounded-lg focus:ring-0 focus:ring-border-focus focus:border-transparent"
              />
              <p className="text-xs text-content-tertiary mt-1">
                Used to sign payloads for security verification
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-content-secondary mb-2">
                Event Types
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(webhookForm.eventTypes).map(
                  ([eventType, isChecked]) => (
                    <div key={eventType} className="flex items-center">
                      <input
                        id={`event-${eventType}`}
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          setWebhookForm({
                            ...webhookForm,
                            eventTypes: {
                              ...webhookForm.eventTypes,
                              [eventType]: e.target.checked,
                            },
                          });
                        }}
                        className="h-4 w-4 text-interactive focus:ring-interactive border-border rounded"
                      />
                      <label
                        htmlFor={`event-${eventType}`}
                        className="ml-2 text-sm text-content-secondary"
                      >
                        {eventType.replace("_", " ")}
                      </label>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-interactive hover:bg-interactive-hover active:bg-interactive-active text-white font-medium rounded-lg transition-colors"
              >
                Add Webhook
              </button>
              <button
                type="button"
                onClick={() => setIsFormVisible(false)}
                className="px-4 py-2 bg-surface-tertiary hover:bg-surface-secondary text-content-secondary font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <Documentation />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column: Webhook list */}
        <div className="md:col-span-1">
          {/* <h3 className="text-lg font-semibold text-content-accent mb-3">
            Your Webhooks
          </h3> */}
          <Suspense
            fallback={
              <div className="space-y-4">
                <div className="animate-pulse bg-surface-primary p-4 rounded-lg h-24"></div>
                <div className="animate-pulse bg-surface-primary p-4 rounded-lg h-24"></div>
              </div>
            }
          >
            <Await resolve={activeThreadWebhooks}>
              {(webhooks) => (
                <ul className="space-y-3">
                  {webhooks && webhooks.length > 0 ? (
                    webhooks.map((webhook) => (
                      <li
                        key={webhook.id}
                        className={`bg-surface-primary p-4 rounded-lg relative border cursor-pointer border ${
                          selectedWebhook?.id === webhook.id
                            ? "border-blue-600 shadow-md"
                            : "border-border hover:border-border-hover"
                        }`}
                        onClick={() => setSelectedWebhook(webhook)}
                      >
                        <button
                          className="text-xs text-content-accent absolute top-3 right-3 opacity-70 hover:opacity-100"
                          onClick={(e) => handleWebhookRemove(e, webhook.id)}
                          aria-label="Remove webhook"
                        >
                          <CloseIcon />
                        </button>
                        <div className="text-content-primary font-medium mb-2 break-all pr-5">
                          {webhook.url.length > 30
                            ? webhook.url.substring(0, 30) + "..."
                            : webhook.url}
                        </div>
                        {webhook.api_key && (
                          <div className="text-xs text-content-secondary mb-1">
                            <span className="font-semibold">Secret:</span>{" "}
                            {webhook.api_key.substring(0, 8)}...
                          </div>
                        )}
                        {webhook.last_triggered && (
                          <div className="text-xs text-content-tertiary">
                            Last triggered:{" "}
                            {new Date(webhook.last_triggered).toLocaleString()}
                          </div>
                        )}
                      </li>
                    ))
                  ) : (
                    <div className="text-content-secondary text-center py-6 bg-surface-tertiary rounded-lg">
                      No webhooks configured yet
                    </div>
                  )}
                </ul>
              )}
            </Await>
          </Suspense>
        </div>

        {/* Right column: Details panel */}
        <div className="md:col-span-2">
          {selectedWebhook ? (
            <div className="space-y-6">
              {/* Test interface */}
              <div className="bg-surface-primary rounded-lg border border-border p-5">
                <h3 className="text-lg font-semibold text-content-accent mb-3">
                  Test Webhook
                </h3>
                <div className="text-sm text-content-secondary mb-4 break-all">
                  <span className="font-medium">URL:</span>{" "}
                  {selectedWebhook.url}
                </div>

                <div className="flex space-x-3 mb-4">
                  <div className="flex-grow">
                    <label className="block text-sm font-medium text-content-secondary mb-1">
                      Event Type
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-surface-tertiary border border-border rounded-lg focus:ring-0 focus:ring-border-focus focus:border-transparent text-sm"
                      value={selectedEventType}
                      onChange={(e) => setSelectedEventType(e.target.value)}
                      disabled={isTestingInProgress}
                    >
                      {EVENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleTestWebhook}
                      disabled={isTestingInProgress}
                      className="h-10 px-4 bg-interactive hover:bg-interactive-hover active:bg-interactive-active text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isTestingInProgress ? "Sending..." : "Send Test"}
                    </button>
                  </div>
                </div>

                {/* Error message if the test fails */}
                {fetcher.data && !fetcher.data.success && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
                    {fetcher.data.message ||
                      "Failed to test webhook. Please try again."}
                  </div>
                )}

                {/* Test results */}
                {testResponse && (
                  <div className="space-y-4 mt-4 border-t border-border pt-4">
                    <div>
                      <h4 className="text-md font-medium text-content-accent mb-2">
                        Request
                      </h4>
                      <div className="bg-surface-tertiary rounded-lg p-3 border border-border">
                        <div className="bg-surface-secondary rounded p-2 text-xs font-mono max-h-40 overflow-y-auto">
                          {fetcher.data?.sentPayload && (
                            <JsonViewer data={fetcher.data.sentPayload} />
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-md font-medium text-content-accent mb-2 flex items-center">
                        Response
                        <span
                          className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                            testResponse.status >= 200 &&
                            testResponse.status < 300
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {testResponse.status || "Error"}
                        </span>
                      </h4>
                      <div className="bg-surface-tertiary rounded-lg p-3 border border-border">
                        <div className="mb-3">
                          <h5 className="text-xs font-medium text-content-secondary mb-1">
                            Headers
                          </h5>
                          <div className="bg-surface-secondary rounded p-2 text-xs font-mono max-h-24 overflow-y-auto">
                            {Object.entries(testResponse.headers).length > 0 ? (
                              Object.entries(testResponse.headers).map(
                                ([key, value]) => (
                                  <div key={key} className="pb-1">
                                    <span className="font-semibold">
                                      {key}:
                                    </span>{" "}
                                    {value}
                                  </div>
                                )
                              )
                            ) : (
                              <div className="text-content-tertiary">
                                No headers received
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <h5 className="text-xs font-medium text-content-secondary mb-1">
                            Body
                          </h5>
                          <div className="bg-surface-secondary rounded p-2 text-xs font-mono max-h-40 overflow-y-auto">
                            {typeof testResponse.data === "object" ? (
                              <JsonViewer data={testResponse.data} />
                            ) : (
                              <div>{String(testResponse.data)}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Recent history for this webhook */}
              {selectedWebhookHistory.length > 0 && (
                <div className="bg-surface-primary rounded-lg border border-border p-5">
                  <h3 className="text-lg font-semibold text-content-accent mb-3">
                    Recent History
                  </h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {selectedWebhookHistory.slice(0, 5).map((entry, index) => (
                      <div
                        key={index}
                        className="bg-surface-tertiary p-3 rounded-lg border border-border"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="text-xs text-content-secondary">
                            {new Date(entry.timestamp).toLocaleString()}
                          </div>
                          <div
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              entry.status >= 200 && entry.status < 300
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {entry.status >= 200 && entry.status < 300
                              ? "Success"
                              : "Failed"}{" "}
                            ({entry.status})
                          </div>
                        </div>
                        <div className="text-xs text-content-tertiary mb-1">
                          Event:{" "}
                          <span className="font-medium">
                            {entry.payload?.event || "unknown"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-surface-secondary rounded-lg p-8 text-center border border-dashed border-border">
              <h3 className="text-lg font-semibold text-content-accent mb-2">
                No Webhook Selected
              </h3>
              <p className="text-content-secondary mb-4">
                Select a webhook from the list to test it or view its details.
              </p>
              <button
                onClick={() => setIsFormVisible(true)}
                className="px-4 py-2 bg-interactive hover:bg-interactive-hover text-white font-medium rounded-lg transition-colors"
              >
                Add Your First Webhook
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WebhooksTab;

const Documentation = () => {
  return (
    <div>
      {/* Documentation */}
      <div className="bg-surface-primary border border-border rounded-lg shadow-lg p-6 mt-8">
        <details>
          <summary className="text-lg font-semibold text-content-accent cursor-pointer">
            Webhook Documentation
          </summary>

          <div className="space-y-4 text-content-secondary mt-4">
            <div>
              <h4 className="font-medium text-content-primary mb-1">
                How Webhooks Work
              </h4>
              <p className="text-sm">
                Webhooks allow external services to be notified when events
                happen in your threads. When an event occurs, we'll send a POST
                request to your specified URL with event details.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-content-primary mb-1">
                Payload Format
              </h4>
              <div className="bg-surface-tertiary rounded-lg p-4 text-xs font-mono">
                {`{
  "event": "post_created",
  "data": {
    // The object that was created/updated/deleted
  },
  "timestamp": "2023-06-15T12:34:56Z"
}`}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-content-primary mb-1">
                Security
              </h4>
              <p className="text-sm">
                If you provide a webhook secret, we'll include a
                "X-Webhook-Signature" header with each request. This is a
                HMAC-SHA256 hash of the request body using your secret as the
                key. You should validate this signature to ensure the webhook is
                authentic.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-content-primary mb-1">
                Event Types
              </h4>
              <ul className="list-disc pl-5 text-sm">
                <li>
                  <span className="font-mono text-xs">post_created</span> - When
                  a new post is added to a thread
                </li>
                <li>
                  <span className="font-mono text-xs">post_updated</span> - When
                  a post is edited
                </li>
                <li>
                  <span className="font-mono text-xs">post_deleted</span> - When
                  a post is removed
                </li>
                <li>
                  <span className="font-mono text-xs">document_created</span> -
                  When a new document is created
                </li>
                <li>
                  <span className="font-mono text-xs">document_updated</span> -
                  When a document is updated
                </li>
                <li>
                  <span className="font-mono text-xs">document_deleted</span> -
                  When a document is deleted
                </li>
              </ul>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};
