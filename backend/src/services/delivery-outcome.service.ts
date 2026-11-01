export type DeliveryFailure = "retryable" | "failed" | "uncertain";
// Explicit SMTP rejection is safe to classify. A missing reply may mean the server accepted DATA.
export function classifyDeliveryFailure(error: unknown): DeliveryFailure {
  if (typeof error !== "object" || error === null) return "uncertain";
  const response = (error as { responseCode?: unknown }).responseCode;
  if (typeof response === "number" && response >= 400 && response < 500)
    return "retryable";
  if (typeof response === "number" && response >= 500 && response < 600)
    return "failed";
  return "uncertain";
}
