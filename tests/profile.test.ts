import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  setupTestEnv,
  createTestSkill,
  createTestRegistry,
  makeEntry,
  defaultConfig,
  type TestEnv,
} from "./helpers.js";
import { writeConfig, readConfig } from "../src/core/config.js";
import { readRegistry } from "../src/core/registry.js";
import { profileExportAction, profileImportAction } from "../src/commands/profile.js";

let env: TestEnv;

beforeEach(() => {
  env = setupTestEnv("claude-skills-profile-");
});

afterEach(() => {
  env.cleanup();
});

describe("profile", () => {
  it("exports profile as JSON", async () => {
    const skillDir = createTestSkill(env.tmpDir, "export-test");
    createTestRegistry([makeEntry("export-test", skillDir, true)]);
    writeConfig(defaultConfig({ groups: { g1: ["export-test"] } }));

    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await profileExportAction("my-profile");

    expect(log).toHaveBeenCalled();
    const output = log.mock.calls[0][0];
    const profile = JSON.parse(output);
    expect(profile.name).toBe("my-profile");
    expect(profile.skills).toHaveLength(1);
    expect(profile.skills[0].name).toBe("export-test");
    expect(profile.skills[0].active).toBe(true);
    expect(profile.groups.g1).toEqual(["export-test"]);

    log.mockRestore();
  });

  it("imports profile and applies states", async () => {
    const skillA = createTestSkill(env.tmpDir, "skill-a");
    const skillB = createTestSkill(env.tmpDir, "skill-b");
    createTestRegistry([
      makeEntry("skill-a", skillA, false),
      makeEntry("skill-b", skillB, true),
    ]);
    writeConfig(defaultConfig());

    // Write profile file
    const profilePath = path.join(env.tmpDir, "profile.json");
    const profileData = {
      name: "test-import",
      exported_at: new Date().toISOString(),
      skills: [
        { name: "skill-a", active: true },
        { name: "skill-b", active: false },
      ],
      groups: { imported: ["skill-a"] },
    };
    fs.writeFileSync(profilePath, JSON.stringify(profileData), "utf-8");

    await profileImportAction(profilePath);

    const registry = readRegistry();
    const a = registry.skills.find((s) => s.name === "skill-a");
    const b = registry.skills.find((s) => s.name === "skill-b");
    expect(a!.active).toBe(true);
    expect(b!.active).toBe(false);

    const config = readConfig();
    expect(config.groups.imported).toEqual(["skill-a"]);
  });

  it("warns about missing skills during import", async () => {
    createTestRegistry([]);
    writeConfig(defaultConfig());

    const profilePath = path.join(env.tmpDir, "profile.json");
    const profileData = {
      name: "missing",
      exported_at: new Date().toISOString(),
      skills: [{ name: "nonexistent", active: true }],
      groups: {},
    };
    fs.writeFileSync(profilePath, JSON.stringify(profileData), "utf-8");

    const warnSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await profileImportAction(profilePath);

    const output = warnSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("nonexistent");

    warnSpy.mockRestore();
  });

  it("merges groups on import", async () => {
    createTestRegistry([]);
    writeConfig(defaultConfig({ groups: { existing: ["a"] } }));

    const profilePath = path.join(env.tmpDir, "profile.json");
    const profileData = {
      name: "merge",
      exported_at: new Date().toISOString(),
      skills: [],
      groups: { existing: ["b"], newgroup: ["c"] },
    };
    fs.writeFileSync(profilePath, JSON.stringify(profileData), "utf-8");

    await profileImportAction(profilePath);

    const config = readConfig();
    expect(config.groups.existing).toEqual(["a", "b"]);
    expect(config.groups.newgroup).toEqual(["c"]);
  });
});
