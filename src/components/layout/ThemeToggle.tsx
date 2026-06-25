"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * Light/dark toggle. The `.dark` class is applied to <html> by the inline
 * no-flash script in the root layout before paint; this just flips it and
 * persists the choice. `onDark` lets the header (blue, white icons) style the
 * button differently from a neutral surface.
 */
export default function ThemeToggle({ onDark = false }: { onDark?: boolean }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }

  const base = onDark
    ? "text-white/70 hover:text-white hover:bg-white/12"
    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10";

  return (
    <button
      type="button"
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
      className={`w-9 h-9 flex items-center justify-center rounded transition-colors ${base}`}
    >
      {/* Render a stable icon until mounted to avoid hydration flicker */}
      {mounted && dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
