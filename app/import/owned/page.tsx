'use client';

import React from 'react';

type BatchResult = {
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
  skipSamples?: Record<string, Array<{ appId: number; status?: number; message: string }>>;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function ImportOwnedPage() {
  const [steamId, setSteamId] = React.useState<string>('');
  const [limit, setLimit] = React.useState<number>(100);
  const [concurrency, setConcurrency] = React.useState<number>(5);
  const [running, setRunning] = React.useState(false);

  const [progress, setProgress] = React.useState({
    totalOwned: 0,
    eligibleOwned: 0,
    imported: 0,
    skipped: 0,
    errors: 0,
    denylisted: 0,
    processed: 0,
    pages: 0,
  });

  const [recentImported, setRecentImported] = React.useState<number[]>([]);
  const [recentSkipped, setRecentSkipped] = React.useState<number[]>([]);
  const [recentErrors, setRecentErrors] = React.useState<Array<{ appId: number; status?: number; message: string }>>([]);
  const [log, setLog] = React.useState<string[]>([]);

  async function runImport() {
    if (!steamId.trim()) {
      alert('Enter your SteamID64.');
      return;
    }
    setRunning(true);
    setLog([]);
    setRecentImported([]);
    setRecentSkipped([]);
    setRecentErrors([]);
    setProgress({ totalOwned: 0, eligibleOwned: 0, imported: 0, skipped: 0, errors: 0, denylisted: 0, processed: 0, pages: 0 });

    let offset = 0;
    let hasMore = true;
    let firstTotalsRecorded = false;

    try {
      while (hasMore) {
        const url = `/api/steam/owned?steamId=${encodeURIComponent(steamId)}&limit=${limit}&offset=${offset}&verbose=1&concurrency=${concurrency}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data: BatchResult = await res.json();

        if (!res.ok) {
          setLog((l) => [`Error page @ offset ${offset}: ${JSON.stringify(data)}`, ...l].slice(0, 200));
          break;
        }

        if (!firstTotalsRecorded) {
          firstTotalsRecorded = true;
          setProgress((p) => ({
            ...p,
            totalOwned: data.totalOwned,
            eligibleOwned: data.eligibleOwned,
            denylisted: data.denylistedCount,
          }));
        }

        // Update aggregates
        setProgress((p) => ({
          ...p,
          imported: p.imported + data.importedCount,
          skipped: p.skipped + data.skippedCount,
          errors: p.errors + data.errorCount,
          processed: p.processed + data.processed,
          pages: p.pages + 1,
        }));

        // Keep short “recent” samples
        setRecentImported((v) => [...data.imported, ...v].slice(0, 30));
        setRecentSkipped((v) => [...data.skipped, ...v].slice(0, 30));
        if (data.errors?.length) {
          setRecentErrors((v) => [...data.errors, ...v].slice(0, 20));
        }

        // Page forward
        hasMore = data.hasMore;
        offset = data.nextOffset;

        // Small pause to be nice to upstream APIs
        await sleep(200);
      }

      setLog((l) => [`Done. Imported=${progress.imported} Skipped=${progress.skipped} Errors=${progress.errors}`, ...l].slice(0, 200));
    } catch (e: any) {
      setLog((l) => [`Fatal error: ${String(e?.message || e)}`, ...l].slice(0, 200));
    } finally {
      setRunning(false);
    }
  }

  const pct = progress.totalOwned
    ? Math.min(100, Math.round((progress.processed / progress.eligibleOwned) * 100))
    : 0;

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Import Owned Steam Games</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">SteamID64</span>
          <input
            className="rounded border px-3 py-2"
            placeholder="7656119XXXXXXXXXX"
            value={steamId}
            onChange={(e) => setSteamId(e.target.value)}
            disabled={running}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Page size (limit)</span>
          <input
            type="number"
            min={1}
            max={250}
            className="rounded border px-3 py-2"
            value={limit}
            onChange={(e) => setLimit(Math.max(1, Math.min(250, Number(e.target.value) || 50)))}
            disabled={running}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Concurrency</span>
          <input
            type="number"
            min={1}
            max={10}
            className="rounded border px-3 py-2"
            value={concurrency}
            onChange={(e) => setConcurrency(Math.max(1, Math.min(10, Number(e.target.value) || 5)))}
            disabled={running}
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={runImport}
          disabled={running}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {running ? 'Importing…' : 'Start Import'}
        </button>

        <div className="text-sm text-gray-600">
          {progress.totalOwned > 0 && (
            <>
              <strong>{pct}%</strong> • processed {progress.processed}/{progress.eligibleOwned} • pages {progress.pages}
            </>
          )}
        </div>
      </div>

      <div className="w-full h-3 bg-gray-200 rounded">
        <div
          className="h-3 bg-blue-600 rounded"
          style={{ width: `${pct}%`, transition: 'width .2s ease' }}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <section>
          <h2 className="font-medium mb-2">Imported (latest)</h2>
          <div className="text-sm text-gray-700">
            {recentImported.length ? recentImported.join(', ') : <em>—</em>}
          </div>
        </section>

        <section>
          <h2 className="font-medium mb-2">Skipped (latest)</h2>
          <div className="text-sm text-gray-700">
            {recentSkipped.length ? recentSkipped.join(', ') : <em>—</em>}
          </div>
        </section>

        <section>
          <h2 className="font-medium mb-2">Errors (latest)</h2>
          <div className="space-y-1 text-sm text-gray-700">
            {recentErrors.length ? (
              recentErrors.map((e, i) => (
                <div key={i}>
                  <span className="font-mono">{e.appId}</span>: {e.status ?? ''} {e.message ?? ''}
                </div>
              ))
            ) : (
              <em>—</em>
            )}
          </div>
        </section>
      </div>

      <div className="text-sm text-gray-700">
        <div>Total owned: <strong>{progress.totalOwned || '—'}</strong></div>
        <div>Eligible (not denylisted): <strong>{progress.eligibleOwned || '—'}</strong></div>
        <div>Denylisted: <strong>{progress.denylisted || 0}</strong></div>
        <div>Imported: <strong>{progress.imported}</strong></div>
        <div>Skipped: <strong>{progress.skipped}</strong></div>
        <div>Errors: <strong>{progress.errors}</strong></div>
      </div>

      <section>
        <h2 className="font-medium mb-2">Log</h2>
        <pre className="whitespace-pre-wrap rounded border bg-gray-50 p-3 text-xs max-h-64 overflow-auto">
{log.join('\n')}
        </pre>
      </section>
    </main>
  );
}
