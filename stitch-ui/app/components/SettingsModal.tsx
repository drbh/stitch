import { useState, useEffect, Suspense } from "react";
import { v4 as uuidv4 } from "uuid";
import { useFetcher, Await } from "@remix-run/react";
import { BackendConnection, APIKey } from "~/clients/types";
import { useTheme } from "./ThemeContext";

interface BackendConnectionItemProps {
  connection: BackendConnection;
  onUpdate: (updated: BackendConnection) => void;
  onRemove: (id: string) => void;
  onCancel: () => void;
  isEditingOpen?: boolean;
}

function AppearanceSettings() {
  const { theme, toggleTheme, accentColor, setAccentColor } = useTheme();

  // Predefined accent color options
  const accentColorOptions = [
    { name: "Blue-Purple", value: "#382c83" },
    { name: "Deep Blue", value: "#0369a1" },
    { name: "Teal", value: "#0d9488" },
    { name: "Green", value: "#16a34a" },
    { name: "Purple", value: "#7e22ce" },
    { name: "Red", value: "#dc2626" },
    { name: "Orange", value: "#ea580c" },
  ];

  return (
    <div className="border border-border p-4 rounded-lg mb-4">
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Theme</label>
        <div className="flex items-center space-x-4">
          <div
            className={`flex items-center space-x-2 p-3 rounded-lg cursor-pointer transition-colors ${
              theme === "dark"
                ? "bg-blue-600 text-content-accent"
                : "bg-interactive hover:bg-interactive-hover"
            }`}
            onClick={() => theme !== "dark" && toggleTheme()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
            <span>Dark</span>
          </div>

          <div
            className={`flex items-center space-x-2 p-3 rounded-lg cursor-pointer transition-colors ${
              theme === "light"
                ? "bg-blue-600 text-content-accent"
                : "bg-interactive hover:bg-interactive-hover"
            }`}
            onClick={() => theme !== "light" && toggleTheme()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <span>Light</span>
          </div>
        </div>
        <p className="mt-2 text-sm text-content-tertiary">
          You can also toggle the theme using the button in the top navigation
          bar.
        </p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Accent Color</label>
        <div className="grid grid-cols-4 gap-3 mb-3">
          {accentColorOptions.map((option) => (
            <div
              key={option.value}
              className={`flex flex-col items-center cursor-pointer`}
              onClick={() => setAccentColor(option.value)}
            >
              <div
                className={`w-10 h-10 rounded-full mb-1 border-2 ${
                  accentColor === option.value
                    ? "border-content-primary"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: option.value }}
              />
              <span className="text-xs">{option.name}</span>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium mb-2">Custom Color</label>
          <div className="flex items-center space-x-3">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer"
            />
            <input
              type="text"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="bg-surface-tertiary border border-border rounded p-2 w-28"
              placeholder="#000000"
            />
          </div>
          <p className="mt-2 text-sm text-content-tertiary">
            This color will be used for buttons, selected items, and interactive
            elements.
          </p>
        </div>
      </div>
    </div>
  );
}

function BackendConnectionItem({
  connection,
  onUpdate,
  onRemove,
  onCancel,
  isEditingOpen = false,
}: BackendConnectionItemProps) {
  const [isEditing, setIsEditing] = useState(isEditingOpen);
  const [editingData, setEditingData] = useState<BackendConnection>(connection);

  useEffect(() => {
    if (!isEditing) {
      setEditingData(connection);
    }
  }, [connection, isEditing]);

  const handleChange = (field: keyof BackendConnection, value: string) => {
    setEditingData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onUpdate(editingData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    setEditingData(connection);
    setIsEditing(false);
  };

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

//
// Settings Modal with Sidebar for Toggling Views
//
type SettingsView = "backends" | "appearance";

function SettingsModal({
  backendMetadata,
  activeThreadApiKeys,
  onClose,
}: {
  backendMetadata: BackendConnection[];
  activeThreadApiKeys: Promise<APIKey[]>;
  onClose: () => void;
}) {
  const fetcher = useFetcher<{ success: boolean }>();
  const [backends, setBackends] =
    useState<BackendConnection[]>(backendMetadata);
  const [selectedView, setSelectedView] = useState<SettingsView>("backends");
  const [editingBackendId, setEditingBackendId] = useState<string | null>(null);

  // Backend-related handlers
  const updateBackend = (updated: BackendConnection) => {
    setBackends((prev) =>
      prev.map((backend) => (backend.id === updated.id ? updated : backend))
    );
  };

  const removeBackend = (id: string) => {
    setBackends((prev) => prev.filter((backend) => backend.id !== id));
  };

  const addBackend = () => {
    const backendId = uuidv4();
    setBackends((prev) => [
      ...prev,
      { id: backendId, name: "", url: "", token: "", isActive: true },
    ]);

    // use the backendId to open the modal for the new backend once its added
    setEditingBackendId(backendId);
  };

  useEffect(() => {
    if (editingBackendId) {
      console.log("editingBackendId", editingBackendId);
    }
  }, [editingBackendId]);

  // TODO: refactor and consolidate all the API key logic

  // API Key-related handlers
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

  const createApiKey = async () => {
    fetcher.submit(
      {
        intent: "createApiKey",
      },
      { method: "post" }
    );
  };

  // On form submit, package both backend and API key data.
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetcher.submit(
      {
        intent: "updateSettings",
        backends: JSON.stringify(backends),
        apiKeys: JSON.stringify({}),
      },
      { method: "post" }
    );

    // close the modal
    onClose();
  };

  // Close the modal upon a successful update.
  useEffect(() => {
    if (fetcher.data && fetcher.data.success) {
      // onClose();
    }
  }, [fetcher.data, onClose]);

  return (
    <div
      // fixed slightly down from the top
      className="fixed inset-x-0 top-24 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black opacity-80"
        onClick={onClose}
      ></div>
      <div className="z-[1000] min-h-[80vh] bg-surface-secondary border border-border p-6 rounded-lg w-full max-w-4xl flex">
        {/* Sidebar */}
        <div className="w-1/4 border-r border-border pr-4">
          <h3 className="text-lg font-semibold text-content-accent mb-4 ">
            Settings
          </h3>
          <ul className="space-y-2">
            <li>
              <button
                type="button"
                onClick={() => setSelectedView("backends")}
                className={`w-full text-left px-2 py-1 rounded ${
                  selectedView === "backends"
                    ? "bg-blue-600 text-content-accent"
                    : "hover:bg-interactive-hover"
                }`}
              >
                Backends
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setSelectedView("appearance")}
                className={`w-full text-left px-2 py-1 rounded ${
                  selectedView === "appearance"
                    ? "bg-blue-600 text-content-accent"
                    : "hover:bg-interactive-hover"
                }`}
              >
                Appearance
              </button>
            </li>
          </ul>
        </div>
        {/* Main Content Area */}
        <div className="flex-grow pl-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {selectedView === "backends" && (
              <div>
                <h2 className="text-lg font-semibold text-content-accent mb-4">
                  Configure Connected Backends
                </h2>
                {backends.map((backend) => (
                  <BackendConnectionItem
                    key={backend.id}
                    connection={backend}
                    onUpdate={updateBackend}
                    onRemove={removeBackend}
                    onCancel={() => {
                      // if the backend is new, remove it
                      if (!backend.name && !backend.url) {
                        removeBackend(backend.id);
                      }
                      setEditingBackendId(null);
                    }}
                    isEditingOpen={editingBackendId === backend.id}
                  />
                ))}
                <button
                  type="button"
                  onClick={addBackend}
                  className="px-4 py-2 rounded bg-blue-600 text-content-accent hover:bg-blue-700"
                >
                  Add Backend Connection
                </button>
              </div>
            )}

            {selectedView === "appearance" && (
              <div>
                <h2 className="text-lg font-semibold text-content-accent mb-4">
                  Appearance Settings
                </h2>
                <AppearanceSettings />
              </div>
            )}
            <div className="flex justify-end space-x-3 pt-4">
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
    </div>
  );
}

export default SettingsModal;
