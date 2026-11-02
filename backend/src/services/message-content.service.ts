import sanitizeHtml from "sanitize-html";
import { convert } from "html-to-text";
export function sanitizeRichText(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "strike",
      "span",
      "h1",
      "h2",
      "h3",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "a",
      "hr",
    ],
    allowedAttributes: { a: ["href", "title"], "*": ["style"] },
    allowedSchemes: ["https", "http", "mailto"],
    allowProtocolRelative: false,
    allowedStyles: {
      "*": {
        "text-align": [/^(left|center|right|justify)$/],
        "font-size": [/^(12|14|16|18|20|24|32)px$/],
        "font-family": [/^(Arial|Georgia|monospace|sans-serif)$/],
        "padding-left": [/^(20|40|60|80)px$/],
      },
    },
  });
}
export function richTextToPlain(html: string) {
  return convert(html, { wordwrap: false });
}
export type AttachmentInput = { name: string; type: string; data: string };
export function decodeAttachment(file: AttachmentInput) {
  const content = Buffer.from(file.data, "base64");
  const fail = () => {
    throw Object.assign(
      new Error("Attachment content does not match its file type."),
      { status: 400 },
    );
  };
  const formats: Record<string, () => boolean> = {
    "image/png": () =>
      content
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/jpeg": () =>
      content[0] === 255 && content[1] === 216 && content[2] === 255,
    "image/gif": () => /^GIF8[79]a$/.test(content.subarray(0, 6).toString()),
    "image/webp": () =>
      content.subarray(0, 4).toString() === "RIFF" &&
      content.subarray(8, 12).toString() === "WEBP",
    "application/pdf": () => content.subarray(0, 5).toString() === "%PDF-",
    "text/plain": () =>
      !content.includes(0) &&
      Buffer.from(content.toString("utf8")).equals(content),
    "text/csv": () =>
      !content.includes(0) &&
      Buffer.from(content.toString("utf8")).equals(content),
  };
  if (
    !formats[file.type]?.() ||
    !content.length ||
    content.length > 5 * 1024 * 1024
  )
    fail();
  return content;
}
