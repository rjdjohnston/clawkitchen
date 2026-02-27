import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../gateway/restart/route";

vi.mock("@/lib/openclaw", () => ({ runOpenClaw: vi.fn() }));
import { runOpenClaw } from "@/lib/openclaw";

describe("api gateway restart route", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(runOpenClaw).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 200 and schedules restart", async () => {
    vi.mocked(runOpenClaw).mockResolvedValue({ ok: true, exitCode: 0, stdout: "", stderr: "" });

    const res = await POST();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.scheduled).toBe(true);

    expect(runOpenClaw).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(runOpenClaw).toHaveBeenCalledWith(["gateway", "restart"]);
  });

  it("responds immediately before restart runs", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(runOpenClaw).not.toHaveBeenCalled();
  });
});
