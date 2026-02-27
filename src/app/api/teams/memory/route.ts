import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { withTeamContextFromQuery } from "@/lib/api-route-helpers";
import { errorMessage } from "@/lib/errors";

type MemoryItem = {
  ts: string;
  author: string;
  type: string;
  content: string;
  source?: unknown;
  _file?: string;
  _line?: number;
};

type MemoryPointer = {
  file: "team.jsonl";
  line: number;
};

type PinnedOp =
  | {
      op: "pin";
      ts: string;
      actor: string;
      key: MemoryPointer;
      item: Omit<MemoryItem, "_file" | "_line">;
    }
  | {
      op: "unpin";
      ts: string;
      actor: string;
      key: MemoryPointer;
    };

const TEAM_FILE = "team.jsonl" as const;
const PINNED_FILE = "pinned.jsonl" as const;

function safeParseJsonLine(line: string): unknown {
  const t = line.trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function asMemoryItem(x: unknown): Omit<MemoryItem, "_file" | "_line"> | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const ts = String(o.ts ?? "").trim();
  const author = String(o.author ?? "").trim();
  const type = String(o.type ?? "").trim();
  const content = String(o.content ?? "").trim();
  if (!ts || !author || !type || !content) return null;
  const source = o.source;
  return { ts, author, type, content, source };
}

function asPointer(x: unknown): MemoryPointer | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const file = String(o.file ?? "").trim();
  const line = Number(o.line);
  if (file !== TEAM_FILE) return null;
  if (!Number.isFinite(line) || line <= 0) return null;
  return { file: TEAM_FILE, line: Math.floor(line) };
}

function asPinnedOp(x: unknown): PinnedOp | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const op = String(o.op ?? "").trim();
  const ts = String(o.ts ?? "").trim();
  const actor = String(o.actor ?? "").trim();
  const key = asPointer(o.key);

  if (!op || !ts || !actor || !key) return null;

  if (op === "pin") {
    const item = asMemoryItem(o.item);
    if (!item) return null;
    return { op: "pin", ts, actor, key, item };
  }

  if (op === "unpin") {
    return { op: "unpin", ts, actor, key };
  }

  return null;
}

async function readJsonlFile(full: string): Promise<string[]> {
  try {
    const text = await fs.readFile(full, "utf8");
    return text.split(/\r?\n/);
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  return withTeamContextFromQuery(req, async ({ teamId, teamDir }) => {
    try {
      const memoryDir = path.join(teamDir, "shared-context", "memory");
      const teamFull = path.join(memoryDir, TEAM_FILE);
      const pinnedFull = path.join(memoryDir, PINNED_FILE);

      // Load team items.
      const teamLines = await readJsonlFile(teamFull);
      const teamItems: MemoryItem[] = [];
      for (let i = 0; i < teamLines.length; i++) {
        const raw = safeParseJsonLine(teamLines[i] ?? "");
        const item = asMemoryItem(raw);
        if (!item) continue;
        teamItems.push({ ...item, _file: TEAM_FILE, _line: i + 1 });
      }

      // Load pinned operations and compute active pinned set.
      const pinnedLines = await readJsonlFile(pinnedFull);
      const pinnedByKey = new Map<string, { key: MemoryPointer; item: Omit<MemoryItem, "_file" | "_line">; pinnedAt: string; pinnedBy: string }>();

      for (const line of pinnedLines) {
        const raw = safeParseJsonLine(line);
        const op = asPinnedOp(raw);
        if (!op) continue;
        const k = `${op.key.file}:${op.key.line}`;
        if (op.op === "pin") {
          pinnedByKey.set(k, { key: op.key, item: op.item, pinnedAt: op.ts, pinnedBy: op.actor });
        } else {
          pinnedByKey.delete(k);
        }
      }

      const pinnedItems: (MemoryItem & { pinnedAt: string; pinnedBy: string; _key: string })[] = Array.from(pinnedByKey.values()).map(
        ({ key, item, pinnedAt, pinnedBy }) => ({
          ...item,
          _file: key.file,
          _line: key.line,
          pinnedAt,
          pinnedBy,
          _key: `${key.file}:${key.line}`,
        })
      );

      // Sort pinned by pinnedAt desc (then item.ts desc).
      pinnedItems.sort((a, b) => String(b.pinnedAt).localeCompare(String(a.pinnedAt)) || String(b.ts).localeCompare(String(a.ts)));

      // Recent: exclude pinned keys and show most recent first.
      const pinnedKeys = new Set(pinnedItems.map((x) => x._key));
      const recentItems = teamItems
        .filter((x) => !pinnedKeys.has(`${x._file ?? ""}:${x._line ?? 0}`))
        .sort((a, b) => String(b.ts).localeCompare(String(a.ts)))
        .slice(0, 200);

      return NextResponse.json({
        ok: true,
        teamId,
        memoryDir,
        files: [TEAM_FILE, PINNED_FILE],
        pinnedItems,
        items: recentItems,
      });
    } catch (e: unknown) {
      return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
    }
  });
}

export async function POST(req: Request) {
  return withTeamContextFromQuery(req, async ({ teamId, teamDir }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

    const op = String(o.op ?? "append").trim() || "append";

    // Shared validation.
    const actor = String(o.actor ?? "").trim() || `${teamId}-lead`;

    try {
      const memoryDir = path.join(teamDir, "shared-context", "memory");
      await fs.mkdir(memoryDir, { recursive: true });

      // Append to team.jsonl (existing behavior) — explicitly allowlisted.
      if (op === "append") {
        const ts = String(o.ts ?? "").trim();
        const author = String(o.author ?? "").trim();
        const type = String(o.type ?? "").trim();
        const content = String(o.content ?? "").trim();
        const source = o.source;

        if (!ts || !author || !type || !content) {
          return NextResponse.json(
            { ok: false, error: "ts, author, type, and content are required" },
            { status: 400 }
          );
        }

        // Safety: only allow appends to team.jsonl.
        const file = String(o.file ?? TEAM_FILE).trim() || TEAM_FILE;
        if (file !== TEAM_FILE) {
          return NextResponse.json({ ok: false, error: "Invalid file" }, { status: 400 });
        }

        const full = path.join(memoryDir, TEAM_FILE);
        const item: MemoryItem = { ts, author, type, content, ...(source !== undefined ? { source } : {}) };
        await fs.appendFile(full, JSON.stringify(item) + "\n", "utf8");
        return NextResponse.json({ ok: true, teamId, file: TEAM_FILE, item });
      }

      // Pin/unpin operations: append-only ops into pinned.jsonl.
      if (op === "pin" || op === "unpin") {
        const ts = String(o.ts ?? new Date().toISOString()).trim();
        const key = asPointer(o.key);
        if (!key) {
          return NextResponse.json({ ok: false, error: "Invalid key" }, { status: 400 });
        }

        if (op === "pin") {
          const item = asMemoryItem(o.item);
          if (!item) {
            return NextResponse.json({ ok: false, error: "Invalid item" }, { status: 400 });
          }

          const record: PinnedOp = { op: "pin", ts, actor, key, item };
          const full = path.join(memoryDir, PINNED_FILE);
          await fs.appendFile(full, JSON.stringify(record) + "\n", "utf8");
          return NextResponse.json({ ok: true, teamId, op: "pin", key });
        }

        const record: PinnedOp = { op: "unpin", ts, actor, key };
        const full = path.join(memoryDir, PINNED_FILE);
        await fs.appendFile(full, JSON.stringify(record) + "\n", "utf8");
        return NextResponse.json({ ok: true, teamId, op: "unpin", key });
      }

      return NextResponse.json({ ok: false, error: `Unknown op: ${op}` }, { status: 400 });
    } catch (e: unknown) {
      return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
    }
  });
}
