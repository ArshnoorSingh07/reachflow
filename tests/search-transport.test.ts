import { test } from "node:test";
import assert from "node:assert/strict";
import { searchFetch } from "../backend/src/config/search.js";

test("cloud search transport adds credentials to every request without losing headers", async () => {
  const originalFetch = globalThis.fetch;
  const saved = { ...process.env };
  try {
    process.env.ELASTIC_URL = "https://search.example.test/";
    process.env.ELASTIC_API_KEY = "encoded-test-key";
    globalThis.fetch = (async (url, options) => {
      assert.equal(url, "https://search.example.test/emails/_search");
      const headers = new Headers(options?.headers);
      assert.equal(headers.get("authorization"), "ApiKey encoded-test-key");
      assert.equal(headers.get("content-type"), "application/json");
      return new Response("{}");
    }) as typeof fetch;
    await searchFetch("/emails/_search", { headers: { "content-type": "application/json" } });
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of ["ELASTIC_URL", "ELASTIC_API_KEY"]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
