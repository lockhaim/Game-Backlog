// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata = {
  title: "Game Backlog",
  description: "Track and explore your Steam games",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="min-h-full antialiased">
        <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color:var(--bg)]/80 backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
            <a href="/games" className="font-semibold text-[var(--fg)]">
              Game Backlog
            </a>
            <div className="flex items-center gap-2">
              <a
                href="/games"
                className="text-sm text-[var(--muted)] hover:text-[var(--fg)]"
              >
                Browse
              </a>
              <a
                href="/backlog"
                className="text-sm text-[var(--muted)] hover:text-[var(--fg)]"
              >
                My Backlog
              </a>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
