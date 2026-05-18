import { DeleteRowButton } from "./DeleteRowButton";

type Option = { value: string; label: string };

export type Column =
  | { key: string; label: string; type?: "text" }
  | { key: string; label: string; type: "select"; options: Option[] };

type Row = Record<string, string | null> & { id: string };

type Props = {
  title: string;
  sub: string;
  columns: Column[];
  rows: Row[];
  upsertAction: (fd: FormData) => Promise<void>;
  deleteAction: (fd: FormData) => Promise<void>;
  addLabel: string;
  deleteConfirmKey: string;
};

function FieldInput({
  column,
  defaultValue,
  required,
}: {
  column: Column;
  defaultValue?: string;
  required?: boolean;
}) {
  if (column.type === "select") {
    return (
      <select
        name={column.key}
        defaultValue={defaultValue ?? ""}
        required={required}
        className="ah-tax-select"
      >
        <option value="" disabled>
          Select...
        </option>
        {column.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      name={column.key}
      defaultValue={defaultValue ?? ""}
      required={required}
      className="ah-tax-input"
    />
  );
}

export function TaxonomyEditor({
  title,
  sub,
  columns,
  rows,
  upsertAction,
  deleteAction,
  addLabel,
  deleteConfirmKey,
}: Props) {
  return (
    <section className="ah-card">
      <div className="ah-card-head">
        <div>
          <div className="ah-card-title">{title}</div>
          <div className="ah-card-sub">
            {rows.length} {rows.length === 1 ? "entry" : "entries"} {sub ? `· ${sub}` : ""}
          </div>
        </div>
      </div>

      <div className="ah-tax-add">
        <div className="ah-tax-add-label">{addLabel}</div>
        <form action={upsertAction} className="ah-tax-add-row">
          {columns.map((col) => (
            <div key={col.key} className="ah-tax-field">
              <label>{col.label}</label>
              <FieldInput column={col} required />
            </div>
          ))}
          <button type="submit" className="ah-btn ah-btn--primary">
            Add
          </button>
        </form>
      </div>

      <div className="ah-tax-list">
        {rows.length === 0 ? (
          <div className="ah-list-empty">No entries yet.</div>
        ) : (
          rows.map((row) => {
            const displayName = (row[deleteConfirmKey] as string) ?? row.id;
            return (
              <div key={row.id} className="ah-tax-row">
                <form action={upsertAction} className="ah-tax-row-form">
                  <input type="hidden" name="id" value={row.id} />
                  {columns.map((col) => (
                    <label key={col.key} className="ah-tax-cell">
                      <span className="ah-tax-cell-label">{col.label}</span>
                      <FieldInput
                        column={col}
                        defaultValue={(row[col.key] as string) ?? ""}
                      />
                    </label>
                  ))}
                  <button type="submit" className="ah-link ah-tax-row-save">
                    Save
                  </button>
                </form>
                <DeleteRowButton
                  action={deleteAction}
                  id={row.id}
                  confirm={`Delete "${displayName}"?`}
                />
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
