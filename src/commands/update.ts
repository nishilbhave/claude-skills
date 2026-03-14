import {
  readRegistry,
  writeRegistry,
  findSkill,
  getActiveSkills,
} from "../core/registry.js";
import { parseSkillFile } from "../core/skill.js";
import { parseSource, fetchGitHubSkill } from "../core/remote.js";
import { syncAction } from "./sync.js";
import * as print from "../utils/print.js";

export async function updateAction(
  name: string | undefined,
  options: { all?: boolean; pin?: string }
): Promise<void> {
  const registry = readRegistry();

  if (options.all) {
    const remoteSkills = registry.skills.filter((s) => s.source !== "local");
    if (remoteSkills.length === 0) {
      print.info("No remote skills to update.");
      return;
    }

    let updated = 0;
    let skipped = 0;

    for (const entry of remoteSkills) {
      const result = await updateSingle(entry.name, options, false);
      if (result) {
        updated++;
      } else {
        skipped++;
      }
    }

    print.success(`Updated ${updated} skill(s), skipped ${skipped}.`);
    return;
  }

  if (!name) {
    print.error("Please specify a skill name or use --all.");
    process.exit(1);
  }

  await updateSingle(name, options, true);
}

async function updateSingle(
  name: string,
  options: { pin?: string },
  verbose: boolean
): Promise<boolean> {
  const registry = readRegistry();
  const entry = findSkill(registry, name);

  if (!entry) {
    if (verbose) {
      print.error(`Skill "${name}" not found in registry.`);
      process.exit(1);
    }
    return false;
  }

  // Local skill — just re-read and display
  if (entry.source === "local") {
    if (options.pin) {
      print.warn("--pin has no effect on local skills — ignoring.");
    }
    const parsed = parseSkillFile(entry.path);
    if (parsed) {
      print.info(
        `"${name}" is a local skill at ${entry.path} — no remote update needed.`
      );
    } else {
      print.warn(`"${name}" — skill file not found at ${entry.path}.`);
    }
    return false;
  }

  // GitHub source
  const source = parseSource(entry.source);
  if (!source) {
    print.warn(`"${name}" has unrecognized source "${entry.source}" — skipping.`);
    return false;
  }

  // Pinned skill with no --pin flag: skip
  if (entry.pinned_version && !options.pin) {
    if (verbose) {
      print.info(
        `"${name}" is pinned to ${entry.pinned_version}. Use --pin <version> to change.`
      );
    }
    return false;
  }

  // Determine new pin
  let newPin: string | undefined;
  if (options.pin === "latest") {
    newPin = undefined; // unpin, fetch HEAD
  } else if (options.pin) {
    newPin = options.pin;
  } else {
    newPin = undefined; // unpinned, fetch HEAD
  }

  try {
    const result = await fetchGitHubSkill(source, { pin: newPin });
    entry.path = result.skillDir;
    entry.pinned_version = newPin || null;
    writeRegistry(registry);

    if (verbose) {
      const versionLabel = newPin || result.version || "latest";
      print.success(`Updated "${name}" to ${versionLabel}.`);
    }

    // If skill was active, re-sync
    if (entry.active) {
      await syncAction();
    }

    return true;
  } catch (err: unknown) {
    if (verbose) {
      print.error((err as Error).message);
      process.exit(1);
    } else {
      print.warn(`Failed to update "${name}": ${(err as Error).message}`);
    }
    return false;
  }
}
