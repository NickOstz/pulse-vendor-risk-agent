"use client";

import { type FormEvent, useRef, useState } from "react";
import { LockKey, LockKeyOpen } from "@phosphor-icons/react";
import { Badge } from "@/components/Badge";
import { clearOperatorToken, setOperatorToken } from "@/lib/api";

export function OperatorAccess({
  tokenSet,
  onTokenStateChange,
}: {
  tokenSet: boolean;
  onTokenStateChange: (tokenSet: boolean) => void;
}) {
  const [token, setToken] = useState("");
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token.trim()) return;
    setOperatorToken(token);
    setToken("");
    onTokenStateChange(true);
    detailsRef.current?.removeAttribute("open");
  }

  function handleLock() {
    clearOperatorToken();
    setToken("");
    onTokenStateChange(false);
    detailsRef.current?.removeAttribute("open");
  }

  return (
    <details ref={detailsRef} className="group relative">
      <summary className="cursor-pointer list-none" title="Operator access">
        <Badge tone={tokenSet ? "good" : "warn"}>
          <span className="inline-flex items-center gap-1.5">
            {tokenSet ? <LockKeyOpen size={13} /> : <LockKey size={13} />}
            {tokenSet ? "Operator token set" : "Controls locked"}
          </span>
        </Badge>
      </summary>
      <div className="absolute left-0 top-9 z-20 w-72 rounded-lg border border-zinc-200 bg-white p-3 shadow-soft">
        <form className="space-y-3" onSubmit={handleSubmit}>
          <label className="block text-xs font-medium text-zinc-600">
            Operator token
            <input
              autoComplete="off"
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 font-mono text-sm text-ink-950 outline-none transition focus:border-ink-900 focus:ring-2 focus:ring-ink-900/10"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!token.trim()}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-ink-950 px-3 text-xs font-semibold text-white transition hover:bg-ink-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LockKeyOpen size={14} weight="bold" />
              Set token
            </button>
            {tokenSet ? (
              <button
                type="button"
                onClick={handleLock}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-600 transition hover:border-zinc-300 active:scale-[0.98]"
              >
                <LockKey size={14} weight="bold" />
                Lock
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </details>
  );
}
