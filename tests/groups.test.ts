import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createGroup,
  addSkillToGroup,
  removeSkillFromGroup,
  getAllGroups,
  getGroupsForSkill,
} from "../src/core/groups.js";
import { readConfig } from "../src/core/config.js";
import { setupTestEnv, type TestEnv } from "./helpers.js";

let env: TestEnv;

beforeEach(() => {
  env = setupTestEnv("claude-skills-groups-");
});

afterEach(() => {
  env.cleanup();
});

describe("groups", () => {
  it("creates a new group", () => {
    createGroup("marketing");
    const groups = getAllGroups();
    expect(groups["marketing"]).toEqual([]);
  });

  it("creates a group with initial skills", () => {
    createGroup("dev", ["lint", "test", "build"]);
    const groups = getAllGroups();
    expect(groups["dev"]).toEqual(["lint", "test", "build"]);
  });

  it("throws when creating duplicate group", () => {
    createGroup("dup");
    expect(() => createGroup("dup")).toThrow('Group "dup" already exists.');
  });

  it("adds a skill to a group", () => {
    createGroup("g1");
    addSkillToGroup("g1", "skill-a");
    expect(getAllGroups()["g1"]).toEqual(["skill-a"]);
  });

  it("is idempotent when adding same skill", () => {
    createGroup("g2");
    addSkillToGroup("g2", "skill-a");
    addSkillToGroup("g2", "skill-a");
    expect(getAllGroups()["g2"]).toEqual(["skill-a"]);
  });

  it("creates group on add if it does not exist", () => {
    addSkillToGroup("auto-created", "skill-x");
    expect(getAllGroups()["auto-created"]).toEqual(["skill-x"]);
  });

  it("removes a skill from a group", () => {
    createGroup("g3", ["a", "b", "c"]);
    removeSkillFromGroup("g3", "b");
    expect(getAllGroups()["g3"]).toEqual(["a", "c"]);
  });

  it("throws when removing from nonexistent group", () => {
    expect(() => removeSkillFromGroup("nope", "x")).toThrow(
      'Group "nope" does not exist.'
    );
  });

  it("gets groups for a specific skill", () => {
    createGroup("alpha", ["s1", "s2"]);
    createGroup("beta", ["s2", "s3"]);
    createGroup("gamma", ["s3"]);
    expect(getGroupsForSkill("s2")).toEqual(["alpha", "beta"]);
    expect(getGroupsForSkill("s1")).toEqual(["alpha"]);
    expect(getGroupsForSkill("s4")).toEqual([]);
  });

  it("persists groups across reads", () => {
    createGroup("persist-test", ["x"]);
    addSkillToGroup("persist-test", "y");
    // Re-read config to ensure persistence
    const config = readConfig();
    expect(config.groups["persist-test"]).toEqual(["x", "y"]);
  });
});
