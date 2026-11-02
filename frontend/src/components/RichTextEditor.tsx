import { useEffect, useState } from "react";
import { EditorContent, useEditor, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  ListOrdered,
  List,
  IndentIncrease,
  IndentDecrease,
  Quote,
  AlignStartVertical,
} from "lucide-react";
const Indent = Extension.create({
  name: "indent",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) =>
              parseInt(element.style.paddingLeft || "0") / 20,
            renderHTML: (attributes) =>
              attributes.indent
                ? { style: `padding-left: ${attributes.indent * 20}px` }
                : {},
          },
        },
      },
    ];
  },
});
export function RichTextEditor({
  onChange,
  disabled,
}: {
  onChange: (text: string, html: string) => void;
  disabled: boolean;
}) {
  const [empty, setEmpty] = useState(true);
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyleKit,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Indent,
    ],
    editable: !disabled,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Message",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => {
      setEmpty(editor.isEmpty);
      onChange(editor.getText(), editor.getHTML());
    },
  });
  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);
  const tool = (
    label: string,
    Icon: typeof Bold,
    run: () => void,
    active = false,
    unavailable = false,
  ) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled || !editor || unavailable}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      <Icon size={17} />
    </button>
  );
  function indent(delta: number) {
    if (!editor) return;
    const type = editor.isActive("heading") ? "heading" : "paragraph";
    const current = editor.getAttributes(type).indent || 0;
    editor
      .chain()
      .focus()
      .updateAttributes(type, {
        indent: Math.max(0, Math.min(4, current + delta)),
      })
      .run();
  }
  return (
    <div className="rich-editor">
      {empty && <span className="rich-placeholder">Type Your Reply...</span>}
      <div
        className="format-toolbar"
        role="toolbar"
        aria-label="Message formatting"
      >
        {tool(
          "Undo",
          Undo2,
          () => editor?.chain().focus().undo().run(),
          false,
          !editor?.can().undo(),
        )}
        {tool(
          "Redo",
          Redo2,
          () => editor?.chain().focus().redo().run(),
          false,
          !editor?.can().redo(),
        )}
        <span className="toolbar-divider" />
        <select
          aria-label="Font family"
          disabled={disabled}
          onChange={(e) =>
            editor?.chain().focus().setFontFamily(e.target.value).run()
          }
          defaultValue="Arial"
        >
          <option>Arial</option>
          <option>Georgia</option>
          <option>monospace</option>
        </select>
        <select
          aria-label="Font size"
          disabled={disabled}
          onChange={(e) =>
            editor?.chain().focus().setFontSize(e.target.value).run()
          }
          defaultValue="14px"
        >
          {[12, 14, 16, 18, 20, 24, 32].map((n) => (
            <option key={n}>{n}px</option>
          ))}
        </select>
        <span className="toolbar-divider" />
        {tool(
          "Bold",
          Bold,
          () => editor?.chain().focus().toggleBold().run(),
          editor?.isActive("bold"),
        )}
        {tool(
          "Italic",
          Italic,
          () => editor?.chain().focus().toggleItalic().run(),
          editor?.isActive("italic"),
        )}
        {tool(
          "Underline",
          Underline,
          () => editor?.chain().focus().toggleUnderline().run(),
          editor?.isActive("underline"),
        )}
        <span className="toolbar-divider" />
        <select
          aria-label="Text alignment"
          disabled={disabled}
          onChange={(e) =>
            editor?.chain().focus().setTextAlign(e.target.value).run()
          }
          defaultValue="left"
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
          <option value="justify">Justify</option>
        </select>
        <span className="toolbar-divider" />
        {tool(
          "Numbered list",
          ListOrdered,
          () => editor?.chain().focus().toggleOrderedList().run(),
          editor?.isActive("orderedList"),
        )}
        {tool(
          "Bullet list",
          List,
          () => editor?.chain().focus().toggleBulletList().run(),
          editor?.isActive("bulletList"),
        )}
        {tool("Increase indent", IndentIncrease, () => indent(1))}
        {tool("Decrease indent", IndentDecrease, () => indent(-1))}
        {tool(
          "Block quote",
          Quote,
          () => editor?.chain().focus().toggleBlockquote().run(),
          editor?.isActive("blockquote"),
        )}
        {tool(
          "Heading",
          AlignStartVertical,
          () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
          editor?.isActive("heading"),
        )}
        <span className="toolbar-divider" />
        {tool(
          "Strikethrough",
          Strikethrough,
          () => editor?.chain().focus().toggleStrike().run(),
          editor?.isActive("strike"),
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
