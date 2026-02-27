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

function safeParseJsonLine(line: string): unknown {
  const t = line.trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function asMemoryItem(x: unknown): MemoryItem | null {
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

async function listJsonlFiles(dir: string): Promise<string[]> {
  try {
    const names = await fs.readdir(dir);
    return names.filter((n) => n.toLowerCase().endsWith(".jsonl")).sort();
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  return withTeamContextFromQuery(req, async ({ teamId, teamDir }) => {
    try {
      const memoryDir = path.join(teamDir, "shared-context", "memory");
      const files = await listJsonlFiles(memoryDir);

      const items: MemoryItem[] = [];
      for (const f of files) {
        const full = path.join(memoryDir, f);
        let text = "";
        try {
          text = await fs.readFile(full, "utf8");
        } catch {
          continue;
        }

        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const raw = safeParseJsonLine(lines[i] ?? "");
          const item = asMemoryItem(raw);
          if (!item) continue;
          items.push({ ...item, _file: f, _line: i + 1 });
        }
      }

      // Most recent first (lexical ISO timestamps).
      items.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));

      return NextResponse.json({ ok: true, teamId, memoryDir, files, items: items.slice(0, 200) });
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
    const ts = String(o.ts ?? "").trim();
    const author = String(o.author ?? "").trim();
    const type = String(o.type ?? "").trim();
    const content = String(o.content ?? "").trim();
    const source = o.source;
    const file = String(o.file ?? "team.jsonl").trim() || "team.jsonl";

    if (!ts || !author || !type || !content) {
      return NextResponse.json(
        { ok: false, error: "ts, author, type, and content are required" },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9_.\-]+\.jsonl$/i.test(file)) {
      return NextResponse.json({ ok: false, error: "Invalid file" }, { status: 400 });
    }

    try {
      const memoryDir = path.join(teamDir, "shared-context", "memory");
      await fs.mkdir(memoryDir, { recursive: true });
      const full = path.join(memoryDir, file);
      const item: MemoryItem = { ts, author, type, content, ...(source !== undefined ? { source } : {}) };
      await fs.appendFile(full, JSON.stringify(item) + "\n", "utf8");
      return NextResponse.json({ ok: true, teamId, file, item });
    } catch (e: unknown) {
      return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
    }
  });
}
