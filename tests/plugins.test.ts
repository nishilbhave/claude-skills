import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import fse from "fs-extra";
import {
  setupTestEnv,
  createTestPlugin,
  createInstalledPluginsJson,
  type TestEnv,
} from "./helpers.js";
import {
  readInstalledPlugins,
  resolveSkillsRoot,
  discoverSkillsInRoot,
  discoverAllPluginSkills,
  isPluginSource,
} from "../src/core/plugins.js";

let env: TestEnv;

beforeEach(() => {
  env = setupTestEnv("claude-skills-plugins-");
});

afterEach(() => {
  env.cleanup();
});

describe("readInstalledPlugins", () => {
  it("returns empty array when manifest file is missing", () => {
    const result = readInstalledPlugins();
    expect(result).toEqual([]);
  });

  it("parses valid manifest", () => {
    const installPath = createTestPlugin(env.tmpDir, "impeccable", "impeccable");
    createInstalledPluginsJson(env.tmpDir, [
      { name: "impeccable", marketplace: "impeccable", installPath },
    ]);

    const result = readInstalledPlugins();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("impeccable");
    expect(result[0].marketplace).toBe("impeccable");
    expect(result[0].installPath).toBe(installPath);
  });

  it("returns empty array for malformed JSON", () => {
    const pluginsDir = path.join(env.tmpDir, "plugins");
    fse.ensureDirSync(pluginsDir);
    fs.writeFileSync(
      path.join(pluginsDir, "installed_plugins.json"),
      "not valid json{{{",
      "utf-8"
    );

    const result = readInstalledPlugins();
    expect(result).toEqual([]);
  });
});

describe("resolveSkillsRoot", () => {
  it("resolves from plugin.json skills field", () => {
    const installPath = createTestPlugin(env.tmpDir, "test-plugin", "mp", {
      skills: ["my-skill"],
      skillsLocation: "plugin-json",
    });

    const result = resolveSkillsRoot(installPath);
    expect(result).toBe(path.join(installPath, ".claude", "skills"));
  });

  it("falls back to .claude/skills/ directory", () => {
    const installPath = createTestPlugin(env.tmpDir, "test-plugin2", "mp", {
      skills: ["my-skill"],
      skillsLocation: "claude-skills",
    });

    const result = resolveSkillsRoot(installPath);
    expect(result).toBe(path.join(installPath, ".claude", "skills"));
  });

  it("falls back to skills/ directory", () => {
    const installPath = createTestPlugin(env.tmpDir, "test-plugin3", "mp", {
      skills: ["my-skill"],
      skillsLocation: "skills-dir",
    });

    const result = resolveSkillsRoot(installPath);
    expect(result).toBe(path.join(installPath, "skills"));
  });

  it("returns null when no skills directory exists", () => {
    const installPath = path.join(env.tmpDir, "empty-plugin");
    fse.ensureDirSync(installPath);

    const result = resolveSkillsRoot(installPath);
    expect(result).toBeNull();
  });
});

describe("discoverSkillsInRoot", () => {
  it("finds directories with SKILL.md files", () => {
    const installPath = createTestPlugin(env.tmpDir, "test-plugin", "mp", {
      skills: ["skill-a", "skill-b"],
    });

    const skillsRoot = resolveSkillsRoot(installPath)!;
    const result = discoverSkillsInRoot(skillsRoot);
    expect(result).toHaveLength(2);
    expect(result.map((d) => path.basename(d)).sort()).toEqual(["skill-a", "skill-b"]);
  });

  it("skips directories without SKILL.md", () => {
    const installPath = createTestPlugin(env.tmpDir, "test-plugin", "mp", {
      skills: ["real-skill"],
    });

    const skillsRoot = resolveSkillsRoot(installPath)!;
    // Add a directory without SKILL.md
    fse.ensureDirSync(path.join(skillsRoot, "not-a-skill"));

    const result = discoverSkillsInRoot(skillsRoot);
    expect(result).toHaveLength(1);
    expect(path.basename(result[0])).toBe("real-skill");
  });
});

describe("discoverAllPluginSkills", () => {
  it("discovers skills across multiple plugins", () => {
    const path1 = createTestPlugin(env.tmpDir, "plugin-a", "mp", {
      skills: ["skill-1", "skill-2"],
    });
    const path2 = createTestPlugin(env.tmpDir, "plugin-b", "mp", {
      skills: ["skill-3"],
      skillsLocation: "skills-dir",
    });

    createInstalledPluginsJson(env.tmpDir, [
      { name: "plugin-a", marketplace: "mp", installPath: path1 },
      { name: "plugin-b", marketplace: "mp", installPath: path2 },
    ]);

    const result = discoverAllPluginSkills();
    expect(result).toHaveLength(3);
    expect(result.map((d) => d.skillName).sort()).toEqual([
      "skill-1",
      "skill-2",
      "skill-3",
    ]);
  });

  it("skips plugins with missing installPath", () => {
    createInstalledPluginsJson(env.tmpDir, [
      {
        name: "ghost",
        marketplace: "mp",
        installPath: "/nonexistent/path",
      },
    ]);

    const result = discoverAllPluginSkills();
    expect(result).toEqual([]);
  });
});

describe("isPluginSource", () => {
  it("returns true for plugin sources", () => {
    expect(isPluginSource("plugin:impeccable@impeccable")).toBe(true);
    expect(isPluginSource("plugin:test@mp")).toBe(true);
  });

  it("returns false for non-plugin sources", () => {
    expect(isPluginSource("local")).toBe(false);
    expect(isPluginSource("github:user/repo")).toBe(false);
    expect(isPluginSource("")).toBe(false);
  });
});
