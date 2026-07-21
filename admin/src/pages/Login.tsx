import { useState } from "react";
import { supabase } from "../supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (error) setErr(error.message);
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form
        onSubmit={submit}
        className="bg-white rounded-xl shadow p-6 w-full max-w-sm flex flex-col gap-3"
      >
        <h1 className="text-xl font-bold">Admin sign in</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded-lg px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded-lg px-3 py-2"
          required
        />
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <button
          disabled={busy}
          className="bg-slate-900 text-white rounded-lg py-2 font-semibold disabled:opacity-50"
        >
          {busy ? "…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
