import fs from "node:fs";
import path from "node:path";
import { getPluginsDir, getSkillFilePath } from "../utils/paths.js";

export interface InstalledPlugin {
  key: string;
  name: string;
  marketplace: string;
  scope: string;
  installPath: string;
  version: string;
}

export interface DiscoveredPluginSkill {
  skillDir: string;
  skillName: string;
  plugin: InstalledPlugin;
}

export function readInstalledPlugins(): InstalledPlugin[] {
  const manifestPath = path.join(getPluginsDir(), "installed_plugins.json");
  if (!fs.existsSync(manifestPath)) {
    return [];
  }

  let raw: string;
  try {
    raw = fs.readFileSync(manifestPath, "utf-8");
  } catch {
    return [];
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return [];
  }

  const seen = new Set<string>();
  const plugins: InstalledPlugin[] = [];

  for (const [key, entries] of Object.entries(data)) {
    if (seen.has(key)) continue;
    seen.add(key);

    // entries can be an array (take first) or a single object
    const entry = Array.isArray(entries) ? entries[0] : entries;
    if (!entry || typeof entry !== "object") continue;

    const record = entry as Record<string, unknown>;
    const installPath = record.installPath as string | undefined;
    if (!installPath || typeof installPath !== "string") continue;

    // Split key on @ for name/marketplace: "pluginName@marketplace"
    const atIndex = key.indexOf("@");
    const name = atIndex > 0 ? key.slice(0, atIndex) : key;
    const marketplace = atIndex > 0 ? key.slice(atIndex + 1) : "";

    plugins.push({
      key,
      name,
      marketplace,
      scope: (record.scope as string) || "global",
      installPath,
      version: (record.version as string) || "unknown",
    });
  }

  return plugins;
}

export function resolveSkillsRoot(installPath: string): string | null {
  // 1. Check .claude-plugin/plugin.json for skills field
  const pluginJsonPath = path.join(installPath, ".claude-plugin", "plugin.json");
  if (fs.existsSync(pluginJsonPath)) {
    try {
      const raw = fs.readFileSync(pluginJsonPath, "utf-8");
      const pluginJson = JSON.parse(raw) as Record<string, unknown>;
      if (typeof pluginJson.skills === "string") {
        const resolved = path.resolve(installPath, pluginJson.skills);
        if (fs.existsSync(resolved)) {
          return resolved;
        }
      }
    } catch {
      // Fall through to next check
    }
  }

  // 2. Check .claude/skills/
  const claudeSkills = path.join(installPath, ".claude", "skills");
  if (fs.existsSync(claudeSkills) && fs.statSync(claudeSkills).isDirectory()) {
    return claudeSkills;
  }

  // 3. Check skills/
  const skillsDir = path.join(installPath, "skills");
  if (fs.existsSync(skillsDir) && fs.statSync(skillsDir).isDirectory()) {
    return skillsDir;
  }

  return null;
}

export function discoverSkillsInRoot(skillsRoot: string): string[] {
  if (!fs.existsSync(skillsRoot)) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(skillsRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const skillDirs: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(skillsRoot, entry.name);
    const skillFile = getSkillFilePath(dir);
    if (skillFile) {
      skillDirs.push(dir);
    }
  }

  return skillDirs;
}

export function discoverAllPluginSkills(): DiscoveredPluginSkill[] {
  const plugins = readInstalledPlugins();
  const results: DiscoveredPluginSkill[] = [];

  for (const plugin of plugins) {
    if (!fs.existsSync(plugin.installPath)) continue;

    const skillsRoot = resolveSkillsRoot(plugin.installPath);
    if (!skillsRoot) continue;

    const skillDirs = discoverSkillsInRoot(skillsRoot);
    for (const skillDir of skillDirs) {
      results.push({
        skillDir,
        skillName: path.basename(skillDir),
        plugin,
      });
    }
  }

  return results;
}

export function isPluginSource(source: string): boolean {
  return source.startsWith("plugin:");
}
