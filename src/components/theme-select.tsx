"use client";
import { useColorTheme } from "@/hooks/use-color-theme";
import { ChevronDown } from "lucide-react";
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
    <div className="relative w-32 shrink-0 sm:w-36">
      <label className="sr-only" htmlFor={id}>
        Color theme
      </label>
      <select
        id={id}
        className="input h-10 appearance-none pl-3 pr-9 text-xs"
        aria-label="Color theme"
        value={mounted ? (theme ?? "system") : "system"}
        disabled={!mounted}
        onChange={(e) => setTheme(e.target.value)}
      >
        <option value="system">System theme</option>
        <option value="light">Light theme</option>
        <option value="dark">Dark theme</option>
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
