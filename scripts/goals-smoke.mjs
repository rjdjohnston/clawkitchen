#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const WORKSPACE = "/home/control/.openclaw/workspace";
const GOALS_DIR = path.join(WORKSPACE, "notes", "goals");

const id = `smoke-goal-${Date.now()}`;
const file = path.join(GOALS_DIR, `${id}.md`);

function assert(cond, msg) {
  if (!cond) {
    console.error("[goals-smoke] FAIL:", msg);
    process.exit(1);
  }
}

await fs.mkdir(GOALS_DIR, { recursive: true });

const initial = `---\nid: ${id}\ntitle: Smoke goal\nstatus: planned\ntags: []\nteams: [development-team]\nupdatedAt: ${new Date().toISOString()}\n---\n\nHello world\n`;
await fs.writeFile(file, initial, "utf8");

const read1 = await fs.readFile(file, "utf8");
assert(read1.includes(`id: ${id}`), "create/read failed");

const updated = read1.replace("Smoke goal", "Smoke goal updated");
await fs.writeFile(file, updated, "utf8");

const read2 = await fs.readFile(file, "utf8");
assert(read2.includes("Smoke goal updated"), "update failed");

await fs.unlink(file);

console.log("[goals-smoke] OK");
