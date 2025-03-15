import React, { useState, useEffect, Suspense, useRef } from "react";
import type { LoaderFunction, ActionFunction } from "@remix-run/cloudflare";
import { useLoaderData, useFetcher, Await } from "@remix-run/react";
import { clientMiddleware } from "~/middleware/storageClient";
import type {
  Thread,
  BackendConnection,
  Document as TDocument,
  APIKey,
  Webhook,
  Post,
  LoaderData,
} from "~/clients/types";
import SettingsModal from "~/components/SettingsModal";
import { RestThreadClient } from "~/clients/rest";
import { getBuildHash } from "~/utils/build-hash.server";
import ThreadPostList from "~/components/ThreadPostList";
import Topbar from "~/components/Topbar";
import Sidebar from "~/components/Sidebar";
import CloseIcon from "~/components/CloseIcon";

// TODO: consolidate styles of various lists based on similar interactions
function APIKeyItem({
  apiKey,
  onUpdate,
  onRemove,
}: {
  apiKey: APIKey;
  onUpdate: (updated: APIKey) => void;
  onRemove: (id: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingData, setEditingData] = useState<APIKey>(apiKey);

  useEffect(() => {
    if (!isEditing) {
      setEditingData(apiKey);
    }
  }, [apiKey, isEditing]);

  const handleKeyChange = (value: string) => {
    setEditingData((prev) => ({ ...prev, key_name: value }));
  };

  const handleCheckboxChange = (
    perm: keyof APIKey["permissions"],
    value: boolean
  ) => {
    setEditingData((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [perm]: value },
    }));
  };

  const handleSave = () => {
    onUpdate(editingData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditingData(apiKey);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="border border-border p-4 rounded-lg mb-1 mt-1">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-semibold">{apiKey.key_name || "New API Key"}</p>
            <p className="font-semibold">{apiKey.api_key || "New API Key"}</p>
            <div className="flex space-x-2 text-sm">
              {apiKey.permissions.read && <span>Read</span>}
              {apiKey.permissions.write && <span>Write</span>}
              {apiKey.permissions.delete && <span>Delete</span>}
            </div>
          </div>
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onRemove(apiKey.id)}
              className="text-red-600 hover:text-red-800 text-sm"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border p-4 rounded-lg mb-4">
      <div className="mb-4">
        <label className="block text-sm font-medium">API Key</label>
        <input
          type="text"
          value={editingData.key_name}
          onChange={(e) => handleKeyChange(e.target.value)}
          className="bg-surface-tertiary mt-1 w-full border border-border rounded p-2"
          placeholder="Enter key name"
          disabled={true}
        />
      </div>
      <div className="mb-4">
        <span className="block text-sm font-medium">Permissions</span>
        <div className="flex items-center space-x-4 mt-1">
          <label className="flex items-center space-x-1">
            <input
              type="checkbox"
              checked={editingData.permissions.read}
              onChange={(e) => handleCheckboxChange("read", e.target.checked)}
            />
            <span className="text-sm">Read</span>
          </label>
          <label className="flex items-center space-x-1">
            <input
              type="checkbox"
              checked={editingData.permissions.write}
              onChange={(e) => handleCheckboxChange("write", e.target.checked)}
            />
            <span className="text-sm">Write</span>
          </label>
          <label className="flex items-center space-x-1">
            <input
              type="checkbox"
              checked={editingData.permissions.delete}
              onChange={(e) => handleCheckboxChange("delete", e.target.checked)}
            />
            <span className="text-sm">Delete</span>
          </label>
        </div>
      </div>
      <div className="flex justify-end space-x-2">
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 rounded bg-gray-300 text-black hover:bg-gray-400"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 rounded bg-blue-500 text-content-accent hover:bg-blue-600"
        >
          Save
        </button>
      </div>
    </div>
  );
}

export default APIKeyItem;
