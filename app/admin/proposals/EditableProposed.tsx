"use client";

import { useState, useTransition } from "react";
import { updateProposedValue } from "./actions";

type Props = {
  proposalId: string;
  initialValue: string;
  editable: boolean;
};

// Toggle between read-only display and an inline textarea for editing
// the proposed value. Used for free-text fields (description, sku) so
// the admin can merge crawler text with their own before approving.
export function EditableProposed({
  proposalId,
  initialValue,
  editable,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className="flex flex-col gap-1">
        <pre className="whitespace-pre-wrap break-words bg-green-50 border border-green-200 p-2 text-xs">
          {value}
        </pre>
        {editable && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="self-start text-[11px] text-blue-700 hover:underline"
          >
            Edit text
          </button>
        )}
      </div>
    );
  }

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      try {
        await updateProposedValue(proposalId, value);
        setEditing(false);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={Math.max(4, Math.min(20, value.split("\n").length + 2))}
        className="w-full text-xs font-mono bg-white border border-zinc-400 p-2"
        disabled={pending}
      />
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={pending || value.trim().length === 0}
          className="px-3 py-1 text-xs bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(initialValue);
            setEditing(false);
            setError(null);
          }}
          disabled={pending}
          className="px-3 py-1 text-xs bg-zinc-200 text-zinc-800 hover:bg-zinc-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
