import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import fse from "fs-extra";
import { getCacheDir, getSkillsDir, getSkillFilePath } from "../utils/paths.js";

export interface GitHubSource {
  type: "github";
  user: string;
  repo: string;
  skillDir: string;
  raw: string;
}

export interface FetchResult {
  skillDir: string;
  version: string | null;
}

/**
 * Parse a `github:user/repo/skill-dir` string.
 * Returns null for local paths. Throws if `github:` prefix present but malformed.
 */
export function parseSource(input: string): GitHubSource | null {
  if (!input.startsWith("github:")) return null;

  const rest = input.slice("github:".length);
  const segments = rest.split("/").filter(Boolean);

  if (segments.length < 3) {
    throw new Error(
      `Invalid GitHub source "${input}" — expected github:user/repo/skill-dir`
    );
  }

  const [user, repo, ...dirParts] = segments;
  return {
    type: "github",
    user,
    repo,
    skillDir: dirParts.join("/"),
    raw: input,
  };
}

/**
 * Quick prefix check for remote sources.
 */
export function isRemoteSource(input: string): boolean {
  return input.startsWith("github:") || input.startsWith("registry:");
}

/**
 * Throws if git is not installed.
 */
export function ensureGitAvailable(): void {
  try {
    execFileSync("git", ["--version"], { stdio: "pipe" });
  } catch {
    throw new Error(
      "Git is required for remote skills but was not found."
    );
  }
}

/**
 * Clone or fetch a GitHub repo into the cache directory.
 * Returns the absolute path to the cached repo.
 */
export function cloneOrUpdateCache(
  source: GitHubSource,
  cacheDir?: string
): string {
  const cache = cacheDir || getCacheDir();
  fse.ensureDirSync(cache);

  const repoDir = path.join(cache, `${source.user}-${source.repo}`);
  const repoUrl = `https://github.com/${source.user}/${source.repo}.git`;

  if (fs.existsSync(path.join(repoDir, ".git"))) {
    // Already cached — fetch updates
    try {
      execFileSync("git", ["fetch", "--tags", "origin"], {
        cwd: repoDir,
        stdio: "pipe",
      });
    } catch {
      throw new Error(
        `Could not fetch updates for ${source.user}/${source.repo} — check your network connection.`
      );
    }
  } else {
    // Fresh clone
    try {
      execFileSync("git", ["clone", repoUrl, repoDir], {
        stdio: "pipe",
      });
    } catch {
      throw new Error(
        `Could not clone ${repoUrl} — check that the repository exists and is accessible.`
      );
    }
  }

  return repoDir;
}

/**
 * Checkout a specific version (tag) or latest from origin.
 */
export function checkoutVersion(
  repoDir: string,
  version: string | null
): void {
  if (version) {
    const tags = listTags(repoDir);
    if (!tags.includes(version)) {
      throw new Error(
        `Tag "${version}" not found. Available tags: ${tags.length > 0 ? tags.join(", ") : "(none)"}`
      );
    }
    execFileSync("git", ["checkout", `tags/${version}`], {
      cwd: repoDir,
      stdio: "pipe",
    });
  } else {
    // Try origin/main, fallback to origin/master
    try {
      execFileSync("git", ["checkout", "origin/main"], {
        cwd: repoDir,
        stdio: "pipe",
      });
    } catch {
      try {
        execFileSync("git", ["checkout", "origin/master"], {
          cwd: repoDir,
          stdio: "pipe",
        });
      } catch {
        throw new Error(
          `Could not checkout origin/main or origin/master in ${repoDir}.`
        );
      }
    }
  }
}

/**
 * List all tags in a repo.
 */
export function listTags(repoDir: string): string[] {
  const out = execFileSync("git", ["tag", "--list"], {
    cwd: repoDir,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return out
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Get the short hash of HEAD.
 */
export function getHeadShortHash(repoDir: string): string {
  return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: repoDir,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

/**
 * Copy a skill directory from the cached repo into ~/.claude/skills/<name>/.
 * Validates that SKILL.md exists in the source.
 */
export function copySkillFromCache(
  repoDir: string,
  skillDirInRepo: string,
  destDir: string
): void {
  const srcDir = path.join(repoDir, skillDirInRepo);

  if (!fs.existsSync(srcDir)) {
    throw new Error(
      `Directory "${skillDirInRepo}" not found in repository.`
    );
  }

  const skillFile = getSkillFilePath(srcDir);
  if (!skillFile) {
    throw new Error(
      `No SKILL.md or skill.md found in ${skillDirInRepo}.`
    );
  }

  fse.ensureDirSync(destDir);
  fse.copySync(srcDir, destDir, { overwrite: true });
}

/**
 * Orchestrate: ensureGit -> clone/update -> checkout -> copy -> return result.
 */
export async function fetchGitHubSkill(
  source: GitHubSource,
  opts?: { pin?: string; cacheDir?: string }
): Promise<FetchResult> {
  ensureGitAvailable();

  const repoDir = cloneOrUpdateCache(source, opts?.cacheDir);
  const version = opts?.pin || null;

  checkoutVersion(repoDir, version);

  const skillName = path.basename(source.skillDir);
  const destDir = path.join(getSkillsDir(), skillName);

  copySkillFromCache(repoDir, source.skillDir, destDir);

  const resolvedVersion = version || getHeadShortHash(repoDir);

  return {
    skillDir: destDir,
    version: resolvedVersion,
  };
}
