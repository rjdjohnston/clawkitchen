import { describe, expect, it } from "vitest";
import { pollUntil } from "../poll";

describe("poll", () => {
  describe("pollUntil", () => {
    it("returns result when check succeeds immediately", async () => {
      const result = await pollUntil(async () => "done", { timeoutMs: 1000 });
      expect(result).toBe("done");
    });

    it("returns result when check succeeds after retries", async () => {
      let attempts = 0;
      const result = await pollUntil(async () => {
        attempts++;
        return attempts >= 3 ? "ready" : null;
      }, { timeoutMs: 5000, intervalMs: 10 });
      expect(result).toBe("ready");
      expect(attempts).toBe(3);
    });

    it("returns null when timeout", async () => {
      const result = await pollUntil(async () => null, { timeoutMs: 50, intervalMs: 20 });
      expect(result).toBeNull();
    });
  });
});
