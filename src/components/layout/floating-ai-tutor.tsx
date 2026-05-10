"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bot, LoaderCircle, Send, Sparkles, X } from "lucide-react";
import { sendTutorMessage, type TutorChatMessage } from "@/lib/gemini-tutor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function FloatingAiTutor() {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<TutorChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [open, messages, scrollToBottom]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;

    setDraft("");
    setSending(true);
    setError("");

    const prior = messages;

    try {
      const reply = await sendTutorMessage(prior, text);
      setMessages([...prior, { role: "user", text }, { role: "assistant", text: reply }]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not reach the tutor.");
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed right-4 z-50 flex flex-col items-end gap-3",
        "bottom-[calc(5.75rem+env(safe-area-inset-bottom))] lg:bottom-8 lg:right-8",
      )}
    >
      <div
        id={panelId}
        role="dialog"
        aria-hidden={!open}
        aria-modal="false"
        aria-label="AI study tutor"
        className={cn(
          "flex max-h-[min(520px,calc(100vh-8rem))] w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-[28px] border border-border bg-surface shadow-[0_16px_48px_var(--shadow)] transition duration-200 sm:w-[24rem]",
          open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none invisible translate-y-2 opacity-0",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border bg-surface-strong px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:rgba(201,100,66,0.15)] text-brand">
              <Bot className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="font-semibold text-foreground">Study tutor</p>
              <p className="text-xs text-text-muted">Powered by Google Gemini — not a replacement for your teachers.</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 rounded-full"
            onClick={() => setOpen(false)}
            aria-label="Close tutor"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <div className="mr-4 rounded-2xl border border-border bg-background/80 px-3 py-2.5 text-sm leading-relaxed text-text-muted">
            Hi — I&apos;m your AI study tutor. Ask about revision, SPM-style prep, subjects, or how to use Resources,
            forks, and the forum on teenager.my.
          </div>
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={cn(
                "rounded-2xl px-3 py-2.5 text-sm leading-relaxed",
                message.role === "user"
                  ? "ml-6 bg-brand/15 text-foreground"
                  : "mr-4 border border-border bg-background/80 text-text-muted",
              )}
            >
              {message.text}
            </div>
          ))}
          {error ? (
            <p className="rounded-2xl border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </p>
          ) : null}
        </div>

        <div className="border-t border-border bg-surface-strong p-3">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about revision, subjects, or forks…"
            rows={2}
            disabled={sending}
            className="resize-none border-border bg-background/70 text-sm"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
          />
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSend()}
              disabled={!draft.trim() || sending}
              className="gap-2"
            >
              {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Thinking…" : "Send"}
            </Button>
          </div>
        </div>
      </div>

      <Button
        type="button"
        size="lg"
        className={cn(
          "h-14 min-h-14 rounded-full px-5 shadow-[0_12px_32px_var(--shadow)]",
          "pointer-events-auto gap-2 border-brand bg-brand text-[#faf9f5] hover:bg-[#b85a3a]",
        )}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close study tutor" : "Open study tutor"}
      >
        <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
        <span className="hidden font-semibold sm:inline">{open ? "Close" : "AI Tutor"}</span>
      </Button>
    </div>
  );
}
