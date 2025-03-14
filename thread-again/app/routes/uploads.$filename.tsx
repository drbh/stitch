import { LoaderFunctionArgs } from "@remix-run/node";
import { join } from "path";
import { createReadStream, statSync } from "fs";
import mime from "mime-types";

// TODO: improve this to handle differently depending on the storage client
// (e.g. D1, SQLite, REST)

/**
 * Serve a file from the uploads directory.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    // Get the filename from the URL and params
    const filename = params.filename || "";

    if (!filename) {
      return new Response("File not found", { status: 404 });
    }

    // Construct the full path to the file
    const uploadsDir = join(process.cwd(), "local_bucket", "uploads");
    const filePath = join(uploadsDir, filename);

    // Check if file exists and get its stats
    try {
      const stats = statSync(filePath);
      if (!stats.isFile()) {
        return new Response("File not found", { status: 404 });
      }
    } catch (error) {
      return new Response("File not found", { status: 404 });
    }

    // Create a readable stream of the file
    const fileStream = createReadStream(filePath);

    // Determine the content type
    const contentType = mime.lookup(filePath) || "application/octet-stream";

    // Return the file as a stream
    return new Response(fileStream as any, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("Error serving file:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
