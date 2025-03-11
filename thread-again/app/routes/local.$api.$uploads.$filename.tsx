import type { LoaderFunction } from "@remix-run/node";

export const loader: LoaderFunction = async ({ request, params, context }) => {
  const url = new URL(request.url);
  const storageClients = context.storageClients;

  if (!("local" in storageClients)) {
    throw new Error("No local store available");
  }

  // @ts-ignore
  const localBucket = storageClients["local"].bucket;
  const lastSegment = url.pathname.split("/").pop();
  const file = await localBucket.get(`uploads/${lastSegment}`);
  const extSplit = url.pathname.split(".");
  if (extSplit.length < 2) {
    throw new Error("Invalid file name");
  }
  const ext = extSplit[1];
  return new Response(file, {
    headers: {
      "Content-Type": `image/${ext}`,
    },
  });
};
