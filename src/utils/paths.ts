import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const home = os.homedir();

// Allow overriding the base dir for testing
function getBaseDir(): string {
  return process.env.CLAUDE_SKILLS_BASE_DIR || path.join(home, ".claude");
}

export function getSkillsDir(): string {
  return path.join(getBaseDir(), "skills");
}

export function getRegistryPath(): string {
  return path.join(getBaseDir(), "skills.json");
}

export function getConfigPath(): string {
  return path.join(getBaseDir(), "skills-config.json");
}

export function getClaudeMdPath(): string {
  return path.join(getBaseDir(), "CLAUDE.md");
}

export function getCommandsDir(): string {
  return path.join(getBaseDir(), "commands");
}

export function getBackupDir(): string {
  return path.join(getBaseDir(), "skills-backup");
}

export function getCacheDir(): string {
  return path.join(getBaseDir(), "skills-cache");
}

export function getPluginsDir(): string {
  return path.join(getBaseDir(), "plugins");
}

export function getSkillFilePath(dir: string): string | null {
  const upper = path.join(dir, "SKILL.md");
  if (fs.existsSync(upper)) return upper;
  const lower = path.join(dir, "skill.md");
  if (fs.existsSync(lower)) return lower;
  return null;
}

export function getProjectRegistryPath(): string | null {
  const startDir = process.env.CLAUDE_SKILLS_PROJECT_DIR || process.cwd();
  let current = path.resolve(startDir);
  const homeDir = home;

  while (current !== homeDir && current !== path.dirname(current)) {
    // Stop at .git boundary
    const gitDir = path.join(current, ".git");
    const projectRegistry = path.join(current, ".claude", "skills.json");

    if (fs.existsSync(projectRegistry)) {
      return projectRegistry;
    }

    if (fs.existsSync(gitDir)) {
      // Found git root — check here but don't go further
      return null;
    }

    current = path.dirname(current);
  }

  return null;
}
