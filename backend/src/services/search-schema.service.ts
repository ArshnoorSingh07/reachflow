import { emailIndex } from "../config/search.js";
export async function initializeSearch() {
  const response = await fetch(`${process.env.ELASTIC_URL}/${emailIndex}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mappings: {
        properties: {
          id: { type: "keyword" },
          user_id: { type: "text", fields: { keyword: { type: "keyword" } } },
          recipient: { type: "text", fields: { keyword: { type: "keyword" } } },
          subject: { type: "text" },
          body: { type: "text" },
          status: { type: "keyword" },
          scheduled_at: { type: "date" },
          sent_at: { type: "date" },
          version: { type: "integer" },
        },
      },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (response.ok) return;
  const data = (await response.json()) as { error?: { type?: string } };
  if (data.error?.type === "resource_already_exists_exception") return;
  throw Error(`Unable to initialize search index: ${response.status}`);
}
