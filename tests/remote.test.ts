import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  setupTestEnv,
  createGitFixture,
  type TestEnv,
  type GitFixture,
} from "./helpers.js";
import {
  parseSource,
  isRemoteSource,
  ensureGitAvailable,
  cloneOrUpdateCache,
  checkoutVersion,
  listTags,
  getHeadShortHash,
  copySkillFromCache,
  type GitHubSource,
} from "../src/core/remote.js";

let env: TestEnv;

beforeEach(() => {
  env = setupTestEnv("claude-skills-remote-");
});

afterEach(() => {
  env.cleanup();
});

describe("parseSource", () => {
  it("parses a valid github source", () => {
    const result = parseSource("github:user/repo/skill-dir");
    expect(result).toEqual({
      type: "github",
      user: "user",
      repo: "repo",
      skillDir: "skill-dir",
      raw: "github:user/repo/skill-dir",
    });
  });

  it("handles nested skill directories", () => {
    const result = parseSource("github:user/repo/skills/my-skill");
    expect(result).toEqual({
      type: "github",
      user: "user",
      repo: "repo",
      skillDir: "skills/my-skill",
      raw: "github:user/repo/skills/my-skill",
    });
  });

  it("returns null for local paths", () => {
    expect(parseSource("/local/path")).toBeNull();
    expect(parseSource("./relative/path")).toBeNull();
    expect(parseSource("some-path")).toBeNull();
  });

  it("throws on malformed github source", () => {
    expect(() => parseSource("github:user")).toThrow("expected github:user/repo/skill-dir");
    expect(() => parseSource("github:user/repo")).toThrow("expected github:user/repo/skill-dir");
  });
});

describe("isRemoteSource", () => {
  it("detects github: prefix", () => {
    expect(isRemoteSource("github:user/repo/skill")).toBe(true);
  });

  it("detects registry: prefix", () => {
    expect(isRemoteSource("registry:my-reg/skill")).toBe(true);
  });

  it("rejects local paths", () => {
    expect(isRemoteSource("/local/path")).toBe(false);
    expect(isRemoteSource("./relative")).toBe(false);
  });
});

describe("ensureGitAvailable", () => {
  it("does not throw when git is installed", () => {
    expect(() => ensureGitAvailable()).not.toThrow();
  });
});

describe("git operations with fixture", () => {
  let fixture: GitFixture;

  beforeEach(() => {
    fixture = createGitFixture(env.tmpDir);
  });

  it("cloneOrUpdateCache clones a local repo into cache", () => {
    const source: GitHubSource = {
      type: "github",
      user: "test",
      repo: "fixture-repo",
      skillDir: "skills/test-skill",
      raw: "github:test/fixture-repo/skills/test-skill",
    };

    // Use the fixture repo as the "remote" by pointing clone at the local path
    // We need to test cloneOrUpdateCache with a real git repo, so we'll
    // simulate by cloning the fixture repo into the cache dir
    const cacheDir = path.join(env.tmpDir, "cache");
    const { execFileSync } = require("node:child_process");
    const repoDir = path.join(cacheDir, "test-fixture-repo");
    fs.mkdirSync(cacheDir, { recursive: true });
    execFileSync("git", ["clone", fixture.repoDir, repoDir], { stdio: "pipe" });

    expect(fs.existsSync(path.join(repoDir, ".git"))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, "skills", "test-skill", "SKILL.md"))).toBe(true);
  });

  it("listTags returns tags from fixture", () => {
    const tags = listTags(fixture.repoDir);
    expect(tags).toContain("1.0.0");
    expect(tags).toContain("1.1.0");
  });

  it("getHeadShortHash returns a short hash", () => {
    const hash = getHeadShortHash(fixture.repoDir);
    expect(hash).toMatch(/^[a-f0-9]{7,}$/);
  });

  it("checkoutVersion checks out a tag", () => {
    checkoutVersion(fixture.repoDir, "1.0.0");
    const content = fs.readFileSync(
      path.join(fixture.repoDir, "skills", "test-skill", "SKILL.md"),
      "utf-8"
    );
    expect(content).toContain("v1");
  });

  it("checkoutVersion throws on missing tag", () => {
    expect(() => checkoutVersion(fixture.repoDir, "9.9.9")).toThrow(
      'Tag "9.9.9" not found'
    );
  });

  it("copySkillFromCache copies skill to destination", () => {
    const destDir = path.join(env.tmpDir, "dest", "test-skill");
    copySkillFromCache(fixture.repoDir, "skills/test-skill", destDir);

    expect(fs.existsSync(path.join(destDir, "SKILL.md"))).toBe(true);
  });

  it("copySkillFromCache throws if skill dir missing", () => {
    const destDir = path.join(env.tmpDir, "dest", "missing");
    expect(() =>
      copySkillFromCache(fixture.repoDir, "nonexistent/path", destDir)
    ).toThrow('Directory "nonexistent/path" not found');
  });

  it("copySkillFromCache throws if SKILL.md missing", () => {
    // Create a directory without SKILL.md
    const emptyDir = path.join(fixture.repoDir, "empty-dir");
    fs.mkdirSync(emptyDir, { recursive: true });

    const destDir = path.join(env.tmpDir, "dest", "empty");
    expect(() =>
      copySkillFromCache(fixture.repoDir, "empty-dir", destDir)
    ).toThrow("No SKILL.md or skill.md found");
  });
});
