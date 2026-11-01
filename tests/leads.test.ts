import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLeads } from "../frontend/src/utils/leads.js";
test("CSV upload handles quoted columns, headers, duplicates and blank rows", () => {
  const result = parseLeads(
    'name,email\n"Doe, Jane",jane@example.com\nJohn,john@example.com\nJane,jane@example.com\n\n',
  );
  assert.deepEqual(result.emails, ["jane@example.com", "john@example.com"]);
  assert.ok(result.ignored > 0);
});
test("plain text accepts newline and semicolon separated leads, rejects invalid values", () => {
  assert.deepEqual(
    parseLeads("a@example.com;b@example.com\ninvalid\n").emails,
    ["a@example.com", "b@example.com"],
  );
  assert.equal(parseLeads("invalid").emails.length, 0);
});
