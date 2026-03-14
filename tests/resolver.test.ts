import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import fse from "fs-extra";
import { resolveRegistries } from "../src/core/resolver.js";
import { writeRegistry, type RegistryEntry } from "../src/core/registry.js";
import { getProjectRegistryPath } from "../src/utils/paths.js";

let tmpDir: string;
let projectDir: string;

function makeEntry(name: string, active = false): RegistryEntry {
  return {
    name,
    path: `/fake/path/${name}`,
    active,
    scope: "global",
    pinned_version: null,
    source: "local",
    added_at: new Date().toISOString(),
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-skills-resolver-"));
  process.env.CLAUDE_SKILLS_BASE_DIR = tmpDir;

  // Create a project directory with .git and .claude/skills.json
  projectDir = path.join(tmpDir, "project");
  fse.ensureDirSync(path.join(projectDir, ".git"));
  fse.ensureDirSync(path.join(projectDir, ".claude"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.CLAUDE_SKILLS_BASE_DIR;
  delete process.env.CLAUDE_SKILLS_PROJECT_DIR;
});

describe("resolver", () => {
  it("returns global only when no project registry", () => {
    writeRegistry({
      version: "1",
      skills: [makeEntry("global-skill", true)],
    });

    // No project dir set
    const result = resolveRegistries();
    expect(result.project).toBeNull();
    expect(result.merged.skills).toHaveLength(1);
    expect(result.merged.skills[0].name).toBe("global-skill");
  });

  it("merges project registry with global", () => {
    writeRegistry({
      version: "1",
      skills: [makeEntry("shared", true), makeEntry("global-only", false)],
    });

    // Write project registry
    const projectRegPath = path.join(projectDir, ".claude", "skills.json");
    const projectReg = {
      version: "1",
      skills: [
        { ...makeEntry("shared", false), scope: "project" },
        { ...makeEntry("project-only", true), scope: "project" },
      ],
    };
    fs.writeFileSync(
      projectRegPath,
      JSON.stringify(projectReg, null, 2),
      "utf-8"
    );

    process.env.CLAUDE_SKILLS_PROJECT_DIR = projectDir;
    const result = resolveRegistries();

    expect(result.global.skills).toHaveLength(2);
    expect(result.project).not.toBeNull();
    expect(result.project!.skills).toHaveLength(2);

    // Merged: project overrides "shared", keeps "global-only", adds "project-only"
    expect(result.merged.skills).toHaveLength(3);

    const shared = result.merged.skills.find((s) => s.name === "shared");
    expect(shared!.active).toBe(false); // Project override
    expect(shared!.scope).toBe("project");

    const projectOnly = result.merged.skills.find(
      (s) => s.name === "project-only"
    );
    expect(projectOnly!.active).toBe(true);
  });

  it("finds project registry path via walk-up", () => {
    const deepDir = path.join(projectDir, "src", "lib", "deep");
    fse.ensureDirSync(deepDir);

    const projectRegPath = path.join(projectDir, ".claude", "skills.json");
    fs.writeFileSync(
      projectRegPath,
      JSON.stringify({ version: "1", skills: [] }),
      "utf-8"
    );

    process.env.CLAUDE_SKILLS_PROJECT_DIR = deepDir;
    const found = getProjectRegistryPath();
    expect(found).toBe(projectRegPath);
  });

  it("stops walk-up at .git root when no registry", () => {
    // Project has .git but no .claude/skills.json
    const projectNoReg = path.join(tmpDir, "project-no-reg");
    fse.ensureDirSync(path.join(projectNoReg, ".git"));
    fse.ensureDirSync(path.join(projectNoReg, "src"));

    process.env.CLAUDE_SKILLS_PROJECT_DIR = path.join(projectNoReg, "src");
    const found = getProjectRegistryPath();
    expect(found).toBeNull();
  });

  it("returns null when not in a project", () => {
    // Point to a directory with no .git or .claude
    const emptyDir = path.join(tmpDir, "empty");
    fse.ensureDirSync(emptyDir);

    process.env.CLAUDE_SKILLS_PROJECT_DIR = emptyDir;
    const found = getProjectRegistryPath();
    expect(found).toBeNull();
  });

  it("project skills override global on name collision", () => {
    writeRegistry({
      version: "1",
      skills: [makeEntry("collider", true)],
    });

    const projectRegPath = path.join(projectDir, ".claude", "skills.json");
    const overrideEntry = makeEntry("collider", false);
    overrideEntry.path = "/project/path/collider";
    fs.writeFileSync(
      projectRegPath,
      JSON.stringify({ version: "1", skills: [overrideEntry] }),
      "utf-8"
    );

    process.env.CLAUDE_SKILLS_PROJECT_DIR = projectDir;
    const result = resolveRegistries();

    const merged = result.merged.skills.find((s) => s.name === "collider");
    expect(merged!.active).toBe(false);
    expect(merged!.path).toBe("/project/path/collider");
  });
});
