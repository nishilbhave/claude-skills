import fs from "node:fs";
import path from "node:path";
import {
  readRegistry,
  writeRegistry,
  addSkill,
  findSkill,
  type RegistryEntry,
} from "../core/registry.js";
import { parseSkillFile, validateSkill } from "../core/skill.js";
import { addSkillToGroup } from "../core/groups.js";
import { getSkillsDir } from "../utils/paths.js";
import { isRemoteSource, parseSource, fetchGitHubSkill } from "../core/remote.js";
import * as print from "../utils/print.js";

export async function addAction(
  pathArg: string | undefined,
  options: { all?: boolean; pin?: string }
): Promise<void> {
  const registry = readRegistry();

  if (options.all) {
    return addAllSkills(registry);
  }

  if (!pathArg) {
    print.error("Please specify a skill path or use --all to scan ~/.claude/skills/");
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

  addSingleSkill(registry, resolved, registrySource, pinnedVersion);
}

function addSingleSkill(
  registry: ReturnType<typeof readRegistry>,
  skillPath: string,
  registrySource: string,
  pinnedVersion: string | null
): void {
  if (!fs.existsSync(skillPath)) {
    print.error(`Path not found: ${skillPath}`);
    process.exit(1);
  }

  const parsed = parseSkillFile(skillPath);
  if (!parsed) {
    print.error(`No SKILL.md or skill.md found in ${skillPath}`);
    process.exit(1);
  }

  const warnings = validateSkill(parsed.meta, skillPath);
  for (const w of warnings) {
    print.warn(w);
  }

  const existing = findSkill(registry, parsed.meta.name);
  if (existing) {
    print.info(`Skill "${parsed.meta.name}" already registered — updating path.`);
  }

  const entry: RegistryEntry = {
    name: parsed.meta.name,
    path: skillPath,
    active: existing?.active ?? false,
    scope: parsed.meta.scope || "global",
    pinned_version: pinnedVersion,
    source: registrySource,
    added_at: existing?.added_at || new Date().toISOString(),
  };

  addSkill(registry, entry);
  writeRegistry(registry);

  // Auto-assign group from skill metadata
  if (parsed.meta.group) {
    addSkillToGroup(parsed.meta.group, parsed.meta.name);
  }

  if (existing) {
    print.success(`Updated "${parsed.meta.name}".`);
  } else {
    print.success(
      `Added "${parsed.meta.name}" (inactive). Run 'claude-skills enable ${parsed.meta.name}' to activate.`
    );
  }
}

function addAllSkills(
  registry: ReturnType<typeof readRegistry>
): void {
  const skillsDir = getSkillsDir();
  if (!fs.existsSync(skillsDir)) {
    print.error(`Skills directory not found: ${skillsDir}`);
    process.exit(1);
  }

  const dirs = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(skillsDir, d.name));

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const dir of dirs) {
    const parsed = parseSkillFile(dir);
    if (!parsed) {
      skipped++;
      continue;
    }

    const existing = findSkill(registry, parsed.meta.name);
    const entry: RegistryEntry = {
      name: parsed.meta.name,
      path: dir,
      active: existing?.active ?? false,
      scope: parsed.meta.scope || "global",
      pinned_version: existing?.pinned_version ?? null,
      source: existing?.source ?? "local",
      added_at: existing?.added_at || new Date().toISOString(),
    };

    addSkill(registry, entry);
    if (existing) {
      updated++;
    } else {
      added++;
    }
  }

  writeRegistry(registry);
  print.success(
    `Scanned ${dirs.length} directories: ${added} added, ${updated} updated, ${skipped} skipped.`
  );
}
