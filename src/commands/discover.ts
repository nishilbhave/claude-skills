import {
  readRegistry,
  writeRegistry,
  addSkill,
  findSkill,
  type RegistryEntry,
} from "../core/registry.js";
import { parseSkillFile } from "../core/skill.js";
import {
  discoverAllPluginSkills,
  isPluginSource,
  type DiscoveredPluginSkill,
} from "../core/plugins.js";
import * as print from "../utils/print.js";

export async function discoverAction(options: {
  json?: boolean;
  dryRun?: boolean;
}): Promise<void> {
  const discovered = discoverAllPluginSkills();

  if (options.json) {
    const output = discovered.map((d) => ({
      name: d.skillName,
      path: d.skillDir,
      plugin: d.plugin.name,
      marketplace: d.plugin.marketplace,
      version: d.plugin.version,
    }));
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  if (discovered.length === 0) {
    print.info("No plugin skills found. Install plugins via Claude Code marketplace first.");
    return;
  }

  const registry = readRegistry();
  let added = 0;
  let updated = 0;
  let skipped = 0;
  const warnings: string[] = [];
  const seenNames = new Set<string>();

  for (const d of discovered) {
    const parsed = parseSkillFile(d.skillDir);
    if (!parsed) {
      skipped++;
      continue;
    }

    const skillName = parsed.meta.name;

    // Cross-plugin dedup: first plugin to claim a name wins
    if (seenNames.has(skillName)) {
      warnings.push(
        `Duplicate skill "${skillName}" in plugin ${d.plugin.name} — skipped (already claimed by another plugin)`
      );
      skipped++;
      continue;
    }
    seenNames.add(skillName);

    const existing = findSkill(registry, skillName);

    // Local priority: local skills always win over plugin skills
    if (existing && !isPluginSource(existing.source)) {
      skipped++;
      continue;
    }

    const source = `plugin:${d.plugin.name}@${d.plugin.marketplace}`;

    const entry: RegistryEntry = {
      name: skillName,
      path: d.skillDir,
      active: existing?.active ?? false,
      scope: parsed.meta.scope || "global",
      pinned_version: d.plugin.version,
      source,
      added_at: existing?.added_at || new Date().toISOString(),
    };

    if (options.dryRun) {
      if (existing && isPluginSource(existing.source)) {
        updated++;
      } else {
        added++;
      }
      continue;
    }

    addSkill(registry, entry);

    if (existing && isPluginSource(existing.source)) {
      updated++;
    } else {
      added++;
    }
  }

  if (!options.dryRun) {
    writeRegistry(registry);
  }

  for (const w of warnings) {
    print.warn(w);
  }

  const prefix = options.dryRun ? "[dry-run] " : "";
  print.success(
    `${prefix}Discovered ${discovered.length} plugin skills: ${added} added, ${updated} updated, ${skipped} skipped.`
  );
}
