"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import { useDebouncedCallback } from "use-debounce";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import "tippy.js/dist/tippy.css";

interface UserOption {
  id: string;
  full_name: string;
}

interface Props {
  initialContent: object | string | null;
  onSave: (json: object) => void;
  editable?: boolean;
  users?: UserOption[];
  resetKey?: number;
}

// ---- Mention list component ----

interface MentionListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const MentionList = forwardRef<MentionListRef, SuggestionProps<UserOption, MentionNodeAttrs>>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) {
        command({ id: item.id, label: item.full_name });
      }
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    useEffect(() => setSelectedIndex(0), [items]);

    if (!items.length) return null;

    return (
      <div
        className="rounded-md shadow-lg overflow-hidden"
        style={{
          background: "#fff",
          border: "1px solid #E9E9E6",
          minWidth: "180px",
          maxHeight: "200px",
          overflowY: "auto",
        }}
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            // onMouseDown + preventDefault keeps editor focus so the suggestion
            // context (command) is still valid when selectItem fires
            onMouseDown={(e) => {
              e.preventDefault();
              selectItem(index);
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "6px 10px",
              fontSize: "13px",
              color: "#37352F",
              background: index === selectedIndex ? "#F7F7F5" : "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            @{item.full_name}
          </button>
        ))}
      </div>
    );
  }
);

MentionList.displayName = "MentionList";

// ---- TiptapEditor ----

export function TiptapEditor({
  initialContent,
  onSave,
  editable = true,
  users,
  resetKey,
}: Props) {
  const debouncedSave = useDebouncedCallback((json: object) => onSave(json), 1000);

  const normalizeContent = (c: object | string | null) => {
    if (!c) return "";
    if (typeof c === "string") {
      try {
        return JSON.parse(c);
      } catch {
        return c;
      }
    }
    return c;
  };

  const mentionExtension = users
    ? Mention.configure({
        HTMLAttributes: { class: "mention" },
        renderHTML({ node }) {
          return ["span", { class: "mention", "data-id": node.attrs.id }, `@${node.attrs.label}`];
        },
        suggestion: {
          items: ({ query }: { query: string }) =>
            users
              .filter((u) => u.full_name.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 5),

          render: () => {
            let component: ReactRenderer<MentionListRef>;
            let popup: TippyInstance[];

            return {
              onStart: (props: SuggestionProps<UserOption, MentionNodeAttrs>) => {
                component = new ReactRenderer(MentionList, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) return;

                popup = tippy("body", {
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                });
              },

              onUpdate: (props: SuggestionProps<UserOption, MentionNodeAttrs>) => {
                component.updateProps(props);
                if (!props.clientRect) return;
                popup[0].setProps({
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                });
              },

              onKeyDown: (props: SuggestionKeyDownProps) => {
                if (props.event.key === "Escape") {
                  popup[0].hide();
                  return true;
                }
                return component.ref?.onKeyDown(props) ?? false;
              },

              onExit: () => {
                popup[0].destroy();
                component.destroy();
              },
            };
          },
        },
      })
    : null;

  const extensions = mentionExtension
    ? [StarterKit, mentionExtension]
    : [StarterKit];

  const editor = useEditor({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extensions: extensions as any,
    content: normalizeContent(initialContent),
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      debouncedSave(editor.getJSON());
    },
    onBlur: ({ editor }) => {
      debouncedSave.flush();
      onSave(editor.getJSON());
    },
  });

  // Clear editor when resetKey changes
  const prevResetKey = useRef(resetKey);
  useEffect(() => {
    if (editor && resetKey !== undefined && resetKey !== prevResetKey.current) {
      prevResetKey.current = resetKey;
      editor.commands.clearContent(true);
    }
  }, [editor, resetKey]);

  if (!editor) return null;

  return (
    <EditorContent
      editor={editor}
      className="prose prose-sm max-w-none min-h-[120px] focus:outline-none border rounded-md p-3 [&_.tiptap]:outline-none"
      style={{ borderColor: "#E9E9E6" }}
    />
  );
}
