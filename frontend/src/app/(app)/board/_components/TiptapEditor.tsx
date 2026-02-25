"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { useDebouncedCallback } from "use-debounce";

interface Props {
  initialContent: object | null;
  onSave: (json: object) => void;
  editable?: boolean;
}

export function TiptapEditor({ initialContent, onSave, editable = true }: Props) {
  const debouncedSave = useDebouncedCallback((json: object) => onSave(json), 1000);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent ?? "",
    editable,
    immediatelyRender: false,  // CRITICAL: prevents Next.js SSR hydration mismatch
    onUpdate: ({ editor }) => {
      debouncedSave(editor.getJSON());
    },
    onBlur: ({ editor }) => {
      debouncedSave.flush();
      onSave(editor.getJSON());
    },
  });

  if (!editor) return null;

  return (
    <EditorContent
      editor={editor}
      className="prose prose-sm max-w-none min-h-[120px] focus:outline-none border border-slate-200 rounded-md p-3 [&_.tiptap]:outline-none"
    />
  );
}
