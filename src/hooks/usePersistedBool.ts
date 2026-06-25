"use client";

import { useEffect, useState } from "react";

/**
 * A boolean state that persists to localStorage and restores on refresh.
 *
 * Renders the SSR/initial value first (so there's no hydration mismatch), then
 * reads the stored value on mount. The returned `hydrated` flag lets callers
 * suppress transitions/animations until after the stored value is applied, so
 * the restored state snaps in without a visible slide.
 */
export function usePersistedBool(
  key: string,
  initial = false,
): readonly [boolean, React.Dispatch<React.SetStateAction<boolean>>, boolean] {
  const [value, setValue] = useState(initial);
  const [hydrated, setHydrated] = useState(false);

  // Restore once on mount.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) setValue(stored === "1");
    } catch {
      /* localStorage unavailable — ignore */
    }
    setHydrated(true);
  }, [key]);

  // Persist on change (only after the initial restore).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [key, value, hydrated]);

  return [value, setValue, hydrated] as const;
}
