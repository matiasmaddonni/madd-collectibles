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
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <pre className="ah-field-val" style={{ background: "var(--ah-ok-bg)", borderColor: "var(--ah-ok)" }}>
          {value || "(empty)"}
        </pre>
        {editable && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ah-link"
            style={{ alignSelf: "flex-start", fontSize: 12 }}
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
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={Math.max(4, Math.min(20, value.split("\n").length + 2))}
        disabled={pending}
        style={{
          width: "100%",
          font: "inherit",
          fontFamily: "'SF Mono', ui-monospace, monospace",
          fontSize: 12.5,
          padding: "10px 12px",
          background: "var(--ah-surface-2)",
          color: "var(--ah-text)",
          border: "1px solid var(--ah-accent)",
          borderRadius: 4,
          outline: "none",
          resize: "vertical",
        }}
      />
      {error && (
        <p style={{ color: "var(--ah-danger)", fontSize: 12 }}>{error}</p>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={onSave}
          disabled={pending || value.trim().length === 0}
          className="ah-btn"
          style={{
            background: "var(--ah-accent)",
            color: "white",
            borderColor: "var(--ah-accent)",
          }}
        >
          {pending ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(initialValue);
            setEditing(false);
            setError(null);
          }}
          disabled={pending}
          className="ah-btn ah-btn--ghost"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
