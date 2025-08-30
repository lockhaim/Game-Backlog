// app/login/page.tsx
"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: true, autoRefreshToken: true } }
);

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function signIn() {
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) return setMsg(error.message);
    setMsg("Signed in! Now open /api/backlog in this tab.");
    router.refresh(); // refresh cookies/session state
  }

  async function signUp() {
    setMsg(null);
    const { error } = await supabase.auth.signUp({ email, password: pw });
    if (error) return setMsg(error.message);
    setMsg("Sign-up complete. Check email if confirmations are enabled.");
    router.refresh();
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMsg("Signed out.");
    setEmail("");
    setPw("");
    router.refresh();
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Login</h1>
      <input
        placeholder="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={{ display: "block", marginBottom: 8 }}
      />
      <input
        placeholder="password"
        type="password"
        value={pw}
        onChange={e => setPw(e.target.value)}
        style={{ display: "block", marginBottom: 8 }}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={signIn}>Sign In</button>
        <button onClick={signUp}>Sign Up</button>
        <button onClick={signOut}>Sign Out</button>
      </div>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </main>
  );
}
