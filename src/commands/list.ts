import { readRegistry, type RegistryEntry } from "../core/registry.js";
import { parseSkillFile } from "../core/skill.js";
import * as print from "../utils/print.js";

export async function listAction(options: {
  active?: boolean;
  inactive?: boolean;
  json?: boolean;
}): Promise<void> {
  const registry = readRegistry();
  let skills = registry.skills;

  if (options.active) {
    skills = skills.filter((s) => s.active);
  } else if (options.inactive) {
    skills = skills.filter((s) => !s.active);
  }

  if (skills.length === 0) {
    print.info(
      "No skills registered. Run 'claude-skills add --all' to scan ~/.claude/skills/"
    );
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(skills, null, 2));
    return;
  }

  // Sort: active first, then alphabetical
  skills.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  console.log("");
  console.log(
    print.bold(`GLOBAL (${skills.length} skill${skills.length !== 1 ? "s" : ""})`)
  );

  const rows: string[][] = [];
  for (const entry of skills) {
    const status = entry.active ? "✓" : "✗";
    const parsed = parseSkillFile(entry.path);
    const version = parsed?.meta.version || "—";
    const desc = parsed?.meta.description?.replace(/\n/g, " ").slice(0, 60) || "—";
    rows.push([`  ${status}`, entry.name, version, desc]);
  }

  print.table(rows);
  console.log("");
}
