import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import fse from "fs-extra";
import { writeRegistry, type RegistryEntry, type Registry } from "../src/core/registry.js";
import { writeConfig, type SkillsConfig } from "../src/core/config.js";

export interface TestEnv {
  tmpDir: string;
  cleanup: () => void;
}

export function setupTestEnv(prefix = "claude-skills-test-"): TestEnv {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  process.env.CLAUDE_SKILLS_BASE_DIR = tmpDir;

  return {
    tmpDir,
    cleanup: () => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      delete process.env.CLAUDE_SKILLS_BASE_DIR;
      delete process.env.CLAUDE_SKILLS_PROJECT_DIR;
    },
  };
}

export function createTestSkill(
  baseDir: string,
  name: string,
  opts?: {
    version?: string;
    description?: string;
    command?: string;
    group?: string;
    conflicts?: string[];
    requires?: string[];
  }
): string {
  const skillDir = path.join(baseDir, "skills", name);
  fse.ensureDirSync(skillDir);

  const fm: string[] = ["---", `name: ${name}`];
  if (opts?.description) fm.push(`description: ${opts.description}`);
  else fm.push(`description: ${name} skill`);
  if (opts?.version) fm.push(`version: ${opts.version}`);
  else fm.push("version: 1.0.0");
  if (opts?.command) fm.push(`command: ${opts.command}`);
  if (opts?.group) fm.push(`group: ${opts.group}`);
  if (opts?.conflicts?.length) fm.push(`conflicts: [${opts.conflicts.join(", ")}]`);
  if (opts?.requires?.length) fm.push(`requires: [${opts.requires.join(", ")}]`);
  fm.push("---");
  fm.push("");
  fm.push(`# ${name}`);
  fm.push("");
  fm.push(`${name} content here.`);

  fs.writeFileSync(path.join(skillDir, "SKILL.md"), fm.join("\n"), "utf-8");
  return skillDir;
}

export function createTestRegistry(
  entries: RegistryEntry[],
  registryPath?: string
): void {
  const registry: Registry = { version: "1", skills: entries };
  writeRegistry(registry, registryPath);
}

export function makeEntry(name: string, skillPath: string, active = false): RegistryEntry {
  return {
    name,
    path: skillPath,
    active,
    scope: "global",
    pinned_version: null,
    source: "local",
    added_at: new Date().toISOString(),
  };
}

export function defaultConfig(overrides?: Partial<SkillsConfig>): SkillsConfig {
  return {
    inject_mode: "full",
    context_budget_kb: 100,
    auto_sync: false,
    backup_count: 5,
    groups: {},
    ...overrides,
  };
}
