// components/ImportRunner.tsx
"use client";

import { useMemo, useRef, useState } from "react";

type Props = {
  defaultSteamId?: string;
};

type OwnedBatchResponse = {
  limit: number;
  offset: number;
  nextOffset: number;
  hasMore: boolean;
  totalOwned: number;
  eligibleOwned: number;
  denylistedCount: number;
  processed: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  imported: number[];
  skipped: number[];
  errors: Array<{ appId: number; status?: number; message: string }>;
  skipBreakdown?: Record<string, number>;
};

export default function ImportRunner({ defaultSteamId = "" }: Props) {
  const [steamId, setSteamId] = useState(defaultSteamId);
  const [limit, setLimit] = useState(100);
  const [concurrency, setConcurrency] = useState(3);
  const [delay, setDelay] = useState(400);
  const [backoff, setBackoff] = useState(4000);
  const [apiKey, setApiKey] = useState("");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    imported: 0,
    skipped: 0,
    errors: 0,
  });

  const abortRef = useRef<AbortController | null>(null);

  const disabled = useMemo(
    () => running || !steamId,
    [running, steamId]
  );

  function append(line: string) {
    setLog((l) => [...l, line].slice(-500));
  }

  async function run() {
    setRunning(true);
    setLog([]);
    setStats({ total: 0, imported: 0, skipped: 0, errors: 0 });
    abortRef.current = new AbortController();

    try {
      let offset = 0;
      let overallImported = 0;
      let overallSkipped = 0;
      let overallErrors = 0;
      let totalEligible = 0;
      let firstPass = true;

      while (true) {
        const url = new URL("/api/steam/owned", window.location.origin);
        url.searchParams.set("steamId", steamId);
        if (apiKey) url.searchParams.set("key", apiKey);
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("offset", String(offset));
        url.searchParams.set("concurrency", String(concurrency));
        url.searchParams.set("delay", String(delay));
        url.searchParams.set("backoff", String(backoff));

        append(`→ Fetching offset=${offset}, limit=${limit} ...`);
        const res = await fetch(url.toString(), {
          signal: abortRef.current?.signal,
          cache: "no-store",
        });
        const json = (await res.json()) as OwnedBatchResponse;

        if (firstPass) {
          totalEligible = json.eligibleOwned;
          setStats((s) => ({ ...s, total: totalEligible }));
          firstPass = false;
        }

        overallImported += json.importedCount;
        overallSkipped += json.skippedCount;
        overallErrors += json.errorCount;

        append(
          `  Imported: +${json.importedCount} | Skipped: +${json.skippedCount} | Errors: +${json.errorCount}`
        );
        setStats({ total: totalEligible, imported: overallImported, skipped: overallSkipped, errors: overallErrors });

        if (!json.hasMore) {
          append("✓ Done.");
          break;
        }
        offset = json.nextOffset;
      }
    } catch (e: any) {
      append(`✖ ${e?.message || String(e)}`);
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    append("⏹ Stopped.");
    setRunning(false);
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Steam ID</span>
          <input
            value={steamId}
            onChange={(e) => setSteamId(e.target.value)}
            placeholder="7656119..."
            className="rounded-md border px-3 py-2"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Web API Key (optional)</span>
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="If not set in env"
            className="rounded-md border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Batch size (limit)</span>
          <input
            type="number"
            min={1}
            max={250}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value || 50))}
            className="rounded-md border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Concurrency</span>
          <input
            type="number"
            min={1}
            max={10}
            value={concurrency}
            onChange={(e) => setConcurrency(Number(e.target.value || 3))}
            className="rounded-md border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Group delay (ms)</span>
          <input
            type="number"
            min={0}
            max={5000}
            value={delay}
            onChange={(e) => setDelay(Number(e.target.value || 400))}
            className="rounded-md border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Backoff on 403 burst (ms)</span>
          <input
            type="number"
            min={1000}
            max={30000}
            value={backoff}
            onChange={(e) => setBackoff(Number(e.target.value || 4000))}
            className="rounded-md border px-3 py-2"
          />
        </label>

        <div className="md:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-50"
            disabled={disabled}
          >
            {running ? "Running…" : "Start import"}
          </button>
          <button
            type="button"
            onClick={stop}
            className="rounded-md border px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
            disabled={!running}
          >
            Stop
          </button>
        </div>
      </form>

      <div className="rounded-md border p-3 text-sm">
        <div className="flex flex-wrap gap-4">
          <span>Total eligible: <b>{stats.total.toLocaleString()}</b></span>
          <span>Imported: <b className="text-green-700">{stats.imported.toLocaleString()}</b></span>
          <span>Skipped: <b className="text-yellow-700">{stats.skipped.toLocaleString()}</b></span>
          <span>Errors: <b className="text-red-700">{stats.errors.toLocaleString()}</b></span>
        </div>
      </div>

      <div className="rounded-md border bg-gray-50 p-3">
        <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap text-xs leading-relaxed">
          {log.join("\n")}
        </pre>
      </div>
    </div>
  );
}
