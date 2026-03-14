import readline from "node:readline";
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

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

interface ResolvedSkill {
  skillName: string;
  chosen: DiscoveredPluginSkill;
  source: string;
}

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

  // First pass: group discovered skills by name to find conflicts
  const byName = new Map<string, DiscoveredPluginSkill[]>();
  for (const d of discovered) {
    const parsed = parseSkillFile(d.skillDir);
    if (!parsed) continue;
    const name = parsed.meta.name;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name)!.push(d);
  }

  // Resolve conflicts
  const registry = readRegistry();
  const resolved: ResolvedSkill[] = [];
  let skipped = 0;
  const isTTY = process.stdin.isTTY && process.stdout.isTTY && !options.dryRun;

  let rl: readline.Interface | null = null;
  if (isTTY) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  try {
    for (const [skillName, candidates] of byName) {
      // Local priority: local skills always win
      const existingEntry = findSkill(registry, skillName);
      if (existingEntry && !isPluginSource(existingEntry.source)) {
        skipped += candidates.length;
        continue;
      }

      let chosen: DiscoveredPluginSkill;

      if (candidates.length === 1) {
        chosen = candidates[0];
      } else if (rl) {
        // Interactive: ask user to pick
        console.log("");
        print.warn(
          `Conflict: skill "${print.boldText(skillName)}" found in ${candidates.length} plugins:`
        );
        for (let i = 0; i < candidates.length; i++) {
          const c = candidates[i];
          const marker =
            existingEntry && existingEntry.source === `plugin:${c.plugin.name}@${c.plugin.marketplace}`
              ? print.dimText(" (current)")
              : "";
          console.log(`    ${print.boldText(String(i + 1))}. ${c.plugin.name}${marker}`);
        }

        let picked: number | null = null;
        while (picked === null) {
          const answer = await ask(rl, `  Pick a plugin [1-${candidates.length}]: `);
          const num = parseInt(answer, 10);
          if (num >= 1 && num <= candidates.length) {
            picked = num - 1;
          }
        }

        chosen = candidates[picked];
        skipped += candidates.length - 1;
      } else {
        // Non-interactive: prefer the plugin that currently owns it in registry, else first wins
        const currentSource = existingEntry?.source;
        const match = currentSource
          ? candidates.find(
              (c) => `plugin:${c.plugin.name}@${c.plugin.marketplace}` === currentSource
            )
          : null;
        chosen = match || candidates[0];
        skipped += candidates.length - 1;

        if (candidates.length > 1) {
          const otherNames = candidates
            .filter((c) => c !== chosen)
            .map((c) => c.plugin.name)
            .join(", ");
          print.warn(
            `Duplicate skill "${skillName}" — using ${chosen.plugin.name} (also in ${otherNames})`
          );
        }
      }

      const source = `plugin:${chosen.plugin.name}@${chosen.plugin.marketplace}`;
      resolved.push({ skillName, chosen, source });
    }
  } finally {
    rl?.close();
  }

  // Second pass: register resolved skills
  let added = 0;
  let updated = 0;

  for (const { skillName, chosen, source } of resolved) {
    const parsed = parseSkillFile(chosen.skillDir);
    if (!parsed) {
      skipped++;
      continue;
    }

    const existingEntry = findSkill(registry, skillName);

    const entry: RegistryEntry = {
      name: skillName,
      path: chosen.skillDir,
      active: existingEntry?.active ?? false,
      scope: parsed.meta.scope || "global",
      pinned_version: chosen.plugin.version,
      source,
      added_at: existingEntry?.added_at || new Date().toISOString(),
    };

    if (options.dryRun) {
      if (existingEntry && isPluginSource(existingEntry.source)) {
        updated++;
      } else {
        added++;
      }
      continue;
    }

    addSkill(registry, entry);

    if (existingEntry && isPluginSource(existingEntry.source)) {
      updated++;
    } else {
      added++;
    }
  }

  if (!options.dryRun) {
    writeRegistry(registry);
  }

  const prefix = options.dryRun ? "[dry-run] " : "";
  print.success(
    `${prefix}Discovered ${discovered.length} plugin skills: ${added} added, ${updated} updated, ${skipped} skipped.`
  );
}
