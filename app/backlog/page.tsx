// app/backlog/page.tsx
"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

export default function BacklogPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const res = await apiFetch("/api/backlog"); // adds Authorization automatically
      const json = await res.json();
      setData(json);
    })();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>My Backlog</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </main>
  );
}
