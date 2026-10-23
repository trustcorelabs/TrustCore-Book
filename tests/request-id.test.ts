import { afterEach, expect, it, vi } from "vitest";
import { requestId } from "@/lib/utils";
afterEach(() => vi.unstubAllGlobals());
it("generates a v4 id on insecure HTTP where randomUUID is unavailable", () => {
  const original = globalThis.crypto;
  vi.stubGlobal("crypto", {
    getRandomValues: original.getRandomValues.bind(original),
  });
  const ids = Array.from({ length: 10 }, requestId);
  expect(new Set(ids).size).toBe(10);
  for (const id of ids)
    expect(id).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
    );
});
