import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "../skills/available/route";

vi.mock("node:fs/promises", () => ({
  default: { readdir: vi.fn() },
}));
vi.mock("node:os", () => ({
  default: { homedir: () => "/home/user" },
}));

import fs from "node:fs/promises";

describe("api skills available route", () => {
  beforeEach(() => {
    vi.mocked(fs.readdir).mockReset();
  });

  it("returns skills from ~/.openclaw/skills", async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: "skill-a", isDirectory: () => true } as never,
      { name: "skill-b", isDirectory: () => true } as never,
      { name: "file.txt", isDirectory: () => false } as never,
    ] as never[]);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.skillsDir).toContain(".openclaw/skills");
    expect(json.skills).toEqual(["skill-a", "skill-b"]);
    expect(fs.readdir).toHaveBeenCalledWith(
      expect.stringContaining(".openclaw/skills"),
      { withFileTypes: true }
    );
  });

  it("returns empty skills when dir missing", async () => {
    vi.mocked(fs.readdir).mockRejectedValue(new Error("ENOENT"));

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.skills).toEqual([]);
    expect(json.note).toBe("ENOENT");
  });
});
