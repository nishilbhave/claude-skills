import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import fse from "fs-extra";
import {
  setupTestEnv,
  createTestSkill,
  createTestRegistry,
  makeEntry,
  defaultConfig,
  type TestEnv,
} from "./helpers.js";
import { writeConfig } from "../src/core/config.js";
import { doctorAction } from "../src/commands/doctor.js";

let env: TestEnv;

beforeEach(() => {
  env = setupTestEnv("claude-skills-doctor-");
});

afterEach(() => {
  env.cleanup();
});

describe("doctor", () => {
  it("passes all checks with clean setup", async () => {
    const skillDir = createTestSkill(env.tmpDir, "healthy");
    createTestRegistry([makeEntry("healthy", skillDir, true)]);
    writeConfig(defaultConfig());

    // Sync first to create CLAUDE.md and commands
    const { syncAction } = await import("../src/commands/sync.js");
    await syncAction();

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await doctorAction();

    const output = log.mock.calls.map((c) => c[0]).join("\n");
    expect(output).not.toContain("✗");

    log.mockRestore();
    errorSpy.mockRestore();
  });

  it("detects missing skill files", async () => {
    createTestRegistry([makeEntry("ghost", "/nonexistent/path", true)]);
    writeConfig(defaultConfig());

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await doctorAction();

    const allOutput = [...log.mock.calls, ...errorSpy.mock.calls]
      .map((c) => c[0])
      .join("\n");
    expect(allOutput).toContain("ghost");

    log.mockRestore();
    errorSpy.mockRestore();
  });

  it("detects orphaned commands", async () => {
    writeConfig(defaultConfig());
    createTestRegistry([]);

    // Create a managed command file with no matching skill
    const commandsDir = path.join(env.tmpDir, "commands");
    fse.ensureDirSync(commandsDir);
    fs.writeFileSync(
      path.join(commandsDir, "orphan.md"),
      "<!-- claude-skills:managed -->\n# orphan\n",
      "utf-8"
    );

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await doctorAction();

    const output = log.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("orphan");

    log.mockRestore();
    errorSpy.mockRestore();
  });

  it("detects CLAUDE.md out of sync", async () => {
    const skillDir = createTestSkill(env.tmpDir, "out-of-sync");
    createTestRegistry([makeEntry("out-of-sync", skillDir, true)]);
    writeConfig(defaultConfig());

    // Create CLAUDE.md with different content
    fs.writeFileSync(
      path.join(env.tmpDir, "CLAUDE.md"),
      "# Stale content\n",
      "utf-8"
    );

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await doctorAction();

    const output = log.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("out of sync");

    log.mockRestore();
    errorSpy.mockRestore();
  });

  it("detects groups with missing skills", async () => {
    createTestRegistry([]);
    writeConfig(defaultConfig({ groups: { broken: ["nonexistent-skill"] } }));

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await doctorAction();

    const output = log.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("nonexistent-skill");

    log.mockRestore();
    errorSpy.mockRestore();
  });

  it("detects active conflicts", async () => {
    const skillA = createTestSkill(env.tmpDir, "skill-a", {
      conflicts: ["skill-b"],
    });
    const skillB = createTestSkill(env.tmpDir, "skill-b");
    createTestRegistry([
      makeEntry("skill-a", skillA, true),
      makeEntry("skill-b", skillB, true),
    ]);
    writeConfig(defaultConfig());

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await doctorAction();

    const output = log.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("skill-a");
    expect(output).toContain("skill-b");

    log.mockRestore();
    errorSpy.mockRestore();
  });

  it("handles empty registry gracefully", async () => {
    createTestRegistry([]);
    writeConfig(defaultConfig());

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await doctorAction();

    // Should not throw
    const output = log.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("checks");

    log.mockRestore();
    errorSpy.mockRestore();
  });

  it("reports invalid registry JSON", async () => {
    const regPath = path.join(env.tmpDir, "skills.json");
    fse.ensureDirSync(env.tmpDir);
    fs.writeFileSync(regPath, "not valid json{{{", "utf-8");
    writeConfig(defaultConfig());

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await doctorAction();

    const allOutput = [...log.mock.calls, ...errorSpy.mock.calls]
      .map((c) => c[0])
      .join("\n");
    expect(allOutput).toContain("invalid");

    log.mockRestore();
    errorSpy.mockRestore();
  });
});
