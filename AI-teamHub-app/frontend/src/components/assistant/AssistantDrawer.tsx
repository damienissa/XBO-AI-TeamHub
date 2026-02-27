"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Trash2,
  Send,
  Loader2,
  Ticket,
  Sparkles,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api/client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface TicketContext {
  title?: string;
  status?: string;
  department?: string;
  urgency?: string;
  problem_statement?: string;
  business_impact?: string;
  success_criteria?: string;
  subtasks?: string[];
  [key: string]: unknown;
}

// Custom event names for cross-component communication
const INJECT_EVENT = "assistant:inject-ticket";
const OPEN_EVENT = "assistant:open";

/** Dispatch from any component to inject a ticket into Alex and open the drawer. */
export function injectTicketIntoAssistant(ticket: TicketContext) {
  window.dispatchEvent(new CustomEvent(INJECT_EVENT, { detail: ticket }));
}

const SUGGESTIONS = [
  "How do I add a new Alembic migration?",
  "Review this ticket and suggest subtasks",
  "What's the auth flow in this app?",
];

export function AssistantDrawer() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [injectedCtx, setInjectedCtx] = useState<TicketContext | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cmd+K / Ctrl+K to toggle
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Cross-component events: inject ticket context
  useEffect(() => {
    function onInject(e: Event) {
      const ctx = (e as CustomEvent<TicketContext>).detail;
      setInjectedCtx(ctx);
      setOpen(true);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Ticket context loaded: **${ctx.title ?? "Untitled"}**.\n\nI can now answer questions about this ticket. What do you need?`,
        },
      ]);
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener(INJECT_EVENT, onInject);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener(INJECT_EVENT, onInject);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when drawer opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  const clearConversation = useCallback(async () => {
    abortRef.current?.abort();
    if (convId) {
      await fetchWithAuth(`${API}/api/assistant/chat/${convId}`, {
        method: "DELETE",
      });
    }
    setMessages([]);
    setConvId(null);
    setInjectedCtx(null);
    setStreaming(false);
  }, [convId]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: text },
      { id: assistantMsgId, role: "assistant", content: "", streaming: true },
    ]);
    setInput("");
    setStreaming(true);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetchWithAuth(`${API}/api/assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversation_id: convId,
          ticket_context: injectedCtx ?? undefined,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();

          if (payload === "[DONE]") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, streaming: false } : m
              )
            );
            setStreaming(false);
            return;
          }

          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: m.content + parsed.text }
                    : m
                )
              );
            }
            if (parsed.conversation_id) {
              setConvId(parsed.conversation_id);
            }
            if (parsed.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: `Error: ${parsed.error}`,
                        streaming: false,
                      }
                    : m
                )
              );
              setStreaming(false);
              return;
            }
          } catch {
            // skip malformed JSON lines
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: "Connection error — please try again.",
                  streaming: false,
                }
              : m
          )
        );
      }
      setStreaming(false);
    }
  }, [input, streaming, convId, injectedCtx]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl select-none"
        style={{ background: "#37352F", color: "#fff" }}
        title="Ask Alex (⌘K)"
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium" style={{ fontFamily: "DM Sans, sans-serif" }}>
          Ask Alex
        </span>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/10"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex flex-col transition-transform duration-300 ease-in-out"
        style={{
          width: "420px",
          background: "#fff",
          borderLeft: "1px solid #E9E9E6",
          boxShadow: open ? "-8px 0 32px rgba(0,0,0,0.08)" : "none",
          transform: open ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: "#E9E9E6" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ background: "#37352F" }}
            >
              A
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight" style={{ color: "#37352F" }}>
                Alex
              </p>
              <p className="text-xs leading-tight" style={{ color: "#9B9A97" }}>
                Senior Tech Lead · XBO
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clearConversation}
                className="p-1.5 rounded-md transition-colors"
                style={{ color: "#9B9A97" }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = "#E03E3E")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = "#9B9A97")
                }
                title="Clear conversation"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: "#9B9A97" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.color = "#37352F")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.color = "#9B9A97")
              }
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Injected context banner ── */}
        {injectedCtx && (
          <div
            className="flex items-center justify-between px-4 py-2 text-xs border-b flex-shrink-0"
            style={{
              background: "#F0F7FF",
              borderColor: "#D0E6FA",
              color: "#2383E2",
            }}
          >
            <span className="flex items-center gap-1.5">
              <Ticket className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">
                Context:{" "}
                <strong>{injectedCtx.title ?? "Current ticket"}</strong>
              </span>
            </span>
            <button
              onClick={() => setInjectedCtx(null)}
              className="flex-shrink-0 ml-2"
              style={{ color: "#9B9A97" }}
              title="Remove context"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center pb-8">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold"
                style={{ background: "#37352F" }}
              >
                A
              </div>
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "#37352F", fontFamily: "DM Sans, sans-serif" }}
                >
                  Hey, I&apos;m Alex
                </p>
                <p
                  className="text-xs mt-1.5 leading-relaxed max-w-[260px]"
                  style={{ color: "#9B9A97" }}
                >
                  Senior tech lead at XBO. Ask me about the codebase, tickets,
                  architecture decisions, or anything dev-related.
                </p>
              </div>
              <div className="flex flex-col gap-1.5 w-full max-w-[280px]">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s);
                      inputRef.current?.focus();
                    }}
                    className="text-left px-3 py-2 rounded-lg text-xs transition-colors"
                    style={{
                      background: "#F7F7F5",
                      color: "#37352F",
                      border: "1px solid #E9E9E6",
                      fontFamily: "DM Sans, sans-serif",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.background =
                        "#EFEFE9")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.background =
                        "#F7F7F5")
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Alex avatar */}
                {msg.role === "assistant" && (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{ background: "#37352F" }}
                  >
                    A
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className="max-w-[82%] px-3 py-2.5 rounded-2xl text-sm leading-relaxed"
                  style={
                    msg.role === "user"
                      ? {
                          background: "#2383E2",
                          color: "#fff",
                          borderBottomRightRadius: "4px",
                          fontFamily: "DM Sans, sans-serif",
                        }
                      : {
                          background: "#F7F7F5",
                          color: "#37352F",
                          border: "1px solid #E9E9E6",
                          borderBottomLeftRadius: "4px",
                          whiteSpace: "pre-wrap",
                          fontFamily: "DM Sans, sans-serif",
                          wordBreak: "break-word",
                        }
                  }
                >
                  {msg.streaming && !msg.content ? (
                    <span
                      className="flex items-center gap-1.5"
                      style={{ color: "#9B9A97" }}
                    >
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span className="text-xs">Thinking…</span>
                    </span>
                  ) : (
                    msg.content
                  )}
                  {/* Streaming cursor */}
                  {msg.streaming && msg.content && (
                    <span
                      className="inline-block w-1.5 h-3.5 ml-0.5 animate-pulse rounded-sm"
                      style={{
                        background: "#9B9A97",
                        verticalAlign: "text-bottom",
                      }}
                    />
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input area ── */}
        <div
          className="border-t flex-shrink-0 p-3"
          style={{ borderColor: "#E9E9E6", background: "#FAFAF9" }}
        >
          <div
            className="flex items-end gap-2 rounded-xl border px-3 py-2 transition-colors"
            style={{ borderColor: "#E9E9E6", background: "#fff" }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Alex anything…"
              rows={1}
              disabled={streaming}
              className="flex-1 resize-none outline-none text-sm bg-transparent py-0.5 leading-relaxed"
              style={{
                color: "#37352F",
                maxHeight: "120px",
                fontFamily: "DM Sans, sans-serif",
              }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
              className="flex-shrink-0 p-1.5 rounded-lg transition-all duration-150"
              style={{
                background:
                  input.trim() && !streaming ? "#2383E2" : "#E9E9E6",
                color: input.trim() && !streaming ? "#fff" : "#9B9A97",
              }}
              title="Send (Enter)"
            >
              {streaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p
            className="text-center text-xs mt-1.5"
            style={{ color: "#C7C7C4" }}
          >
            Enter to send · Shift+Enter for newline · ⌘K to toggle
          </p>
        </div>
      </div>
    </>
  );
}
