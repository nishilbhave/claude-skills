import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  setupTestEnv,
  createTestSkill,
  createTestPlugin,
  createTestRegistry,
  createInstalledPluginsJson,
  makeEntry,
  type TestEnv,
} from "./helpers.js";
import { readRegistry } from "../src/core/registry.js";
import { discoverAction } from "../src/commands/discover.js";

let env: TestEnv;

beforeEach(() => {
  env = setupTestEnv("claude-skills-discover-");
});

afterEach(() => {
  env.cleanup();
});

describe("discover", () => {
  it("discovers and registers plugin skills", async () => {
    const installPath = createTestPlugin(env.tmpDir, "test-plugin", "mp", {
      skills: ["plugin-skill-a", "plugin-skill-b"],
    });
    createInstalledPluginsJson(env.tmpDir, [
      { name: "test-plugin", marketplace: "mp", installPath },
    ]);
    createTestRegistry([]);

    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await discoverAction({});

    const registry = readRegistry();
    expect(registry.skills).toHaveLength(2);
    expect(registry.skills.map((s) => s.name).sort()).toEqual([
      "plugin-skill-a",
      "plugin-skill-b",
    ]);
    expect(registry.skills[0].source).toBe("plugin:test-plugin@mp");
    expect(registry.skills[0].active).toBe(false);

    log.mockRestore();
  });

  it("skips plugin skills when local skill has same name", async () => {
    const localSkillDir = createTestSkill(env.tmpDir, "shared-name");
    const installPath = createTestPlugin(env.tmpDir, "test-plugin", "mp", {
      skills: ["shared-name"],
    });
    createInstalledPluginsJson(env.tmpDir, [
      { name: "test-plugin", marketplace: "mp", installPath },
    ]);
    createTestRegistry([makeEntry("shared-name", localSkillDir, true)]);

    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await discoverAction({});

    const registry = readRegistry();
    // The local skill should remain unchanged
    const entry = registry.skills.find((s) => s.name === "shared-name");
    expect(entry?.source).toBe("local");

    log.mockRestore();
  });

  it("updates existing plugin entries on re-discover", async () => {
    const installPath = createTestPlugin(env.tmpDir, "test-plugin", "mp", {
      skills: ["my-skill"],
      version: "2.0.0",
    });
    createInstalledPluginsJson(env.tmpDir, [
      { name: "test-plugin", marketplace: "mp", installPath, version: "2.0.0" },
    ]);
    createTestRegistry([
      makeEntry("my-skill", "/old/path", false, {
        source: "plugin:test-plugin@mp",
        pinned_version: "1.0.0",
      }),
    ]);

    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await discoverAction({});

    const registry = readRegistry();
    const entry = registry.skills.find((s) => s.name === "my-skill");
    expect(entry?.pinned_version).toBe("2.0.0");
    expect(entry?.path).toContain("test-plugin");

    log.mockRestore();
  });

  it("does not write registry in dry-run mode", async () => {
    const installPath = createTestPlugin(env.tmpDir, "test-plugin", "mp", {
      skills: ["dry-skill"],
    });
    createInstalledPluginsJson(env.tmpDir, [
      { name: "test-plugin", marketplace: "mp", installPath },
    ]);
    createTestRegistry([]);

    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await discoverAction({ dryRun: true });

    const registry = readRegistry();
    expect(registry.skills).toHaveLength(0);

    log.mockRestore();
  });

  it("shows info message when no plugins found", async () => {
    createTestRegistry([]);

    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await discoverAction({});

    const output = log.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("No plugin skills found");

    log.mockRestore();
  });

  it("handles duplicate skill names across plugins", async () => {
    const path1 = createTestPlugin(env.tmpDir, "plugin-a", "mp", {
      skills: ["dupe-skill"],
    });
    const path2 = createTestPlugin(env.tmpDir, "plugin-b", "mp", {
      skills: ["dupe-skill"],
    });
    createInstalledPluginsJson(env.tmpDir, [
      { name: "plugin-a", marketplace: "mp", installPath: path1 },
      { name: "plugin-b", marketplace: "mp", installPath: path2 },
    ]);
    createTestRegistry([]);

    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await discoverAction({});

    const registry = readRegistry();
    // Only one entry for dupe-skill (first plugin wins)
    const dupeEntries = registry.skills.filter((s) => s.name === "dupe-skill");
    expect(dupeEntries).toHaveLength(1);
    expect(dupeEntries[0].source).toBe("plugin:plugin-a@mp");

    // Warning should have been printed
    const output = log.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Duplicate");

    log.mockRestore();
  });
});
