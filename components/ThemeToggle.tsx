"use client";

import { useEffect, useState } from "react";

const ACCENTS = [
  { key: "indigo",  label: "Indigo"  },
  { key: "violet",  label: "Violet"  },
  { key: "emerald", label: "Emerald" },
  { key: "rose",    label: "Rose"    },
];

export default function ThemeToggle() {
  const [accent, setAccent] = useState<string>("indigo");

  useEffect(() => {
    const saved = localStorage.getItem("accent") || "indigo";
    setAccent(saved);
    document.documentElement.setAttribute("data-accent", saved);
  }, []);

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setAccent(val);
    document.documentElement.setAttribute("data-accent", val);
    localStorage.setItem("accent", val);
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm text-[var(--muted)]">
      Accent:
      <select
        value={accent}
        onChange={onChange}
        className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[var(--fg)]"
      >
        {ACCENTS.map((a) => (
          <option key={a.key} value={a.key}>
            {a.label}
          </option>
        ))}
      </select>
    </label>
  );
}
