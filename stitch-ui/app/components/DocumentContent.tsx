import React from "react";
import type { Document as TDocument } from "~/clients/types";

export default function DocumentContent({
  thread,
  document,
}: {
  thread: any;
  document: TDocument;
}) {
  const fileType = document.type || "text/plain";
  const contentUrl =
    thread.location === "local"
      ? `./local/api/${document.content}`
      : `${thread.location}/api/${document.content}`;

  if (
    fileType === "text" ||
    fileType === "text/plain" ||
    fileType === "text/markdown"
  ) {
    return (
      <div className="whitespace-pre-wrap text-sm max-h-40 overflow-y-auto">
        {document.content}
      </div>
    );
  } else if (fileType.startsWith("image/")) {
    return (
      <div className="mt-2">
        <img
          src={contentUrl}
          alt={document.title}
          className="max-h-40 object-contain rounded"
        />
      </div>
    );
  } else if (fileType.startsWith("audio/")) {
    return (
      <div className="mt-2">
        <audio controls className="w-full" src={contentUrl}>
          Your browser does not support the audio element.
        </audio>
      </div>
    );
  } else if (fileType.startsWith("video/")) {
    return (
      <div className="mt-2">
        <video
          controls
          className="max-h-40 w-full object-contain"
          src={contentUrl}
        >
          Your browser does not support the video element.
        </video>
      </div>
    );
  } else {
    // For other file types, show a download link
    return (
      <div className="mt-2">
        <a
          href={contentUrl}
          download={document.title}
          className="text-blue-400 underline flex items-center gap-2"
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Download file
        </a>
      </div>
    );
  }
}
