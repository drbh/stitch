import React from "react";
import { Suspense } from "react";
import { Await } from "@remix-run/react";
import type { APIKey } from "~/clients/types";
import APIKeyItem from "./APIKeyItem";

export default function AccessTab({
  handleApiKeySubmit,
  activeThreadApiKeys,
  updateAPIKey,
  removeAPIKey,
}: {
  handleApiKeySubmit: () => void;
  activeThreadApiKeys: Promise<APIKey[]>;
  updateAPIKey: (updated: APIKey) => void;
  removeAPIKey: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-content-accent">API Keys</h2>
        <button
          onClick={(e) => {
            if (
              window.confirm("Are you sure you want to generate a new API key?")
            ) {
              handleApiKeySubmit();
            }
          }}
          className="px-4 py-2 bg-surface-primary border border-border hover:bg-surface-secondary active:bg-interactive-active text-white font-medium rounded-lg transition-colors"
        >
          Generate Key
        </button>
      </div>

      <div>
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="animate-pulse bg-surface-tertiary p-4 rounded-lg h-24"></div>
            </div>
          }
        >
          <Await resolve={activeThreadApiKeys}>
            {(apikey) => (
              <div>
                <h2 className="text-lg font-semibold text-content-accent mb-4">
                  Active Thread API Keys
                </h2>
                {apikey.map((key) => (
                  <APIKeyItem
                    key={key.id}
                    apiKey={{
                      id: key.id,
                      key_name: key.key_name,
                      api_key: key.api_key,
                      permissions: JSON.parse(key.permissions) || {
                        read: true,
                        write: false,
                        delete: false,
                      },
                    }}
                    onUpdate={updateAPIKey}
                    onRemove={removeAPIKey}
                  />
                ))}
              </div>
            )}
          </Await>
        </Suspense>
      </div>
    </div>
  );
}
