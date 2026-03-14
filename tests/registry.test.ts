import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  readRegistry,
  writeRegistry,
  findSkill,
  addSkill,
  removeSkill,
  setActive,
  getActiveSkills,
  type RegistryEntry,
} from "../src/core/registry.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-skills-test-"));
  process.env.CLAUDE_SKILLS_BASE_DIR = tmpDir;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.CLAUDE_SKILLS_BASE_DIR;
});

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

describe("registry", () => {
  it("reads empty registry when file does not exist", () => {
    const reg = readRegistry();
    expect(reg.version).toBe("1");
    expect(reg.skills).toEqual([]);
  });

  it("writes and reads registry", () => {
    const reg = { version: "1", skills: [makeEntry("test-skill")] };
    writeRegistry(reg);
    const read = readRegistry();
    expect(read.skills).toHaveLength(1);
    expect(read.skills[0].name).toBe("test-skill");
  });

  it("finds a skill by name", () => {
    const reg = { version: "1", skills: [makeEntry("alpha"), makeEntry("beta")] };
    expect(findSkill(reg, "beta")?.name).toBe("beta");
    expect(findSkill(reg, "gamma")).toBeUndefined();
  });

  it("adds a new skill", () => {
    let reg = { version: "1" as const, skills: [] as RegistryEntry[] };
    reg = addSkill(reg, makeEntry("new-skill"));
    expect(reg.skills).toHaveLength(1);
  });

  it("updates existing skill on add", () => {
    let reg = { version: "1", skills: [makeEntry("existing")] };
    const updated = makeEntry("existing");
    updated.path = "/new/path";
    reg = addSkill(reg, updated);
    expect(reg.skills).toHaveLength(1);
    expect(reg.skills[0].path).toBe("/new/path");
  });

  it("removes a skill", () => {
    let reg = { version: "1", skills: [makeEntry("a"), makeEntry("b")] };
    reg = removeSkill(reg, "a");
    expect(reg.skills).toHaveLength(1);
    expect(reg.skills[0].name).toBe("b");
  });

  it("sets active status", () => {
    let reg = { version: "1", skills: [makeEntry("skill1", false)] };
    reg = setActive(reg, "skill1", true);
    expect(reg.skills[0].active).toBe(true);
  });

  it("gets active skills", () => {
    const reg = {
      version: "1",
      skills: [makeEntry("a", true), makeEntry("b", false), makeEntry("c", true)],
    };
    const active = getActiveSkills(reg);
    expect(active).toHaveLength(2);
    expect(active.map((s) => s.name)).toEqual(["a", "c"]);
  });
});
