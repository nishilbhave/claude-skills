import { readRegistry, type Registry, type RegistryEntry } from "../core/registry.js";
import { resolveRegistries } from "../core/resolver.js";
import { parseSkillFile } from "../core/skill.js";
import { getProjectRegistryPath } from "../utils/paths.js";
import { discoverAllPluginSkills, type DiscoveredPluginSkill } from "../core/plugins.js";
import * as print from "../utils/print.js";

function filterSkills(
  skills: RegistryEntry[],
  options: { active?: boolean; inactive?: boolean }
): RegistryEntry[] {
  if (options.active) return skills.filter((s) => s.active);
  if (options.inactive) return skills.filter((s) => !s.active);
  return skills;
}

function sortSkills(skills: RegistryEntry[]): RegistryEntry[] {
  return [...skills].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function printSection(label: string, skills: RegistryEntry[]): void {
  console.log(
    print.bold(`${label} (${skills.length} skill${skills.length !== 1 ? "s" : ""})`)
  );

  const rows: string[][] = [];
  for (const entry of skills) {
    const status = entry.active ? "✓" : "✗";
    const parsed = parseSkillFile(entry.path);
    const version = parsed?.meta.version || "—";
    const desc =
      parsed?.meta.description?.replace(/\n/g, " ").slice(0, 60) || "—";
    let sourceTag = "";
    if (entry.source.startsWith("github:")) sourceTag = " [gh]";
    else if (entry.source.startsWith("plugin:")) sourceTag = " [plugin]";
    rows.push([`  ${status}`, `${entry.name}${sourceTag}`, version, desc]);
  }

  print.table(rows);
}

export async function listAction(options: {
  active?: boolean;
  inactive?: boolean;
  json?: boolean;
  global?: boolean;
  project?: boolean;
}): Promise<void> {
  // If scoped to global only
  if (options.global) {
    const registry = readRegistry();
    const skills = sortSkills(filterSkills(registry.skills, options));
    if (skills.length === 0) {
      print.info("No skills registered.");
      return;
    }
    if (options.json) {
      console.log(JSON.stringify(skills, null, 2));
      return;
    }
    console.log("");
    printSection("GLOBAL", skills);
    console.log("");
    return;
  }

  // If scoped to project only
  if (options.project) {
    const projectPath = getProjectRegistryPath();
    if (!projectPath) {
      print.info("No project registry found in current directory tree.");
      return;
    }
    const registry = readRegistry(projectPath);
    const skills = sortSkills(filterSkills(registry.skills, options));
    if (skills.length === 0) {
      print.info("No skills in project registry.");
      return;
    }
    if (options.json) {
      console.log(JSON.stringify(skills, null, 2));
      return;
    }
    console.log("");
    printSection("PROJECT", skills);
    console.log("");
    return;
  }

  // Default: show both
  const { global, project } = resolveRegistries();

  if (options.json) {
    const result: { global: RegistryEntry[]; project?: RegistryEntry[] } = {
      global: filterSkills(global.skills, options),
    };
    if (project) {
      result.project = filterSkills(project.skills, options);
    }
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const globalSkills = sortSkills(filterSkills(global.skills, options));
  const projectSkills = project
    ? sortSkills(filterSkills(project.skills, options))
    : null;

  if (globalSkills.length === 0 && (!projectSkills || projectSkills.length === 0)) {
    print.info(
      "No skills registered. Run 'claude-skills add --all' to scan ~/.claude/skills/"
    );
    return;
  }

  console.log("");

  if (globalSkills.length > 0) {
    printSection("GLOBAL", globalSkills);
    console.log("");
  }

  if (projectSkills && projectSkills.length > 0) {
    printSection("PROJECT", projectSkills);
    console.log("");
  }

  // Show undiscovered plugin skills
  if (!options.active && !options.inactive) {
    showUndiscoveredPluginSkills(global);
  }
}

function showUndiscoveredPluginSkills(registry: Registry): void {
  let discovered: DiscoveredPluginSkill[];
  try {
    discovered = discoverAllPluginSkills();
  } catch {
    return;
  }

  if (discovered.length === 0) return;

  const registeredNames = new Set(registry.skills.map((s) => s.name));
  const undiscovered = discovered.filter((d) => !registeredNames.has(d.skillName));

  if (undiscovered.length === 0) return;

  // Dedup by skill name (first plugin wins)
  const seen = new Set<string>();
  const unique: DiscoveredPluginSkill[] = [];
  for (const d of undiscovered) {
    if (seen.has(d.skillName)) continue;
    seen.add(d.skillName);
    unique.push(d);
  }

  // Group by plugin name
  const byPlugin = new Map<string, DiscoveredPluginSkill[]>();
  for (const d of unique) {
    const key = d.plugin.name;
    if (!byPlugin.has(key)) byPlugin.set(key, []);
    byPlugin.get(key)!.push(d);
  }

  const count = unique.length;
  console.log(
    print.bold(
      `AVAILABLE FROM PLUGINS (${count} skill${count !== 1 ? "s" : ""} — not yet registered)`
    )
  );

  const rows: string[][] = [];
  for (const [pluginName, skills] of byPlugin) {
    for (const d of skills.sort((a, b) => a.skillName.localeCompare(b.skillName))) {
      const parsed = parseSkillFile(d.skillDir);
      const version = parsed?.meta.version || "—";
      const desc = parsed?.meta.description?.replace(/\n/g, " ").slice(0, 50) || "—";
      rows.push([`  •`, d.skillName, version, `[${pluginName}]`, desc]);
    }
  }

  print.table(rows);
  console.log("");
  print.info(`Run 'claude-skills discover' to register these plugin skills.`);
  console.log("");
}
