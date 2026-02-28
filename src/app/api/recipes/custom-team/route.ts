import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getWorkspaceRecipesDir } from "@/lib/paths";

function isValidId(id: string) {
  // Keep consistent with common recipe/team id expectations.
  return /^[a-z0-9][a-z0-9_-]{1,62}$/.test(id);
}

function yamlEscape(s: string) {
  // Minimal YAML escaping for simple strings.
  const trimmed = s.replace(/\r\n/g, "\n").trimEnd();
  if (!trimmed) return "\"\"";
  // If it's a safe bare string, keep it readable.
  if (/^[A-Za-z0-9 _.,:;()\[\]{}\-+/@]+$/.test(trimmed) && !/[:#\n]/.test(trimmed)) {
    return trimmed;
  }
  return JSON.stringify(trimmed);
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    dryRun?: boolean;
    recipeId?: string;
    teamId?: string;
    name?: string;
    description?: string;
    roles?: Array<{ roleId?: string; displayName?: string }>;
  };

  const dryRun = !!body.dryRun;
  const recipeId = String(body.recipeId ?? body.teamId ?? "").trim();
  const teamId = String(body.teamId ?? recipeId).trim();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const roles = Array.isArray(body.roles) ? body.roles : [];

  if (!recipeId) return NextResponse.json({ ok: false, error: "recipeId is required" }, { status: 400 });
  if (!teamId) return NextResponse.json({ ok: false, error: "teamId is required" }, { status: 400 });
  if (!isValidId(recipeId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid recipeId. Use lowercase letters/numbers with - or _ (2-63 chars)." },
      { status: 400 },
    );
  }
  if (!isValidId(teamId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid teamId. Use lowercase letters/numbers with - or _ (2-63 chars)." },
      { status: 400 },
    );
  }
  if (!teamId.endsWith("-team")) {
    return NextResponse.json(
      { ok: false, error: "teamId must end with -team" },
      { status: 400 },
    );
  }

  if (roles.length < 1) {
    return NextResponse.json({ ok: false, error: "Select at least one role/agent" }, { status: 400 });
  }

  const normalizedRoles = roles
    .map((r) => ({
      roleId: String(r.roleId ?? "").trim(),
      displayName: typeof r.displayName === "string" ? r.displayName.trim() : "",
    }))
    .filter((r) => r.roleId);

  if (normalizedRoles.length < 1) {
    return NextResponse.json({ ok: false, error: "Each selected agent must have a roleId" }, { status: 400 });
  }

  const roleSet = new Set<string>();
  for (const r of normalizedRoles) {
    if (!isValidId(r.roleId)) {
      return NextResponse.json(
        { ok: false, error: `Invalid roleId: ${r.roleId}. Use lowercase letters/numbers with - or _.` },
        { status: 400 },
      );
    }
    if (roleSet.has(r.roleId)) {
      return NextResponse.json({ ok: false, error: `Duplicate roleId: ${r.roleId}` }, { status: 400 });
    }
    roleSet.add(r.roleId);
  }

  const dir = await getWorkspaceRecipesDir();
  const filePath = path.join(dir, `${recipeId}.md`);

  try {
    await fs.access(filePath);
    return NextResponse.json({ ok: false, error: `Recipe already exists: ${recipeId}` }, { status: 409 });
  } catch {
    // ok
  }

  const lines: string[] = [];
  lines.push("---");
  lines.push(`id: ${recipeId}`);
  lines.push(`name: ${yamlEscape(name || recipeId)}`);
  lines.push(`version: 0.1.0`);
  if (description) lines.push(`description: ${yamlEscape(description)}`);
  lines.push("kind: team");
  lines.push("requiredSkills: []");
  lines.push("team:");
  lines.push(`  teamId: ${teamId}`);
  lines.push("agents:");

  for (const r of normalizedRoles) {
    lines.push(`  - role: ${r.roleId}`);
    if (r.displayName) lines.push(`    name: ${yamlEscape(r.displayName)}`);
    lines.push("    tools:");
    lines.push("      profile: coding");
    lines.push("      allow:");
    lines.push("        - group:fs");
    lines.push("        - group:web");
    lines.push("        - group:runtime");
    lines.push("      deny:");
    lines.push("        - exec");
  }

  lines.push("templates:");

  for (const r of normalizedRoles) {
    const roleId = r.roleId;

    lines.push(`  ${roleId}.soul: |`);
    lines.push(`    # SOUL.md`);
    lines.push(`    `);
    lines.push(`    Role: ${roleId}`);
    lines.push(`    `);

    lines.push(`  ${roleId}.agents: |`);
    lines.push(`    # AGENTS.md`);
    lines.push(`    `);
    lines.push(`    You are the ${roleId} role in team ${teamId}.`);
    lines.push(`    `);

    lines.push(`  ${roleId}.tools: |`);
    lines.push(`    # TOOLS.md`);
    lines.push(`    `);
    lines.push(`    - (empty)`);
    lines.push(`    `);

    lines.push(`  ${roleId}.status: |`);
    lines.push(`    # STATUS.md`);
    lines.push(`    `);
    lines.push(`    - (empty)`);
    lines.push(`    `);

    lines.push(`  ${roleId}.notes: |`);
    lines.push(`    # NOTES.md`);
    lines.push(`    `);
    lines.push(`    - (empty)`);
    lines.push("");
  }

  lines.push("files:");
  lines.push("  - path: SOUL.md");
  lines.push("    template: soul");
  lines.push("    mode: createOnly");
  lines.push("  - path: AGENTS.md");
  lines.push("    template: agents");
  lines.push("    mode: createOnly");
  lines.push("  - path: TOOLS.md");
  lines.push("    template: tools");
  lines.push("    mode: createOnly");
  lines.push("  - path: STATUS.md");
  lines.push("    template: status");
  lines.push("    mode: createOnly");
  lines.push("  - path: NOTES.md");
  lines.push("    template: notes");
  lines.push("    mode: createOnly");

  lines.push("---");
  lines.push("");
  lines.push("# Custom team recipe");
  lines.push("");
  lines.push("Generated by ClawKitchen Custom Team Builder.");
  lines.push("");

  const md = lines.join("\n");

  if (dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, recipeId, teamId, filePath, md });
  }

  await fs.writeFile(filePath, md, "utf8");

  return NextResponse.json({ ok: true, recipeId, teamId, filePath });
}
