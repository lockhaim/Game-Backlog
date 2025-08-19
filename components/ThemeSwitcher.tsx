"use client";

import { useEffect, useState } from "react";

const SWATCHES: { name: string; hsl: string }[] = [
  { name: "Blue",    hsl: "221 83% 53%" }, // blue-600
  { name: "Violet",  hsl: "262 83% 58%" }, // violet-600
  { name: "Emerald", hsl: "160 84% 39%" }, // emerald-600
  { name: "Amber",   hsl: "38 92% 50%"  }, // amber-500
  { name: "Pink",    hsl: "330 81% 60%" }, // pink-500
];

export default function ThemeSwitcher() {
  const [dark, setDark] = useState(false);
  const [accent, setAccent] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // hydrate from DOM/localStorage
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
    const a = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    setAccent(a || "221 83% 53%");
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  };

  const setAccentVar = (value: string) => {
    setAccent(value);
    document.documentElement.style.setProperty("--accent", value);
    try { localStorage.setItem("accent", value); } catch {}
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Button */}
      <button
        onClick={() => setOpen(!open)}
        className="rounded-full border px-3 py-2 card-surface shadow-sm hover:shadow-md transition"
        title="Theme & accent"
      >
        {dark ? "🌙" : "☀️"}
      </button>

      {/* Panel */}
      {open && (
        <div className="mt-2 w-64 rounded-2xl border card-surface shadow-lg p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Appearance</div>
            <button
              className="text-xs muted-fg hover:text-accent"
              onClick={toggleTheme}
            >
              Toggle {dark ? "Light" : "Dark"}
            </button>
          </div>

          <div className="mt-3 text-xs muted-fg">Accent</div>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {SWATCHES.map(s => (
              <button
                key={s.name}
                onClick={() => setAccentVar(s.hsl)}
                className="h-7 rounded-full ring-1 ring-[hsl(var(--border))]"
                style={{ backgroundColor: `hsl(${s.hsl})` }}
                title={s.name}
                aria-label={`Accent ${s.name}`}
              />
            ))}
            {/* custom input */}
            <input
              type="color"
              title="Custom accent"
              className="h-7 w-full rounded-full cursor-pointer"
              onChange={(e) => {
                // convert hex to HSL string for consistency
                const hex = e.target.value;
                const hsl = hexToHslString(hex); // helper below
                setAccentVar(hsl);
              }}
            />
          </div>

          <div className="mt-3 text-xs muted-fg">
            Current: <span className="text-accent font-medium">{accent}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Convert #rrggbb to "H S% L%" (space-separated, no hsl() wrapper) */
function hexToHslString(hex: string) {
  const { h, s, l } = hexToHsl(hex);
  return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
}

function hexToHsl(H: string) {
  let r = 0, g = 0, b = 0;
  if (H.length === 4) {
    r = parseInt(H[1] + H[1], 16);
    g = parseInt(H[2] + H[2], 16);
    b = parseInt(H[3] + H[3], 16);
  } else if (H.length === 7) {
    r = parseInt(H.slice(1, 3), 16);
    g = parseInt(H.slice(3, 5), 16);
    b = parseInt(H.slice(5, 7), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const cmin = Math.min(r, g, b);
  const cmax = Math.max(r, g, b);
  const delta = cmax - cmin;
  let h = 0;
  if (delta !== 0) {
    if (cmax === r) h = ((g - b) / delta) % 6;
    else if (cmax === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  const l = (cmax + cmin) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}
