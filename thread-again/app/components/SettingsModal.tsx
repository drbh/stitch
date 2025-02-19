import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { useFetcher } from "@remix-run/react";
import { BackendConnection } from "~/clients/types";

interface BackendConnectionItemProps {
  connection: BackendConnection;
  onUpdate: (updated: BackendConnection) => void;
  onRemove: (id: string) => void;
}

function BackendConnectionItem({
  connection,
  onUpdate,
  onRemove,
}: BackendConnectionItemProps) {
  // Local UI state to toggle between view and edit modes.
  const [isEditing, setIsEditing] = useState(false);
  // Local copy for editing so that canceling will revert changes.
  const [editingData, setEditingData] = useState<BackendConnection>(connection);

  // If the connection prop changes externally and we're not editing,
  // update the local copy.
  useEffect(() => {
    if (!isEditing) {
      setEditingData(connection);
    }
  }, [connection, isEditing]);

  const handleChange = (field: keyof BackendConnection, value: string) => {
    setEditingData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // You could add inline validation here if needed.
    onUpdate(editingData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditingData(connection);
    setIsEditing(false);
  };

  // Compact view: show summary details with Edit/Remove buttons.
  //   ${!connection.isActive ? "pointer-events-none" : ""}
  if (!isEditing) {
    return (
      <div
        className={`
            border border-border p-4 rounded-lg mb-1 mt-1
            ${!connection.isActive ? "cursor-not-allowed" : ""}
        `}
      >
        <div
          className={`
            flex justify-between items-center
            ${!connection.isActive ? "opacity-50" : ""}
        `}
        >
          <div>
            <p className="font-semibold">
              {connection.name || "Unnamed Connection"}
            </p>
            <p className="text-sm text-gray-600">{connection.url}</p>
            {connection.token && (
              <p className="text-sm text-gray-600 italic">
                {connection.token.length > 8
                  ? "Token: ****"
                  : `Token: ${connection.token}`}
              </p>
            )}
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
              onClick={() => onRemove(connection.id)}
              className="text-red-600 hover:text-red-800 text-sm"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Edit view: show form fields for editing this connection.
  return (
    <div className="border border-border p-4 rounded-lg mb-4">
      <div className="mb-4">
        <label className="block text-sm font-medium">App Level Name</label>
        <input
          type="text"
          value={editingData.name}
          onChange={(e) => handleChange("name", e.target.value)}
          className="bg-surface-tertiary mt-1 w-full border border-border rounded p-2"
          placeholder="Enter display name"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium">Backend URL</label>
        <input
          type="url"
          value={editingData.url}
          onChange={(e) => handleChange("url", e.target.value)}
          className="bg-surface-tertiary mt-1 w-full border border-border rounded p-2"
          placeholder="https://api.example.com"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium">
          Auth Token (Optional)
        </label>
        <input
          type="text"
          value={editingData.token}
          onChange={(e) => handleChange("token", e.target.value)}
          className="bg-surface-tertiary mt-1 w-full border border-border rounded p-2"
          placeholder="Enter token if required"
        />
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

function SettingsModal({
  backendMetadata,
  onClose,
}: {
  backendMetadata: BackendConnection[];
  onClose: () => void;
}) {
  const fetcher = useFetcher<{ success: boolean }>();
  const [backends, setBackends] =
    useState<BackendConnection[]>(backendMetadata);

  // Update a connection in the state.
  const updateBackend = (updated: BackendConnection) => {
    setBackends((prev) =>
      prev.map((backend) => (backend.id === updated.id ? updated : backend))
    );
  };

  // Remove a connection from the state.
  const removeBackend = (id: string) => {
    setBackends((prev) => prev.filter((backend) => backend.id !== id));
  };

  // Add a new blank connection.
  const addBackend = () => {
    setBackends((prev) => [
      ...prev,
      { id: uuidv4(), name: "", url: "", token: "", isActive: true },
    ]);
  };

  // On form submit, build a single data structure containing all connections.
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetcher.submit(
      {
        intent: "updateBackends",
        backends: JSON.stringify(backends),
      },
      { method: "post" }
    );
  };

  // Close the modal on a successful update.
  useEffect(() => {
    if (fetcher.data && fetcher.data.success) {
      onClose();
    }
  }, [fetcher.data, onClose]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black opacity-80"
        onClick={onClose}
      ></div>
      <div className="border border-border bg-surface-secondary p-6 rounded-lg shadow-lg z-10 w-full max-w-2xl">
        <h2 className="text-lg font-semibold text-content-accent mb-4">
          Configure Connected Backends
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {backends.map((backend) => (
            <BackendConnectionItem
              key={backend.id}
              connection={backend}
              onUpdate={updateBackend}
              onRemove={removeBackend}
            />
          ))}
          <div>
            <button
              type="button"
              onClick={addBackend}
              className="px-4 py-2 rounded bg-green-600 text-content-accent hover:bg-green-700"
            >
              Add Backend Connection
            </button>
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-400 text-content-accent hover:bg-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-600 text-content-accent hover:bg-blue-700"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SettingsModal;
