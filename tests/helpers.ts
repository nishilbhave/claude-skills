import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
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

export function makeEntry(
  name: string,
  skillPath: string,
  active = false,
  opts?: { source?: string; pinned_version?: string | null }
): RegistryEntry {
  return {
    name,
    path: skillPath,
    active,
    scope: "global",
    pinned_version: opts?.pinned_version ?? null,
    source: opts?.source ?? "local",
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
    registry_sources: [],
    ...overrides,
  };
}

export interface TestPluginOpts {
  skills?: string[];
  version?: string;
  skillsLocation?: "plugin-json" | "claude-skills" | "skills-dir";
}

export function createTestPlugin(
  baseDir: string,
  pluginName: string,
  marketplace: string,
  opts?: TestPluginOpts
): string {
  const version = opts?.version || "1.0.0";
  const installPath = path.join(baseDir, "plugins", "cache", `${pluginName}@${version}`);
  fse.ensureDirSync(installPath);

  const skills = opts?.skills || ["sample-skill"];
  const location = opts?.skillsLocation || "plugin-json";

  let skillsRoot: string;

  if (location === "plugin-json") {
    // Create .claude-plugin/plugin.json with skills field
    const pluginDir = path.join(installPath, ".claude-plugin");
    fse.ensureDirSync(pluginDir);
    fs.writeFileSync(
      path.join(pluginDir, "plugin.json"),
      JSON.stringify({ name: pluginName, skills: "./.claude/skills" }, null, 2),
      "utf-8"
    );
    skillsRoot = path.join(installPath, ".claude", "skills");
  } else if (location === "claude-skills") {
    skillsRoot = path.join(installPath, ".claude", "skills");
  } else {
    skillsRoot = path.join(installPath, "skills");
  }

  fse.ensureDirSync(skillsRoot);

  for (const skillName of skills) {
    const skillDir = path.join(skillsRoot, skillName);
    fse.ensureDirSync(skillDir);
    const content = [
      "---",
      `name: ${skillName}`,
      `description: ${skillName} from ${pluginName}`,
      `version: ${version}`,
      "---",
      "",
      `# ${skillName}`,
      "",
      `${skillName} content from plugin ${pluginName}.`,
    ].join("\n");
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), content, "utf-8");
  }

  return installPath;
}

export function createInstalledPluginsJson(
  baseDir: string,
  plugins: Array<{
    name: string;
    marketplace: string;
    installPath: string;
    version?: string;
    scope?: string;
  }>
): void {
  const pluginsDir = path.join(baseDir, "plugins");
  fse.ensureDirSync(pluginsDir);

  const pluginsMap: Record<string, unknown[]> = {};
  for (const p of plugins) {
    const key = `${p.name}@${p.marketplace}`;
    pluginsMap[key] = [
      {
        installPath: p.installPath,
        version: p.version || "1.0.0",
        scope: p.scope || "global",
      },
    ];
  }

  const manifest = { version: 2, plugins: pluginsMap };

  fs.writeFileSync(
    path.join(pluginsDir, "installed_plugins.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8"
  );
}

export interface GitFixture {
  repoDir: string;
  skillPath: string;
}

/**
 * Create a real git repo with a skill directory, two commits, and two tags.
 * Used by remote.test.ts and update.test.ts.
 */
export function createGitFixture(baseDir: string): GitFixture {
  const repoDir = path.join(baseDir, "fixture-repo");
  fse.ensureDirSync(repoDir);

  // Init repo
  execFileSync("git", ["init"], { cwd: repoDir, stdio: "pipe" });
  execFileSync("git", ["config", "user.email", "test@test.com"], {
    cwd: repoDir,
    stdio: "pipe",
  });
  execFileSync("git", ["config", "user.name", "Test"], {
    cwd: repoDir,
    stdio: "pipe",
  });

  // Create skill directory
  const skillPath = path.join(repoDir, "skills", "test-skill");
  fse.ensureDirSync(skillPath);

  const skillContent = [
    "---",
    "name: test-skill",
    "description: A test skill from git",
    "version: 1.0.0",
    "---",
    "",
    "# test-skill",
    "",
    "Test skill content v1.",
  ].join("\n");

  fs.writeFileSync(path.join(skillPath, "SKILL.md"), skillContent, "utf-8");

  // First commit + tag
  execFileSync("git", ["add", "."], { cwd: repoDir, stdio: "pipe" });
  execFileSync("git", ["commit", "-m", "Initial commit"], {
    cwd: repoDir,
    stdio: "pipe",
  });
  execFileSync("git", ["tag", "1.0.0"], { cwd: repoDir, stdio: "pipe" });

  // Update skill + second commit + tag
  const skillContentV2 = skillContent.replace("v1", "v2").replace("1.0.0", "1.1.0");
  fs.writeFileSync(path.join(skillPath, "SKILL.md"), skillContentV2, "utf-8");

  execFileSync("git", ["add", "."], { cwd: repoDir, stdio: "pipe" });
  execFileSync("git", ["commit", "-m", "Bump to 1.1.0"], {
    cwd: repoDir,
    stdio: "pipe",
  });
  execFileSync("git", ["tag", "1.1.0"], { cwd: repoDir, stdio: "pipe" });

  return { repoDir, skillPath };
}
