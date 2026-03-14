import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import fse from "fs-extra";
import { writeRegistry, type RegistryEntry } from "../src/core/registry.js";
import { writeConfig, type SkillsConfig } from "../src/core/config.js";
import { syncAction } from "../src/commands/sync.js";

let tmpDir: string;
let skillDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-skills-sync-"));
  process.env.CLAUDE_SKILLS_BASE_DIR = tmpDir;

  // Create a test skill
  skillDir = path.join(tmpDir, "skills", "test-skill");
  fse.ensureDirSync(skillDir);
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    `---
name: test-skill
description: A test skill
version: 1.0.0
---

# Test Skill

Test content here.
`,
    "utf-8"
  );
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.CLAUDE_SKILLS_BASE_DIR;
});

describe("sync", () => {
  it("creates CLAUDE.md with active skill content", async () => {
    const entry: RegistryEntry = {
      name: "test-skill",
      path: skillDir,
      active: true,
      scope: "global",
      pinned_version: null,
      source: "local",
      added_at: new Date().toISOString(),
    };
    writeRegistry({ version: "1", skills: [entry] });
    writeConfig({
      inject_mode: "full",
      context_budget_kb: 100,
      auto_sync: true,
      backup_count: 5,
      groups: {},
    } as SkillsConfig);

    await syncAction();

    const claudeMd = fs.readFileSync(path.join(tmpDir, "CLAUDE.md"), "utf-8");
    expect(claudeMd).toContain("### test-skill (v1.0.0)");
    expect(claudeMd).toContain("Test content here.");
  });

  it("creates command file for active skill", async () => {
    const entry: RegistryEntry = {
      name: "test-skill",
      path: skillDir,
      active: true,
      scope: "global",
      pinned_version: null,
      source: "local",
      added_at: new Date().toISOString(),
    };
    writeRegistry({ version: "1", skills: [entry] });
    writeConfig({
      inject_mode: "full",
      context_budget_kb: 100,
      auto_sync: true,
      backup_count: 5,
      groups: {},
    } as SkillsConfig);

    await syncAction();

    const cmdPath = path.join(tmpDir, "commands", "test-skill.md");
    expect(fs.existsSync(cmdPath)).toBe(true);
    const cmdContent = fs.readFileSync(cmdPath, "utf-8");
    expect(cmdContent).toContain("# test-skill");
    expect(cmdContent).toContain("Test content here.");
  });

  it("handles no active skills gracefully", async () => {
    writeRegistry({ version: "1", skills: [] });
    writeConfig({
      inject_mode: "full",
      context_budget_kb: 100,
      auto_sync: true,
      backup_count: 5,
      groups: {},
    } as SkillsConfig);

    await syncAction();

    // Should not create CLAUDE.md if there's nothing to write
    const claudeMdPath = path.join(tmpDir, "CLAUDE.md");
    expect(fs.existsSync(claudeMdPath)).toBe(false);
  });

  it("uses catalog mode when configured", async () => {
    const entry: RegistryEntry = {
      name: "test-skill",
      path: skillDir,
      active: true,
      scope: "global",
      pinned_version: null,
      source: "local",
      added_at: new Date().toISOString(),
    };
    writeRegistry({ version: "1", skills: [entry] });
    writeConfig({
      inject_mode: "catalog",
      context_budget_kb: 100,
      auto_sync: true,
      backup_count: 5,
      groups: {},
    } as SkillsConfig);

    await syncAction();

    const claudeMd = fs.readFileSync(path.join(tmpDir, "CLAUDE.md"), "utf-8");
    expect(claudeMd).toContain("| Skill | Command | Description |");
    expect(claudeMd).toContain("test-skill");
    expect(claudeMd).not.toContain("Test content here.");
  });

  it("dry-run does not write files", async () => {
    const entry: RegistryEntry = {
      name: "test-skill",
      path: skillDir,
      active: true,
      scope: "global",
      pinned_version: null,
      source: "local",
      added_at: new Date().toISOString(),
    };
    writeRegistry({ version: "1", skills: [entry] });
    writeConfig({
      inject_mode: "full",
      context_budget_kb: 100,
      auto_sync: true,
      backup_count: 5,
      groups: {},
    } as SkillsConfig);

    await syncAction({ dryRun: true });

    // CLAUDE.md should NOT be created in dry-run
    const claudeMdPath = path.join(tmpDir, "CLAUDE.md");
    expect(fs.existsSync(claudeMdPath)).toBe(false);
  });

  it("dry-run does not create command files", async () => {
    const entry: RegistryEntry = {
      name: "test-skill",
      path: skillDir,
      active: true,
      scope: "global",
      pinned_version: null,
      source: "local",
      added_at: new Date().toISOString(),
    };
    writeRegistry({ version: "1", skills: [entry] });
    writeConfig({
      inject_mode: "full",
      context_budget_kb: 100,
      auto_sync: true,
      backup_count: 5,
      groups: {},
    } as SkillsConfig);

    await syncAction({ dryRun: true });

    const cmdPath = path.join(tmpDir, "commands", "test-skill.md");
    expect(fs.existsSync(cmdPath)).toBe(false);
  });

  it("reference mode strips managed block from CLAUDE.md", async () => {
    const entry: RegistryEntry = {
      name: "test-skill",
      path: skillDir,
      active: true,
      scope: "global",
      pinned_version: null,
      source: "local",
      added_at: new Date().toISOString(),
    };
    writeRegistry({ version: "1", skills: [entry] });
    writeConfig({
      inject_mode: "reference",
      context_budget_kb: 100,
      auto_sync: true,
      backup_count: 5,
      groups: {},
    } as SkillsConfig);

    // Create existing CLAUDE.md with a managed block
    const claudeMdPath = path.join(tmpDir, "CLAUDE.md");
    fse.ensureDirSync(tmpDir);
    fs.writeFileSync(
      claudeMdPath,
      "# Header\n\n<!-- claude-skills:begin -->\nold\n<!-- claude-skills:end -->\n\n# Footer\n",
      "utf-8"
    );

    await syncAction();

    const claudeMd = fs.readFileSync(claudeMdPath, "utf-8");
    expect(claudeMd).not.toContain("<!-- claude-skills:begin -->");
    expect(claudeMd).toContain("# Header");
    expect(claudeMd).toContain("# Footer");
    // But command files should still be created
    const cmdPath = path.join(tmpDir, "commands", "test-skill.md");
    expect(fs.existsSync(cmdPath)).toBe(true);
  });
});
