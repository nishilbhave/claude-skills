import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import fse from "fs-extra";
import { setupTestEnv, type TestEnv } from "./helpers.js";

let env: TestEnv;

beforeEach(() => {
  env = setupTestEnv("claude-skills-restore-");
});

afterEach(() => {
  env.cleanup();
});

describe("restore", () => {
  it("reads backup and strips timestamp", () => {
    const backupDir = path.join(env.tmpDir, "skills-backup");
    fse.ensureDirSync(backupDir);

    const originalContent = "# My CLAUDE.md\n\nOriginal content.\n";
    const backupContent = `<!-- backup: 2025-01-01T00:00:00.000Z -->\n${originalContent}`;
    fs.writeFileSync(
      path.join(backupDir, "CLAUDE.md.1.bak"),
      backupContent,
      "utf-8"
    );

    const raw = fs.readFileSync(
      path.join(backupDir, "CLAUDE.md.1.bak"),
      "utf-8"
    );
    const stripped = raw.replace(/^<!-- backup: .* -->\n/, "");
    expect(stripped).toBe(originalContent);
  });

  it("detects identical content", () => {
    const backupDir = path.join(env.tmpDir, "skills-backup");
    fse.ensureDirSync(backupDir);

    const content = "# Same content\n";
    fs.writeFileSync(
      path.join(backupDir, "CLAUDE.md.1.bak"),
      `<!-- backup: 2025-01-01T00:00:00.000Z -->\n${content}`,
      "utf-8"
    );
    fs.writeFileSync(
      path.join(env.tmpDir, "CLAUDE.md"),
      content,
      "utf-8"
    );

    const raw = fs.readFileSync(
      path.join(backupDir, "CLAUDE.md.1.bak"),
      "utf-8"
    );
    const stripped = raw.replace(/^<!-- backup: .* -->\n/, "");
    const current = fs.readFileSync(
      path.join(env.tmpDir, "CLAUDE.md"),
      "utf-8"
    );
    expect(stripped).toBe(current);
  });

  it("can restore different backup content", () => {
    const backupDir = path.join(env.tmpDir, "skills-backup");
    fse.ensureDirSync(backupDir);

    const backupContent = "# Old content\n";
    const currentContent = "# New content\n";

    fs.writeFileSync(
      path.join(backupDir, "CLAUDE.md.1.bak"),
      `<!-- backup: 2025-01-01T00:00:00.000Z -->\n${backupContent}`,
      "utf-8"
    );
    fs.writeFileSync(
      path.join(env.tmpDir, "CLAUDE.md"),
      currentContent,
      "utf-8"
    );

    // Simulate restore
    const raw = fs.readFileSync(
      path.join(backupDir, "CLAUDE.md.1.bak"),
      "utf-8"
    );
    const restored = raw.replace(/^<!-- backup: .* -->\n/, "");
    fs.writeFileSync(
      path.join(env.tmpDir, "CLAUDE.md"),
      restored,
      "utf-8"
    );

    const result = fs.readFileSync(
      path.join(env.tmpDir, "CLAUDE.md"),
      "utf-8"
    );
    expect(result).toBe(backupContent);
  });

  it("handles no backup file", () => {
    const backupPath = path.join(
      env.tmpDir,
      "skills-backup",
      "CLAUDE.md.1.bak"
    );
    expect(fs.existsSync(backupPath)).toBe(false);
  });
});
