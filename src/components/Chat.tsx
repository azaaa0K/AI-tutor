"use client";

import { Client } from "@gradio/client";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Role = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
};

const UNAVAILABLE =
  "Error: the tutor is waking up or unavailable. Try again in a minute.";

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
  }, [messages, loading]);

  async function ask(text: string, history: ChatMessage[]) {
    cancelledRef.current = false;
    setLoading(true);

    const assistantId = crypto.randomUUID();
    setMessages([
      ...history,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const app = await Client.connect(process.env.NEXT_PUBLIC_SPACE_ID!);
      const job = app.submit("/chat", { message: text });
      let answer = "";

      for await (const msg of job) {
        if (cancelledRef.current) break;
        if (msg.type === "data") {
          answer = String((msg.data as unknown[])[0] ?? "");
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId ? { ...message, content: answer } : message,
            ),
          );
        }
      }

      if (!cancelledRef.current && !answer.trim()) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId ? { ...message, content: UNAVAILABLE } : message,
          ),
        );
      }
    } catch {
      if (cancelledRef.current) return;
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId ? { ...message, content: UNAVAILABLE } : message,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  function send() {
    const text = input.trim();
    if (!text || loading) return;

    const next: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const history = [...messages, next];
    setMessages(history);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    void ask(text, history);
  }

  function stop() {
    cancelledRef.current = true;
    setLoading(false);
  }

  function regenerate(index: number) {
    if (loading) return;
    const previous = [...messages.slice(0, index)].reverse().find((message) => message.role === "user");
    if (!previous) return;
    const history = messages.slice(0, index);
    setMessages(history);
    void ask(previous.content, history);
  }

  function editUser(index: number) {
    if (loading) return;
    setInput(messages[index].content);
    setMessages(messages.slice(0, index));
    inputRef.current?.focus();
  }

  async function copy(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(null), 1200);
    } catch {
      setCopiedId(null);
    }
  }

  const empty = messages.length === 0;

  return (
    <main className="flex h-dvh flex-col bg-white text-[#1c1c1c]">
      <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <div className="flex h-full items-center justify-center px-6">
            <div className="text-center">
              <h1 className="text-[32px] font-medium tracking-tight">Welcome to Tutor AI</h1>
              <p className="mt-2 text-[15px] text-[#8a8a8a]">Your personal AI tutor</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
            {messages.map((message, index) => {
              if (message.role === "user") {
                return (
                  <div key={message.id} className="flex flex-col items-end">
                    <div className="max-w-[min(100%,32rem)] rounded-2xl bg-[#f3f3f3] px-3.5 py-2 text-[15px] leading-6">
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <div className="mt-1 flex items-center gap-0.5 text-[#8d8d8d]">
                      <IconButton
                        label={copiedId === message.id ? "Copied" : "Copy"}
                        onClick={() => copy(message)}
                      >
                        <CopyIcon />
                      </IconButton>
                      <IconButton label="Edit" onClick={() => editUser(index)}>
                        <PencilIcon />
                      </IconButton>
                    </div>
                  </div>
                );
              }

              if (!message.content && loading) {
                return (
                  <p key={message.id} className="text-[15px] text-[#8a8a8a]">
                    Thinking…
                  </p>
                );
              }

              return (
                <div key={message.id} className="flex flex-col items-start">
                  <p className="max-w-full whitespace-pre-wrap text-[15px] leading-7">
                    {message.content}
                  </p>
                  <div className="mt-1 flex items-center gap-0.5 text-[#8d8d8d]">
                    <IconButton
                      label={copiedId === message.id ? "Copied" : "Copy"}
                      onClick={() => copy(message)}
                    >
                      <CopyIcon />
                    </IconButton>
                    <IconButton label="Regenerate" onClick={() => regenerate(index)}>
                      <RefreshIcon />
                    </IconButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form
        className="mx-auto w-full max-w-3xl px-4 pb-5 sm:px-6"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <div className="flex items-end gap-2 rounded-full border border-[#e4e4e4] bg-white py-1.5 pr-1.5 pl-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <button
            type="button"
            aria-label="Add"
            className="mb-0.5 grid size-9 shrink-0 place-items-center rounded-full text-[#444] hover:bg-[#f3f3f3]"
          >
            <PlusIcon />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            placeholder="Type a message..."
            onChange={(event) => {
              setInput(event.target.value);
              const el = event.target;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 outline-none placeholder:text-[#9a9a9a]"
          />
          {loading ? (
            <button
              type="button"
              aria-label="Stop"
              onClick={stop}
              className="mb-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-[#f2f2f2] text-[#222] hover:bg-[#e8e8e8]"
            >
              <StopIcon />
            </button>
          ) : (
            <button
              type="submit"
              aria-label="Send"
              disabled={!input.trim()}
              className="mb-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-[#f2f2f2] text-[#222] hover:bg-[#e8e8e8] disabled:text-[#b5b5b5]"
            >
              <ArrowUpIcon />
            </button>
          )}
        </div>
      </form>
    </main>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md hover:bg-[#f3f3f3] hover:text-[#222]"
    >
      {children}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 12a9 9 0 1 1-2.6-6.3" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </svg>
  );
}

function StopIcon() {
  return <span className="size-3 rounded-[3px] bg-current" />;
}
