import type { Email, Sender, Stats } from "../../frontend/src/types";
export const previewSenders: Sender[] = [
  {
    id: "preview-alex",
    name: "Alex Morgan",
    email: "alex.morgan@ethereal.email",
  },
  {
    id: "preview-team",
    name: "The partnerships team",
    email: "partnerships@ethereal.email",
  },
];
export const previewStats: Stats = {
  scheduled: 8,
  sent: 6,
  failed: 2,
  sentToday: 6,
};
export function previewEmails(sent = false): Email[] {
  return [
    "olivia@northstar.co",
    "james@linearstudio.io",
    "sophia@lumalabs.co",
    "noah@craftwork.design",
    "emma@orbitapp.io",
    "liam@buildspace.so",
    "ava@madeby.studio",
    "leo@daylight.co",
  ].map((recipient, i) => ({
    id: `preview-${i}`,
    recipient,
    subject: [
      "A quick idea for your team",
      "Let’s build something great",
      "Following up on our conversation",
      "Your next chapter starts here",
      "A better way to reach your audience",
      "Something worth exploring",
      "A little inspiration for your inbox",
      "A fresh perspective on growth",
    ][i],
    body: "Hi there,\n\nI came across your team’s work and wanted to share a quick idea. I think there’s a great opportunity for us to collaborate.\n\nWould you be open to a short conversation this week?\n\nBest,\nAlex",
    status: sent
      ? i === 3
        ? "failed"
        : i === 6
          ? "uncertain"
          : "sent"
      : i === 0
        ? "sending"
        : "scheduled",
    scheduled_at: new Date(
      Date.now() + (sent ? -1 : 1) * (i + 1) * 1800000,
    ).toISOString(),
    sent_at:
      sent && i !== 3 && i !== 6
        ? new Date(Date.now() - (i + 1) * 1800000).toISOString()
        : null,
    sender_id: previewSenders[i % 2].id,
    sender_name: previewSenders[i % 2].name,
    sender_email: previewSenders[i % 2].email,
    error:
      sent && i === 3
        ? "SMTP connection could not be established."
        : sent && i === 6
          ? "Delivery outcome requires a manual review in Ethereal."
          : undefined,
    delay_ms: 2000,
    hourly_limit: 200,
  }));
}
