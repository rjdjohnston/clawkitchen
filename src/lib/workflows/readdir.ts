import fs from "node:fs/promises";

/** Reads dir with optional suffix filter and reverse sort. Returns { ok, dir, files } or { ok, dir, files: [] } on ENOENT. */
export async function readdirFiles(
  dir: string,
  suffix: string,
  reverse = false
): Promise<{ ok: true; dir: string; files: string[] }> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let files = entries
      .filter((e) => e.isFile() && e.name.endsWith(suffix))
      .map((e) => e.name)
      .sort();
    if (reverse) files = files.reverse();
    return { ok: true as const, dir, files };
  } catch (err: unknown) {
    if (err && typeof err === "object" && (err as { code?: unknown }).code === "ENOENT") {
      return { ok: true as const, dir, files: [] as string[] };
    }
    throw err;
  }
}
