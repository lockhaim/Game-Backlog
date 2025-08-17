// app/import/page.tsx
"use client";

import { useMemo, useState } from "react";

type BatchResult = {
  total: number;
  requested: number;
  processed: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  denylistedCount: number;
  imported: number[];
  skipped: number[];
  errors: { appId: number; status?: number; message: string }[];
};

function parseIds(input: string): number[] {
  return Array.from(
    new Set(
      input
        .split(/[\s,]+/)
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
  );
}

export default function ImportPage() {
  const [rawIds, setRawIds] = useState("");
  const [concurrency, setConcurrency] = useState(8);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const ids = useMemo(() => parseIds(rawIds), [rawIds]);

  async function runBatch() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/steam/import/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ appIds: ids, concurrency }),
      });
      const json = await res.json();
      setResult(json);
    } catch (e) {
      setResult({
        total: 0,
        requested: 0,
        processed: 0,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 1,
        denylistedCount: 0,
        imported: [],
        skipped: [],
        errors: [{ appId: 0, message: String((e as any)?.message || e) }],
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Steam Import (Batch)</h1>

      <div className="space-y-3">
        <label className="block text-sm font-medium">Steam App IDs</label>
        <textarea
          className="w-full h-32 rounded border p-2 font-mono text-sm"
          placeholder="e.g. 220, 4000 570&#10;or pasted list"
          value={rawIds}
          onChange={(e) => setRawIds(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <label className="text-sm">Concurrency</label>
          <input
            type="number"
            min={1}
            max={20}
            className="w-24 rounded border p-1"
            value={concurrency}
            onChange={(e) => setConcurrency(Math.max(1, Math.min(20, Number(e.target.value || 1))))}
          />
          <span className="text-xs text-gray-500">(1–20)</span>
        </div>
        <button
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          disabled={loading || ids.length === 0}
          onClick={runBatch}
        >
          {loading ? "Importing…" : `Start Import (${ids.length})`}
        </button>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="rounded border p-4">
            <h2 className="font-medium mb-2">Summary</h2>
            <ul className="text-sm grid grid-cols-2 gap-y-1">
              <li>Total: {result.total}</li>
              <li>Processed: {result.processed}</li>
              <li>Imported: {result.importedCount}</li>
              <li>Skipped: {result.skippedCount}</li>
              <li>Errors: {result.errorCount}</li>
              <li>Denylisted: {result.denylistedCount}</li>
            </ul>
          </div>

          {result.imported.length > 0 && (
            <div className="rounded border p-4">
              <h3 className="font-medium mb-2">Imported</h3>
              <div className="text-sm font-mono break-words">
                {result.imported.join(", ")}
              </div>
            </div>
          )}

          {result.skipped.length > 0 && (
            <div className="rounded border p-4">
              <h3 className="font-medium mb-2">Skipped</h3>
              <div className="text-sm font-mono break-words">
                {result.skipped.join(", ")}
              </div>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="rounded border p-4">
              <h3 className="font-medium mb-2">Errors</h3>
              <ul className="text-sm font-mono space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    {e.appId}: {e.status ?? ""} {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
