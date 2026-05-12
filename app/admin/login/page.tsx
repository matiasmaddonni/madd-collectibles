"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "../actions";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.set("email", email);
    fd.set("password", password);
    fd.set("next", search.get("next") ?? "/admin");
    const result = await signIn(fd);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(result.next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          className="border border-zinc-400 px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="border border-zinc-400 px-2 py-1"
        />
      </label>
      {error && <p className="text-red-700 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-black text-white px-4 py-2 disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="max-w-sm mx-auto mt-20">
      <h1 className="text-xl font-semibold mb-4">Admin sign in</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
