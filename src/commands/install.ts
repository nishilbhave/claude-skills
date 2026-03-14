import fs from "node:fs";
import path from "node:path";
import {
  readRegistry,
  writeRegistry,
  addSkill,
  findSkill,
  setActive,
  type RegistryEntry,
} from "../core/registry.js";
import { parseSkillFile } from "../core/skill.js";
import { getSkillsDir } from "../utils/paths.js";
import { isRemoteSource, parseSource, fetchGitHubSkill } from "../core/remote.js";
import { discoverAllPluginSkills, isPluginSource } from "../core/plugins.js";
import { syncAction } from "./sync.js";
import * as print from "../utils/print.js";

export async function installAction(
  pathArg: string | undefined,
  options: { all?: boolean; pin?: string; plugins?: boolean }
): Promise<void> {
  const registry = readRegistry();

  if (options.all) {
    return installAll(registry, options.plugins);
  }

  if (!pathArg) {
    print.error("Please specify a skill path or use --all.");
    process.exit(1);
  }

  let resolved: string;
  let registrySource = "local";
  let pinnedVersion: string | null = null;

  if (isRemoteSource(pathArg)) {
    const source = parseSource(pathArg);
    if (!source) {
      print.error(`Unsupported remote source: ${pathArg}`);
      process.exit(1);
    }

    try {
      const result = await fetchGitHubSkill(source, { pin: options.pin });
      resolved = result.skillDir;
      registrySource = source.raw;
      pinnedVersion = options.pin || null;
    } catch (err: unknown) {
      print.error((err as Error).message);
      process.exit(1);
    }
  } else {
    if (options.pin) {
      print.warn("--pin has no effect on local skills — ignoring.");
    }
    resolved = path.resolve(pathArg);
  }

  if (!fs.existsSync(resolved)) {
    print.error(`Path not found: ${resolved}`);
    process.exit(1);
  }

  const parsed = parseSkillFile(resolved);
  if (!parsed) {
    print.error(`No SKILL.md or skill.md found in ${resolved}`);
    process.exit(1);
  }

  const entry: RegistryEntry = {
    name: parsed.meta.name,
    path: resolved,
    active: true,
    scope: parsed.meta.scope || "global",
    pinned_version: pinnedVersion,
    source: registrySource,
    added_at: new Date().toISOString(),
  };

  addSkill(registry, entry);
  setActive(registry, parsed.meta.name, true);
  writeRegistry(registry);

  print.success(`Installed and activated "${parsed.meta.name}".`);
  await syncAction();
}

async function installAll(
  registry: ReturnType<typeof readRegistry>,
  includePlugins?: boolean
): Promise<void> {
  const skillsDir = getSkillsDir();
  if (!fs.existsSync(skillsDir)) {
    print.error(`Skills directory not found: ${skillsDir}`);
    process.exit(1);
  }

  const dirs = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(skillsDir, d.name));

  let count = 0;
  for (const dir of dirs) {
    const parsed = parseSkillFile(dir);
    if (!parsed) continue;

    const existing = findSkill(registry, parsed.meta.name);
    const entry: RegistryEntry = {
      name: parsed.meta.name,
      path: dir,
      active: true,
      scope: parsed.meta.scope || "global",
      pinned_version: existing?.pinned_version ?? null,
      source: existing?.source ?? "local",
      added_at: existing?.added_at || new Date().toISOString(),
    };

    addSkill(registry, entry);
    count++;
  }

  // Also scan installed plugins if --plugins flag is set
  let pluginCount = 0;
  if (includePlugins) {
    const discovered = discoverAllPluginSkills();
    const seenNames = new Set<string>();

    for (const d of discovered) {
      const parsed = parseSkillFile(d.skillDir);
      if (!parsed) continue;

      const skillName = parsed.meta.name;

      // Cross-plugin dedup
      if (seenNames.has(skillName)) continue;
      seenNames.add(skillName);

      // Local priority: skip if a local skill already exists with this name
      const existing = findSkill(registry, skillName);
      if (existing && !isPluginSource(existing.source)) continue;

      const source = `plugin:${d.plugin.name}@${d.plugin.marketplace}`;
      const entry: RegistryEntry = {
        name: skillName,
        path: d.skillDir,
        active: true,
        scope: parsed.meta.scope || "global",
        pinned_version: d.plugin.version,
        source,
        added_at: existing?.added_at || new Date().toISOString(),
      };

      addSkill(registry, entry);
      pluginCount++;
    }
  }

  writeRegistry(registry);
  const total = count + pluginCount;
  if (pluginCount > 0) {
    print.success(`Installed and activated ${total} skills (${pluginCount} from plugins).`);
  } else {
    print.success(`Installed and activated ${count} skills.`);
  }
  await syncAction();
}
