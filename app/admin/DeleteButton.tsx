"use client";

type Props = {
  action: (fd: FormData) => Promise<void>;
  id: string;
  label?: string;
  confirm?: string;
};

export function DeleteButton({ action, id, label = "Delete", confirm = "Are you sure?" }: Props) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
      className="inline"
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-red-700 hover:underline">
        {label}
      </button>
    </form>
  );
}
