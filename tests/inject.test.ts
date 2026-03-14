import { describe, it, expect } from "vitest";
import { injectSkills } from "../src/core/inject.js";
import type { ParsedSkill } from "../src/core/skill.js";

function makeSkill(name: string, content: string, version = "1.0.0"): ParsedSkill {
  return {
    meta: { name, version, description: `${name} description` },
    content,
    filePath: `/fake/${name}/SKILL.md`,
    dirPath: `/fake/${name}`,
  };
}

describe("injectSkills", () => {
  it("injects into empty content (full mode)", () => {
    const result = injectSkills("", [makeSkill("alpha", "Alpha content")], "full");
    expect(result).toContain("<!-- claude-skills:begin -->");
    expect(result).toContain("<!-- claude-skills:end -->");
    expect(result).toContain("### alpha (v1.0.0)");
    expect(result).toContain("Alpha content");
  });

  it("preserves content outside markers", () => {
    const existing = "# My Project\n\nSome existing content.\n";
    const result = injectSkills(existing, [makeSkill("test", "Test content")], "full");
    expect(result).toContain("# My Project");
    expect(result).toContain("Some existing content.");
    expect(result).toContain("### test (v1.0.0)");
  });

  it("replaces existing managed block", () => {
    const existing = [
      "# Header",
      "",
      "<!-- claude-skills:begin -->",
      "old content",
      "<!-- claude-skills:end -->",
      "",
      "# Footer",
    ].join("\n");

    const result = injectSkills(existing, [makeSkill("new", "New content")], "full");
    expect(result).not.toContain("old content");
    expect(result).toContain("### new (v1.0.0)");
    expect(result).toContain("# Header");
    expect(result).toContain("# Footer");
  });

  it("generates catalog mode", () => {
    const skill = makeSkill("alpha", "Alpha content");
    skill.meta.command = "alpha";
    const result = injectSkills("", [skill], "catalog");
    expect(result).toContain("| Skill | Command | Description |");
    expect(result).toContain("| alpha | /alpha | alpha description |");
    expect(result).not.toContain("Alpha content");
  });

  it("removes block when no active skills", () => {
    const existing = [
      "# Header",
      "",
      "<!-- claude-skills:begin -->",
      "old content",
      "<!-- claude-skills:end -->",
      "",
      "# Footer",
    ].join("\n");

    const result = injectSkills(existing, [], "full");
    expect(result).not.toContain("<!-- claude-skills:begin -->");
    expect(result).toContain("# Header");
    expect(result).toContain("# Footer");
  });

  it("is idempotent", () => {
    const skills = [makeSkill("alpha", "Alpha content")];
    const first = injectSkills("", skills, "full");
    const second = injectSkills(first, skills, "full");
    expect(first).toBe(second);
  });

  it("generates summary mode", () => {
    const skill = makeSkill("alpha", "Alpha content");
    skill.dirPath = "/home/user/.claude/skills/alpha";
    const result = injectSkills("", [skill], "summary");
    expect(result).toContain("### alpha (v1.0.0)");
    expect(result).toContain("alpha description");
    expect(result).toContain("Path: /home/user/.claude/skills/alpha");
    // Summary mode should NOT include full content
    expect(result).not.toContain("Alpha content");
  });

  it("reference mode strips existing block", () => {
    const existing = [
      "# Header",
      "",
      "<!-- claude-skills:begin -->",
      "old content",
      "<!-- claude-skills:end -->",
      "",
      "# Footer",
    ].join("\n");

    const result = injectSkills(
      existing,
      [makeSkill("test", "Test content")],
      "reference"
    );
    expect(result).not.toContain("<!-- claude-skills:begin -->");
    expect(result).not.toContain("old content");
    expect(result).toContain("# Header");
    expect(result).toContain("# Footer");
  });

  it("reference mode returns content as-is if no block exists", () => {
    const existing = "# My Config\n\nSome content.\n";
    const result = injectSkills(existing, [makeSkill("x", "X")], "reference");
    expect(result).toBe(existing);
  });

  it("summary mode is idempotent", () => {
    const skills = [makeSkill("alpha", "Alpha content")];
    skills[0].dirPath = "/path/alpha";
    const first = injectSkills("", skills, "summary");
    const second = injectSkills(first, skills, "summary");
    expect(first).toBe(second);
  });
});
