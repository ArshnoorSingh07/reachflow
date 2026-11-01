import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyDeliveryFailure } from "../backend/src/services/delivery-outcome.service.js";
test("explicit temporary SMTP rejection can retry, permanent rejection fails", () => {
  assert.equal(classifyDeliveryFailure({ responseCode: 421 }), "retryable");
  assert.equal(classifyDeliveryFailure({ responseCode: 550 }), "failed");
});
test("missing SMTP reply never causes an automatic resend", () => {
  assert.equal(
    classifyDeliveryFailure(new Error("Socket closed after DATA")),
    "uncertain",
  );
  assert.equal(classifyDeliveryFailure({ code: "ETIMEDOUT" }), "uncertain");
  assert.equal(classifyDeliveryFailure(null), "uncertain");
});
