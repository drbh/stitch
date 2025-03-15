import React from "react";
import { Suspense } from "react";
import { Await } from "@remix-run/react";
import type { APIKey } from "~/clients/types";
import APIKeyItem from "./APIKeyItem";

export default function AccessTab({
  handleApiKeySubmit,
  activeThreadApiKeys,
  updateAPIKey,
  removeAPIKey
}: {
  handleApiKeySubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  activeThreadApiKeys: Promise<APIKey[]>;
  updateAPIKey: (updated: APIKey) => void;
  removeAPIKey: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-content-accent">
        Access
      </h2>

      <div className="bg-surface-secondary rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-content-accent mb-2">
          Add API Key
        </h3>
        <form className="space-y-4" onSubmit={handleApiKeySubmit}>
          <input
            type="text"
            placeholder="API Key Name"
            className="w-full px-4 py-2 bg-surface-tertiary border border-border rounded-lg focus:ring-0 focus:ring-border-focus focus:border-transparent"
          />
          <button
            type="submit"
            className="border border-border px-4 py-2 rounded bg-green-600 text-content-accent hover:bg-green-700"
          >
            Create New API Key
          </button>
        </form>
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
                      permissions: {
                        read: true,
                        write: true,
                        delete: true,
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
