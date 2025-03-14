import type { LoaderFunction } from "@remix-run/node";

export const loader: LoaderFunction = async ({ request, params, context }) => {
  const url = new URL(request.url);
  const storageClients = context.storageClients;

  if (!("local" in storageClients)) {
    throw new Error("No local store available");
  }

  // @ts-ignore
  const localBucket = storageClients["local"].bucket;
  const lastSegment = url.pathname.split("/").pop() || "";

  // Define the file path for bucket - support both formats
  const filePath = lastSegment.includes('uploads/')
    ? lastSegment
    : `uploads/${lastSegment}`;

  const file = await localBucket.get(filePath);

  if (!file) {
    return new Response("File not found", { status: 404 });
  }

  // Determine the content type based on the file extension
  const fileExt = lastSegment.split('.').pop()?.toLowerCase() || "";

  // Map common extensions to MIME types
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'mp4': 'video/mp4',
    'mp3': 'audio/mpeg'
  };

  const contentType = mimeTypes[fileExt] || 'application/octet-stream';

  return new Response(file, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000"
    },
  });
};
