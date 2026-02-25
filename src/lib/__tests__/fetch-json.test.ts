import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchJson, fetchJsonWithStatus } from "../fetch-json";

describe("fetchJson", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/ok")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: "success" }),
          } as Response);
        }
        if (url.includes("/error")) {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ error: "Bad request" }),
          } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
        } as Response);
      })
    );
  });

  it("returns parsed JSON on success", async () => {
    const result = await fetchJson<{ data: string }>("https://example.com/ok");
    expect(result).toEqual({ data: "success" });
  });

  it("throws with error message on !res.ok", async () => {
    await expect(fetchJson("https://example.com/error")).rejects.toThrow("Bad request");
  });

  it("throws generic message when error field missing", async () => {
    await expect(fetchJson("https://example.com/other")).rejects.toThrow("Request failed");
  });
});

describe("fetchJsonWithStatus", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/ok")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: "success" }),
          } as Response);
        }
        if (url.includes("/409")) {
          return Promise.resolve({
            ok: false,
            status: 409,
            json: () => Promise.resolve({ error: "Conflict" }),
          } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
        } as Response);
      })
    );
  });

  it("returns { ok: true, data } on success", async () => {
    const result = await fetchJsonWithStatus<{ data: string }>("https://example.com/ok");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ data: "success" });
  });

  it("returns { ok: false, status, error } on HTTP error", async () => {
    const result = await fetchJsonWithStatus("https://example.com/409");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.error).toBe("Conflict");
    }
  });

  it("returns generic error when error field missing", async () => {
    const result = await fetchJsonWithStatus("https://example.com/other");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error).toBe("Request failed");
    }
  });
});
