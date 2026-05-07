"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    const next = search.get("next") ?? "/admin";
    // Allow only same-origin paths starting with a single "/". Reject schemes
    // (https:), protocol-relative URLs (//evil.com), and backslash variants.
    const safeNext =
      typeof next === "string" &&
      next.startsWith("/") &&
      !next.startsWith("//") &&
      !next.startsWith("/\\")
        ? next
        : "/admin";
    router.push(safeNext);
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
