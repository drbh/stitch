import React, { useState, useRef } from "react";
import { Suspense } from "react";
import { Await, useFetcher } from "@remix-run/react";
import type { Document as TDocument } from "~/clients/types";
import CloseIcon from "./CloseIcon";
import DocumentContent from "./DocumentContent";
import { getFileTypeIcon } from "./FileIcons";

export default function DocumentsTab({
  thread,
  isShareUrl,
  handleDocumentSubmit,
  activeThreadDocuments,
  handleDocumentRemove,
}: {
  thread: any;
  isShareUrl: boolean;
  handleDocumentSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  activeThreadDocuments: Promise<TDocument[]>;
  handleDocumentRemove: (e: React.MouseEvent, docId: string) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [view, setView] = useState<"grid" | "list">("list");
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fetcher = useFetcher();
  const dragAreaRef = useRef<HTMLDivElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    // Validate file size (limit to 20MB)
    if (file.size > 20 * 1024 * 1024) {
      alert("File size must be less than 20MB");
      return;
    }

    setSelectedFile(file);
    setTitle(file.name);

    // Create a preview for image files
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }

    // For text files, read the content
    if (file.type.startsWith("text/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setContent(e.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const clearFileSelection = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setTitle("");
    setContent("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!title) {
      alert("Please provide a title");
      return;
    }

    if (selectedFile) {
      // Create a FormData object to handle file uploads
      const formData = new FormData();
      formData.append("intent", "createDocument");
      formData.append("title", title);
      formData.append("file", selectedFile);
      formData.append("type", selectedFile.type || "application/octet-stream");

      fetcher.submit(formData, {
        method: "post",
        encType: "multipart/form-data",
      });

      clearFileSelection();
    } else if (content) {
      // If it's just text content
      fetcher.submit(
        {
          intent: "createDocument",
          title,
          content,
          type: "text",
        },
        { method: "post" }
      );

      clearFileSelection();
    } else {
      alert("Please add content or select a file");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-content-accent">Documents</h2>

        {/* View toggle and search */}
        <div className="flex gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 bg-surface-secondary border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 pl-8"
            />
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
              className="absolute left-2.5 top-2.5 text-gray-400"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>

          <div className="flex bg-surface-secondary rounded-md overflow-hidden border border-border">
            <button
              onClick={() => setView("grid")}
              className={`px-2.5 py-1.5 ${
                view === "grid" ? "bg-blue-600" : "hover:bg-surface-tertiary"
              }`}
              title="Grid view"
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
              >
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-2.5 py-1.5 ${
                view === "list" ? "bg-blue-600" : "hover:bg-surface-tertiary"
              }`}
              title="List view"
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
              >
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {!isShareUrl && (
        <div
          ref={dragAreaRef}
          className={`bg-surface-primary rounded-lg p-6 ${
            isDragging
              ? "border border-dashed border-blue-600"
              : "border border-border"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <h3 className="text-lg font-semibold text-content-accent mb-4">
            Add Document
          </h3>

          {/* File selector area */}
          {!selectedFile && (
            <div className="flex flex-col items-center justify-center p-8 bg-surface-primary rounded-lg border border-dashed border-border mb-4">
              <div className="text-gray-400 mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>
              <p className="text-center text-gray-300 mb-2">
                Drag & drop files here or click to browse
              </p>
              <p className="text-center text-gray-400 text-sm">
                Supports all file types up to 20MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                Choose file
              </button>
            </div>
          )}

          {/* Selected file preview */}
          {selectedFile && (
            <div className="mb-4 p-4 bg-surface-secondary rounded-lg border border-border">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  {getFileTypeIcon(selectedFile.type)}
                  <div>
                    <p className="font-medium text-gray-200">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {selectedFile.type || "Unknown type"} •{" "}
                      {(selectedFile.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={clearFileSelection}
                  className="text-gray-400 hover:text-white p-1"
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
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* Image preview if applicable */}
              {filePreview && (
                <div className="mt-4 flex justify-center">
                  <img
                    src={filePreview}
                    alt="Preview"
                    className="max-h-40 object-contain rounded"
                  />
                </div>
              )}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* <div>
              <label
                htmlFor="docTitle"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Document Title
              </label>
              <input
                id="docTitle"
                type="text"
                placeholder="Document Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 bg-surface-secondary border border-border rounded-lg focus:ring-2 focus:ring-border-focus focus:border-transparent"
              />
            </div> */}

            {/* Only show content textarea if no file is selected or it's a text file */}
            {/* {(!selectedFile || selectedFile.type.startsWith("text/")) && (
              <div>
                <label
                  htmlFor="docContent"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Document Content
                </label>
                <textarea
                  id="docContent"
                  placeholder="Document Content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-4 py-2 h-32 bg-surface-secondary border border-border rounded-lg resize-none focus:ring-2 focus:ring-border-focus focus:border-transparent"
                />
              </div>
            )} */}

            <button
              type="submit"
              className="w-full px-4 py-2 bg-interactive hover:bg-interactive-hover active:bg-interactive-active text-content-primary font-medium rounded-lg transition-colors"
            >
              {fetcher.state === "submitting" ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Uploading...
                </span>
              ) : (
                "Add Document"
              )}
            </button>
          </form>
        </div>
      )}

      <div>
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="animate-pulse bg-surface-secondary p-4 rounded-lg h-24"></div>
              <div className="animate-pulse bg-surface-secondary p-4 rounded-lg h-24"></div>
            </div>
          }
        >
          <Await resolve={activeThreadDocuments}>
            {(documents) => {
              if (!documents || documents.length === 0) {
                return (
                  <div className="text-center text-gray-400 py-12">
                    <svg
                      className="mx-auto h-12 w-12 mb-4 text-gray-500"
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    <p className="text-lg">No documents found</p>
                    <p className="text-sm">
                      Upload your first file to get started
                    </p>
                  </div>
                );
              }

              // Filter documents based on search term
              const filteredDocuments = searchTerm
                ? documents.filter(
                    (doc) =>
                      doc.title
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase()) ||
                      doc.content
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase())
                  )
                : documents;

              return view === "grid" ? (
                // Grid view
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDocuments.map((document) => (
                    <div
                      key={document.id}
                      className="bg-surface-primary rounded-lg overflow-hidden border border-border hover:bg-surface-secondary transition-colors"
                    >
                      <div className="p-4 h-64 overflow-y-auto">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            {getFileTypeIcon(document.type)}
                            <h3 className="font-medium text-white truncate max-w-[200px]">
                              {document.title.length > 10
                                ? document.title.slice(0, 10) + "..."
                                : document.title}
                            </h3>
                          </div>
                          {!isShareUrl && (
                            <button
                              className="text-gray-400 hover:text-red-400 transition-colors"
                              onClick={(e) =>
                                handleDocumentRemove(e, document.id)
                              }
                              title="Delete document"
                            >
                              <CloseIcon />
                            </button>
                          )}
                        </div>
                        <div className="text-sm text-gray-400 mb-2">
                          {new Date(document.created_at).toLocaleDateString()} •
                          {document.view_count} views
                        </div>
                        <DocumentContent thread={thread} document={document} />
                      </div>
                      <div className="px-4 py-2 bg-surface-secondary border-t border-border">
                        <div className="flex justify-end">
                          <a
                            href={document.content}
                            download={document.title}
                            className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="7 10 12 15 17 10"></polyline>
                              <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Download
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // List view
                <ul className="space-y-2 divide-y divide-border">
                  {filteredDocuments.map((document) => (
                    <li key={document.id} className="pt-2 first:pt-0 ">
                      <div className="flex items-center justify-between bg-surface-primary border border-border p-4 rounded-lg hover:bg-surface-secondary transition-colors">
                        <div className="flex items-center gap-3">
                          {getFileTypeIcon(document.type)}
                          <div>
                            <h3 className="font-medium text-white">
                              {document.title}
                            </h3>
                            <div className="text-xs text-gray-400">
                              {new Date(
                                document.created_at
                              ).toLocaleDateString()}{" "}
                              •{document.view_count} views
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <a
                            href={document.content}
                            download={document.title}
                            className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="7 10 12 15 17 10"></polyline>
                              <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Download
                          </a>
                          {!isShareUrl && (
                            <button
                              className="text-gray-400 hover:text-red-400 transition-colors"
                              onClick={(e) =>
                                handleDocumentRemove(e, document.id)
                              }
                              title="Delete document"
                            >
                              <CloseIcon />
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              );
            }}
          </Await>
        </Suspense>
      </div>
    </div>
  );
}
