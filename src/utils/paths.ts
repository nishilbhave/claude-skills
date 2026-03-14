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

export function getSkillFilePath(dir: string): string | null {
  const upper = path.join(dir, "SKILL.md");
  if (fs.existsSync(upper)) return upper;
  const lower = path.join(dir, "skill.md");
  if (fs.existsSync(lower)) return lower;
  return null;
}
