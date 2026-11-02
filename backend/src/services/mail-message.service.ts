/** Build MIME content from persisted, sanitized message data. */
export function mailMessage(
  email: {
    id: string;
    sender_email: string;
    recipient: string;
    subject: string;
    body: string;
    body_html?: string | null;
  },
  files: { name: string; content_type: string; content: Buffer }[],
) {
  return {
    from: email.sender_email,
    to: email.recipient,
    subject: email.subject,
    text: email.body,
    html: email.body_html || undefined,
    messageId: `<${email.id}@reachflow.local>`,
    attachments: files.map((file) => ({
      filename: file.name,
      contentType: file.content_type,
      content: file.content,
    })),
  };
}
