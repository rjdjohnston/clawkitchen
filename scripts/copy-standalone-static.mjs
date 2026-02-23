import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const from = path.join(root, ".next", "static");
const to = path.join(root, ".next", "standalone", ".next", "static");

async function exists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(from))) {
  console.error(`[postbuild] Missing: ${from}`);
  process.exit(1);
}

await fs.mkdir(to, { recursive: true });

// Node 18+ supports fs.cp
await fs.cp(from, to, { recursive: true, force: true });

console.log(`[postbuild] Copied Next static assets:\n- from: ${from}\n- to:   ${to}`);
