import type { EmailStatus } from "../types";
export function StatusBadge({ status }: { status: EmailStatus }) {
  return (
    <span className={`badge ${status}`}>
      <span />
      {
        {
          scheduled: "Scheduled",
          sending: "Sending",
          sent: "Delivered",
          failed: "Failed",
          uncertain: "Needs review",
        }[status]
      }
    </span>
  );
}
