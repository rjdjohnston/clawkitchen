import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getKitchenApi } from "../kitchen-api";

describe("kitchen-api", () => {
  beforeEach(() => {
    delete (globalThis as unknown as { __clawkitchen_api?: unknown }).__clawkitchen_api;
  });

  afterEach(() => {
    delete (globalThis as unknown as { __clawkitchen_api?: unknown }).__clawkitchen_api;
  });

  it("throws when __clawkitchen_api is missing", () => {
    expect(() => getKitchenApi()).toThrow(
      "ClawKitchen: OpenClaw plugin API not available"
    );
  });

  it("returns api when __clawkitchen_api is set", () => {
    const mockApi = {
      config: {},
      runtime: {
        system: {
          runCommandWithTimeout: async () => ({ stdout: "", stderr: "" }),
        },
      },
    };
    (globalThis as unknown as { __clawkitchen_api?: unknown }).__clawkitchen_api = mockApi;

    expect(getKitchenApi()).toBe(mockApi);
  });
});
