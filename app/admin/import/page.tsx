// app/admin/import/page.tsx
import ImportRunner from "@/components/ImportRunner";

export const dynamic = "force-dynamic";

export default function AdminImportPage() {
  // Pre-fill from env if present
  const defaultSteamId = process.env.STEAM_USER_ID ?? "";
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Steam Import</h1>
      <p className="text-sm text-gray-600">
        Kick off imports of owned games using your API. This calls
        <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5">/api/steam/owned</code>
        in chunks until all requested games are processed.
      </p>
      <ImportRunner defaultSteamId={defaultSteamId} />
    </div>
  );
}
