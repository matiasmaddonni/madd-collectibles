"use client";

type Props = {
  action: (fd: FormData) => Promise<void>;
  id: string;
  confirm: string;
};

export function DeleteRowButton({ action, id, confirm }: Props) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
      style={{ display: "inline" }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="ah-link ah-link--danger">
        Delete
      </button>
    </form>
  );
}
