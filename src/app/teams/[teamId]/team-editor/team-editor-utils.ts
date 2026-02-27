export function safeParseJson<T>(text: string, def: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return def;
  }
}

function replaceOrAddIdInLines(lines: string[], id: string): string[] {
  let found = false;
  const next = lines.map((line) => {
    if (/^id\s*:/i.test(line)) {
      found = true;
      return `id: ${id}`;
    }
    return line;
  });
  if (!found) next.unshift(`id: ${id}`);
  return next;
}

export function forceFrontmatterId(md: string, id: string): string {
  if (!md.startsWith("---\n")) return md;
  const end = md.indexOf("\n---\n", 4);
  if (end === -1) return md;
  const fm = md.slice(4, end);
  const body = md.slice(end + 5);
  const nextLines = replaceOrAddIdInLines(fm.split("\n"), id);
  return `---\n${nextLines.join("\n")}\n---\n${body}`;
}

function patchTeamIdInLines(
  lines: string[],
  teamId: string
): { next: string[]; sawTeamBlock: boolean; patched: boolean } {
  const next: string[] = [];
  let inTeam = false;
  let sawTeamBlock = false;
  let patched = false;

  for (const line of lines) {
    if (/^team\s*:\s*$/i.test(line)) {
      inTeam = true;
      sawTeamBlock = true;
      next.push(line);
      continue;
    }
    if (inTeam && /^\S/.test(line)) inTeam = false;
    if (inTeam && /^\s+teamId\s*:/i.test(line)) {
      next.push(`  teamId: ${teamId}`);
      patched = true;
      continue;
    }
    next.push(line);
  }
  return { next, sawTeamBlock, patched };
}

export function forceFrontmatterTeamTeamId(md: string, teamId: string): string {
  if (!md.startsWith("---\n")) return md;
  const end = md.indexOf("\n---\n", 4);
  if (end === -1) return md;

  const fm = md.slice(4, end);
  const body = md.slice(end + 5);
  const lines = fm.split("\n");
  const { next, sawTeamBlock, patched } = patchTeamIdInLines(lines, teamId);

  if (sawTeamBlock && !patched) {
    const out: string[] = [];
    for (const line of next) {
      out.push(line);
      if (/^team\s*:\s*$/i.test(line)) out.push(`  teamId: ${teamId}`);
    }
    return `---\n${out.join("\n")}\n---\n${body}`;
  }
  return `---\n${next.join("\n")}\n---\n${body}`;
}
