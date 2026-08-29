import { SendHorizontal, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import type { ChatMessage } from "./types";

interface ChatBarProps {
  messages: ChatMessage[];
  onSubmitMessage: (message: string) => void;
}

export function ChatBar({ messages, onSubmitMessage }: ChatBarProps) {
  const [draft, setDraft] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = draft.trim();
    if (!value) {
      return;
    }
    onSubmitMessage(value);
    setDraft("");
  }

  return (
    <section className="glass-panel p-4">
      <div className="mb-3 flex max-h-36 flex-col gap-2 overflow-y-auto pr-1">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[86%] rounded-2xl border px-4 py-2 text-sm ${
              message.role === "user"
                ? "ml-auto border-neon-cyan/40 bg-neon-cyan/10 text-space-text"
                : "border-space-border bg-space-card text-space-soft"
            }`}
          >
            {message.text}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan">
          <Sparkles size={20} />
        </div>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask: What changed between these two dates?"
          className="h-12 rounded-xl border border-space-border bg-space-bg px-4 text-sm text-space-text outline-none transition placeholder:text-space-soft focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20"
        />
        <button
          type="submit"
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-neon-cyan px-5 text-sm font-bold text-space-bg transition hover:bg-cyan-300"
        >
          <SendHorizontal size={18} />
          Send
        </button>
      </form>
    </section>
  );
}
