"use client";
import { useColorTheme } from "@/hooks/use-color-theme";
import { useId, useSyncExternalStore } from "react";
const subscribe = () => () => {};
export function ThemeSelect() {
  const id = useId();
  const { theme, setTheme } = useColorTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <div className="w-32 shrink-0 sm:w-36">
      <label className="sr-only" htmlFor={id}>
        Color theme
      </label>
      <select
        id={id}
        className="input h-10 text-xs"
        aria-label="Color theme"
        value={mounted ? (theme ?? "system") : "system"}
        disabled={!mounted}
        onChange={(e) => setTheme(e.target.value)}
      >
        <option value="system">System theme</option>
        <option value="light">Light theme</option>
        <option value="dark">Dark theme</option>
      </select>
    </div>
  );
}
