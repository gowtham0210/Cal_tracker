"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, Lightbulb, Minus, RefreshCw, SendHorizontal, Sparkles, Trash2 } from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, CardHeader, PageHeader, Skeleton } from "@/components/ui";
import { aiWeeklySummary, CHAT_STARTERS, type WeeklySummary } from "@/lib/ai";
import { api, ApiError } from "@/lib/api";
import { formatDate, lastNDays, todayKey } from "@/lib/date";
import { useStore } from "@/lib/store";

/** Renders **bold** segments; everything else is plain text. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") ? (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function WeeklySummaryCard() {
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const week = lastNDays(7);

  const fetchSummary = useCallback(async () => {
    try {
      setSummary(await aiWeeklySummary(todayKey()));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.problem.title : "Couldn't load your summary.");
    }
    setLoading(false);
  }, []);

  const load = () => {
    setLoading(true);
    void fetchSummary();
  };

  useEffect(() => {
    let active = true;
    aiWeeklySummary(todayKey())
      .then((res) => active && (setSummary(res), setError(null)))
      .catch((err) => active && setError(err instanceof ApiError ? err.problem.title : "Couldn't load your summary."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-brand/10 blur-2xl" aria-hidden />
      <CardHeader
        icon={<Sparkles className="size-4 text-brand" />}
        title="Weekly coach summary"
        subtitle={`${formatDate(week[0])} – ${formatDate(week[6])}`}
        action={
          <Button variant="ghost" size="icon" aria-label="Regenerate summary" onClick={load} disabled={loading}>
            <RefreshCw className={clsx("size-4", loading && "animate-spin")} />
          </Button>
        }
      />
      {!loading && error ? (
        <p role="alert" className="rounded-xl bg-surface-2 px-3.5 py-3 text-sm text-muted">
          {error}
        </p>
      ) : loading || !summary ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-5 w-11/12" />
          <Skeleton className="h-5 w-3/4" />
          <div className="space-y-2 pt-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
          <Skeleton className="h-20" />
        </div>
      ) : (
        <div className="animate-fade-up space-y-4">
          <p className="text-[15px] leading-relaxed">{summary.headline}</p>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {summary.bullets.map((b) => {
              const Icon = b.trend === "up" ? ArrowUp : b.trend === "down" ? ArrowDown : Minus;
              return (
                <li key={b.label} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span className="text-muted">{b.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular font-semibold">{b.value}</span>
                    <span
                      className={clsx(
                        "grid size-5 place-items-center rounded-full",
                        b.good ? "bg-brand-soft text-brand-strong" : "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
                      )}
                      aria-label={b.good ? "on track" : "needs attention"}
                    >
                      <Icon className="size-3" />
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-3 rounded-xl bg-amber-50 p-4 dark:bg-amber-400/10">
            <Lightbulb className="mt-0.5 size-5 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-semibold">Tip for next week</p>
              <p className="mt-0.5 text-sm text-muted">{summary.tip}</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function Chat() {
  const chat = useStore((s) => s.chat);
  const setChat = useStore((s) => s.setChat);
  const clearChat = useStore((s) => s.clearChat);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.length, thinking]);

  const send = async (text = input) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setError(null);
    setBusy(true);
    const before = useStore.getState().chat;
    const question = { id: "pending-q", role: "user" as const, text: q };
    const answer = { id: "pending-a", role: "assistant" as const, text: "" };
    setChat([...before, question]);
    setThinking(true);
    try {
      // Show the answer as it streams in, then swap in the saved messages.
      const saved = await api.askCoach(q, (piece) => {
        answer.text += piece;
        setThinking(false);
        setChat([...before, question, { ...answer }]);
      });
      setChat([...before, { id: saved.question.id, role: "user", text: saved.question.text }, { id: saved.answer.id, role: "assistant", text: saved.answer.text }]);
    } catch (err) {
      setChat(before);
      setInput(q);
      setError(err instanceof ApiError ? err.problem.title : "Couldn't get an answer. Please try again.");
    }
    setThinking(false);
    setBusy(false);
    inputRef.current?.focus();
  };

  return (
    <Card className="flex h-[min(680px,calc(100dvh-220px))] min-h-[460px] flex-col !p-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-[15px] font-semibold">Chat with your data</h2>
          <p className="text-[13px] text-muted">Ask about your progress in plain words</p>
        </div>
        {chat.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearChat} aria-label="Clear conversation">
            <Trash2 className="size-4" /> Clear
          </Button>
        )}
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5" aria-live="polite">
        {chat.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-strong">
              <Sparkles className="size-6" />
            </span>
            <p className="mt-3 font-semibold">What would you like to know?</p>
            <p className="mt-1 max-w-xs text-sm text-muted">I can look across your food, weight, water, workouts and journal.</p>
            <div className="mt-5 flex max-w-md flex-wrap justify-center gap-2">
              {CHAT_STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-sm text-muted transition hover:border-brand hover:text-text"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {chat.map((m) => (
          <div key={m.id} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={clsx(
                "animate-fade-up max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
                m.role === "user" ? "rounded-br-md bg-brand text-brand-contrast" : "rounded-bl-md bg-surface-2",
              )}
            >
              <RichText text={m.text} />
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex">
            <div className="flex gap-1 rounded-2xl rounded-bl-md bg-surface-2 px-4 py-3.5" aria-label="Assistant is typing">
              {[0, 150, 300].map((d) => (
                <span key={d} className="size-2 animate-bounce rounded-full bg-subtle" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {chat.length > 0 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2 sm:px-5">
          {CHAT_STARTERS.slice(0, 4).map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={busy}
              className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted transition hover:border-brand hover:text-text disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mx-3 mb-2 rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}
      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor="chat-input" className="sr-only">
          Ask a question
        </label>
        <textarea
          ref={inputRef}
          id="chat-input"
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Ask about your progress…"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[15px] outline-none transition placeholder:text-subtle focus:border-brand focus:ring-4 focus:ring-brand/15"
        />
        <Button type="submit" size="icon" className="size-11" aria-label="Send" disabled={!input.trim() || busy}>
          <SendHorizontal className="size-5" />
        </Button>
      </form>
    </Card>
  );
}

export function CoachView() {
  return (
    <div className="space-y-5">
      <PageHeader title="AI Coach" subtitle="Your weekly recap, plus answers about your own data." />
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <WeeklySummaryCard />
        </div>
        <div className="lg:col-span-3">
          <Chat />
        </div>
      </div>
      <p className="text-center text-xs text-subtle">Answers are generated by AI from your own logs. They can be wrong, and they aren&apos;t medical advice.</p>
    </div>
  );
}
