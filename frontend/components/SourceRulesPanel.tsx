"use client";

import { type FormEvent, useState } from "react";
import { FloppyDisk, PencilSimple, X } from "@phosphor-icons/react";
import type { Company } from "@/lib/types";

export function SourceRulesPanel({
  company,
  onSave,
}: {
  company: Company;
  onSave: (allowList: string[], blockList: string[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allowListText, setAllowListText] = useState("");
  const [blockListText, setBlockListText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function beginEdit() {
    setAllowListText(company.allow_list.join("\n"));
    setBlockListText(company.block_list.join("\n"));
    setError(null);
    setEditing(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(parseRules(allowListText), parseRules(blockListText));
      setEditing(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Pulse API returned an unexpected error.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink-950">Source rules</h2>
        {editing ? (
          <button
            type="button"
            aria-label="Cancel source rule edit"
            onClick={() => setEditing(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 active:scale-[0.96]"
          >
            <X size={16} />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Edit source rules"
            onClick={beginEdit}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 active:scale-[0.96]"
          >
            <PencilSimple size={16} />
          </button>
        )}
      </div>

      {editing ? (
        <form className="mt-4 space-y-3" onSubmit={handleSave}>
          <RuleTextarea
            id="selected-vendor-allow-list"
            label="Allowed public sources"
            value={allowListText}
            onChange={setAllowListText}
          />
          <RuleTextarea
            id="selected-vendor-block-list"
            label="Blocked public sources"
            value={blockListText}
            onChange={setBlockListText}
          />
          {error ? (
            <p className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-ink-950 px-3 text-xs font-semibold text-white transition hover:bg-ink-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FloppyDisk size={15} weight="bold" />
            {saving ? "Saving" : "Save rules"}
          </button>
        </form>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <RuleList label="Allowed public sources" rules={company.allow_list} />
          <RuleList label="Blocked public sources" rules={company.block_list} />
        </div>
      )}
    </section>
  );
}

function RuleList({ label, rules }: { label: string; rules: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      {rules.length ? (
        <ul className="mt-2 space-y-2">
          {rules.map((rule) => (
            <li
              key={rule}
              className="break-all rounded-md bg-zinc-50 px-3 py-2 font-mono text-xs leading-5 text-zinc-700"
            >
              {rule}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">None set</p>
      )}
    </div>
  );
}

function RuleTextarea({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="block text-xs font-medium text-zinc-600">
      {label}
      <textarea
        id={id}
        value={value}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-24 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-ink-950 outline-none transition focus:border-ink-900 focus:ring-2 focus:ring-ink-900/10"
      />
    </label>
  );
}

function parseRules(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((rule) => rule.trim())
        .filter(Boolean),
    ),
  );
}
