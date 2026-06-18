"use client";

import { useState, useEffect, useRef } from "react";
import { Palette } from "lucide-react";

export type ThemeId = "waves" | "geometric" | "circuit" | "kente" | "constellation";

const STORAGE_KEY = "student-header-theme";
const DEFAULT_THEME: ThemeId = "waves";

// ── SVG corner decorations ────────────────────────────────────────────────────

/* Fluent — large overlapping soft circles, like Microsoft 365 hero art */
function FluentSvg() {
  return (
    <svg className="absolute right-0 top-0 h-full w-[480px] pointer-events-none" viewBox="0 0 480 48" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="fg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.22"/>
          <stop offset="100%" stopColor="white" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="fg2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.16"/>
          <stop offset="100%" stopColor="white" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="fg3" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.12"/>
          <stop offset="100%" stopColor="white" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="420" cy="0" rx="110" ry="70" fill="url(#fg1)"/>
      <ellipse cx="360" cy="48" rx="130" ry="80" fill="url(#fg2)"/>
      <ellipse cx="280" cy="10" rx="90" ry="60" fill="url(#fg3)"/>
      <ellipse cx="460" cy="36" rx="70" ry="50" fill="url(#fg2)"/>
    </svg>
  );
}

/* Prism — bold filled triangles, Azure/M365 branding feel */
function PrismSvg() {
  return (
    <svg className="absolute right-0 top-0 h-full w-[420px] pointer-events-none" viewBox="0 0 420 48" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <polygon points="420,0 260,0 420,48" fill="white" opacity="0.10"/>
      <polygon points="420,0 310,0 420,38" fill="white" opacity="0.10"/>
      <polygon points="420,0 350,0 420,28" fill="white" opacity="0.10"/>
      <polygon points="420,0 380,0 420,18" fill="white" opacity="0.12"/>
      <polygon points="340,0 200,0 280,48 420,48" fill="white" opacity="0.06"/>
      <polygon points="300,0 160,0 240,48 380,48" fill="none" stroke="white" strokeWidth="0.8" opacity="0.20"/>
      <polygon points="260,0 130,0 200,48 330,48" fill="none" stroke="white" strokeWidth="0.6" opacity="0.14"/>
      <polygon points="220,0 100,0 160,48 280,48" fill="none" stroke="white" strokeWidth="0.5" opacity="0.09"/>
    </svg>
  );
}

/* Ripple — concentric arcs from top-right corner, clean and modern */
function RippleSvg() {
  return (
    <svg className="absolute right-0 top-0 h-full w-[400px] pointer-events-none" viewBox="0 0 400 48" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      {[80, 130, 180, 230, 290, 355, 420].map((r, i) => (
        <circle key={i} cx="400" cy="0" r={r} fill="none" stroke="white" strokeWidth="1.2" opacity={0.22 - i * 0.025}/>
      ))}
      <circle cx="400" cy="0" r="40" fill="white" opacity="0.12"/>
      <circle cx="400" cy="0" r="20" fill="white" opacity="0.10"/>
    </svg>
  );
}

/* Mesh — diagonal dot-grid with gradient fade, Windows 11 / Copilot feel */
function MeshSvg() {
  return (
    <svg className="absolute right-0 top-0 h-full w-[460px] pointer-events-none" viewBox="0 0 460 48" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <defs>
        <pattern id="mdot" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)">
          <circle cx="9" cy="9" r="1.4" fill="white" opacity="0.55"/>
        </pattern>
        <linearGradient id="mfade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0"/>
          <stop offset="45%" stopColor="white" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="white" stopOpacity="0.9"/>
        </linearGradient>
        <mask id="mmask">
          <rect width="460" height="48" fill="url(#mfade)"/>
        </mask>
      </defs>
      <rect width="460" height="48" fill="url(#mdot)" mask="url(#mmask)"/>
      <line x1="460" y1="0" x2="200" y2="48" stroke="white" strokeWidth="1" opacity="0.15"/>
      <line x1="460" y1="0" x2="300" y2="48" stroke="white" strokeWidth="1" opacity="0.10"/>
    </svg>
  );
}

/* Aurora — layered diagonal gradient bands, Windows 11 wallpaper style */
function AuroraSvg() {
  return (
    <svg className="absolute right-0 top-0 h-full w-[500px] pointer-events-none" viewBox="0 0 500 48" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="ab1" x1="0" x2="1" y1="1" y2="0">
          <stop offset="0%" stopColor="#7eb3ff" stopOpacity="0"/>
          <stop offset="100%" stopColor="#7eb3ff" stopOpacity="0.28"/>
        </linearGradient>
        <linearGradient id="ab2" x1="0" x2="1" y1="1" y2="0">
          <stop offset="0%" stopColor="#a5c8ff" stopOpacity="0"/>
          <stop offset="100%" stopColor="#a5c8ff" stopOpacity="0.20"/>
        </linearGradient>
        <linearGradient id="ab3" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="white" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points="500,0 180,0 500,48" fill="url(#ab1)"/>
      <polygon points="500,0 280,0 500,48" fill="url(#ab2)"/>
      <polygon points="500,0 350,0 500,30" fill="url(#ab3)"/>
      <line x1="180" y1="0" x2="500" y2="48" stroke="white" strokeWidth="0.8" opacity="0.18"/>
      <line x1="280" y1="0" x2="500" y2="48" stroke="white" strokeWidth="0.6" opacity="0.13"/>
      <line x1="350" y1="0" x2="500" y2="30" stroke="white" strokeWidth="0.5" opacity="0.10"/>
    </svg>
  );
}

const THEMES: { id: ThemeId; label: string; Component: () => JSX.Element }[] = [
  { id: "waves",         label: "Fluent",       Component: FluentSvg },
  { id: "geometric",     label: "Prism",        Component: PrismSvg },
  { id: "circuit",       label: "Ripple",       Component: RippleSvg },
  { id: "kente",         label: "Mesh",         Component: MeshSvg },
  { id: "constellation", label: "Aurora",       Component: AuroraSvg },
];

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useHeaderTheme() {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (stored && THEMES.some((t) => t.id === stored)) setThemeState(stored);
  }, []);

  function setTheme(id: ThemeId) {
    setThemeState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  return { theme, setTheme };
}

// ── Corner decoration renderer ────────────────────────────────────────────────

export function HeaderDecoration({ theme }: { theme: ThemeId }) {
  const entry = THEMES.find((t) => t.id === theme);
  if (!entry) return null;
  return <entry.Component />;
}

// ── Theme picker popover ──────────────────────────────────────────────────────

export function ThemePicker({ theme, setTheme }: { theme: ThemeId; setTheme: (id: ThemeId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Change header style"
        className="w-9 h-9 flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/12 transition-colors"
      >
        <Palette size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[220px] bg-white rounded-md border border-[#edebe9] shadow-lg z-[200] overflow-hidden">
          <div className="px-3 py-2 border-b border-[#f1f5f9]">
            <p className="text-[11px] font-semibold text-[#323130] uppercase tracking-wider">Header Style</p>
          </div>
          <div className="p-2 grid grid-cols-1 gap-1">
            {THEMES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => { setTheme(id); setOpen(false); }}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded text-[12px] font-medium transition-colors text-left ${
                  theme === id
                    ? "bg-[#002388]/10 text-[#002388]"
                    : "text-[#323130] hover:bg-[#f8f9fa]"
                }`}
              >
                {/* mini preview */}
                <div className="w-10 h-6 rounded bg-[#002388] overflow-hidden relative flex-shrink-0">
                  <ThemePreviewMini id={id} />
                </div>
                {label}
                {theme === id && (
                  <svg className="ml-auto" width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#002388" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ThemePreviewMini({ id }: { id: ThemeId }) {
  const entry = THEMES.find((t) => t.id === id);
  if (!entry) return null;
  return (
    <div className="absolute inset-0 scale-75 origin-top-right">
      <entry.Component />
    </div>
  );
}
