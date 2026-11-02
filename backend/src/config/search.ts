export const emailIndex = process.env.ELASTIC_INDEX ?? "emails";
if (!/^[a-z][a-z0-9_-]*$/.test(emailIndex))
  throw Error("ELASTIC_INDEX must be a lowercase index name");

/** Shared authenticated transport for local Elasticsearch and Elastic Cloud. */
export function searchFetch(path: string, options: RequestInit = {}) {
  const endpoint = new URL(process.env.ELASTIC_URL!);
  const headers = new Headers(options.headers);
  if (process.env.ELASTIC_API_KEY) {
    headers.set("authorization", `ApiKey ${process.env.ELASTIC_API_KEY}`);
  } else if (process.env.ELASTIC_USERNAME && process.env.ELASTIC_PASSWORD) {
    headers.set("authorization", `Basic ${Buffer.from(`${process.env.ELASTIC_USERNAME}:${process.env.ELASTIC_PASSWORD}`).toString("base64")}`);
  }
  return fetch(`${endpoint.toString().replace(/\/$/, "")}/${path.replace(/^\//, "")}`, { ...options, headers });
}
