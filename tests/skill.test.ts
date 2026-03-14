import { describe, it, expect } from "vitest";
import path from "node:path";
import { parseSkillFile, validateSkill } from "../src/core/skill.js";

const fixtures = path.join(import.meta.dirname, "fixtures");

describe("parseSkillFile", () => {
  it("parses full frontmatter with metadata block", () => {
    const result = parseSkillFile(path.join(fixtures, "skill-full"));
    expect(result).not.toBeNull();
    expect(result!.meta.name).toBe("skill-full");
    expect(result!.meta.version).toBe("1.2.0");
    expect(result!.meta.author).toBe("testauthor");
    expect(result!.meta.description).toContain("Full-featured");
    expect(result!.meta.command).toBe("skill-full");
    expect(result!.meta.tags).toEqual(["test", "fixture"]);
    expect(result!.content).toContain("# Skill Full");
  });

  it("parses minimal frontmatter", () => {
    const result = parseSkillFile(path.join(fixtures, "skill-minimal"));
    expect(result).not.toBeNull();
    expect(result!.meta.name).toBe("skill-minimal");
    expect(result!.meta.version).toBe("0.0.0");
    expect(result!.meta.description).toBe(
      "A minimal skill with only required fields."
    );
  });

  it("handles no frontmatter", () => {
    const result = parseSkillFile(path.join(fixtures, "skill-none"));
    expect(result).not.toBeNull();
    expect(result!.meta.name).toBe("skill-none");
    expect(result!.meta.version).toBe("0.0.0");
    expect(result!.meta.description).toBe("Skill None");
    expect(result!.content).toContain("# Skill None");
  });

  it("finds lowercase skill.md", () => {
    const result = parseSkillFile(path.join(fixtures, "skill-lowercase"));
    expect(result).not.toBeNull();
    expect(result!.meta.name).toBe("skill-lowercase");
    expect(result!.meta.version).toBe("0.5.0");
    // On case-insensitive filesystems (macOS), SKILL.md check may match skill.md
    // The important thing is it parses correctly
    expect(result!.filePath).toBeTruthy();
  });

  it("returns null for missing directory", () => {
    const result = parseSkillFile(path.join(fixtures, "nonexistent"));
    expect(result).toBeNull();
  });
});

describe("validateSkill", () => {
  it("warns when name does not match directory", () => {
    const warnings = validateSkill(
      { name: "wrong-name", version: "1.0.0", description: "test" },
      "/some/path/correct-name"
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("does not match");
  });

  it("returns empty array for valid skill", () => {
    const warnings = validateSkill(
      { name: "my-skill", version: "1.0.0", description: "A skill" },
      "/some/path/my-skill"
    );
    expect(warnings).toHaveLength(0);
  });
});
