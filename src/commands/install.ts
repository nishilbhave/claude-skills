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
import { syncAction } from "./sync.js";
import * as print from "../utils/print.js";

export async function installAction(
  pathArg: string | undefined,
  options: { all?: boolean }
): Promise<void> {
  const registry = readRegistry();

  if (options.all) {
    return installAll(registry);
  }

  if (!pathArg) {
    print.error("Please specify a skill path or use --all.");
    process.exit(1);
  }

  const resolved = path.resolve(pathArg);
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
    pinned_version: null,
    source: "local",
    added_at: new Date().toISOString(),
  };

  addSkill(registry, entry);
  setActive(registry, parsed.meta.name, true);
  writeRegistry(registry);

  print.success(`Installed and activated "${parsed.meta.name}".`);
  await syncAction();
}

async function installAll(
  registry: ReturnType<typeof readRegistry>
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

    const entry: RegistryEntry = {
      name: parsed.meta.name,
      path: dir,
      active: true,
      scope: parsed.meta.scope || "global",
      pinned_version: null,
      source: "local",
      added_at: findSkill(registry, parsed.meta.name)?.added_at || new Date().toISOString(),
    };

    addSkill(registry, entry);
    count++;
  }

  writeRegistry(registry);
  print.success(`Installed and activated ${count} skills.`);
  await syncAction();
}
