import fs from "node:fs";
import path from "node:path";
import { readRegistry, getActiveSkills } from "../core/registry.js";
import { readConfig } from "../core/config.js";
import { resolveRegistries } from "../core/resolver.js";
import { parseSkillFile } from "../core/skill.js";
import { injectSkills } from "../core/inject.js";
import { calculateBudget } from "../core/budget.js";
import {
  getRegistryPath,
  getProjectRegistryPath,
  getClaudeMdPath,
  getCommandsDir,
} from "../utils/paths.js";
import * as print from "../utils/print.js";

interface CheckResult {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

function checkRegistryValid(label: string, regPath: string): CheckResult {
  const name = `Registry valid (${label})`;
  if (!fs.existsSync(regPath)) {
    return { name, status: "warn", message: "Registry file not found." };
  }
  try {
    const raw = fs.readFileSync(regPath, "utf-8");
    JSON.parse(raw);
    return { name, status: "pass", message: "OK" };
  } catch {
    return { name, status: "fail", message: "Registry JSON is invalid." };
  }
}

function checkOrphanedCommands(): CheckResult {
  const name = "Orphaned commands";
  const commandsDir = getCommandsDir();
  if (!fs.existsSync(commandsDir)) {
    return { name, status: "pass", message: "No commands directory." };
  }

  const registry = readRegistry();
  const activeNames = new Set(
    getActiveSkills(registry).map((s) => s.name)
  );

  const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith(".md"));
  const orphans: string[] = [];

  for (const file of files) {
    const content = fs.readFileSync(
      path.join(commandsDir, file),
      "utf-8"
    );
    if (content.startsWith("<!-- claude-skills:managed -->")) {
      const cmdName = file.replace(/\.md$/, "");
      // Check if this command name matches any active skill name or command
      const hasActive = registry.skills.some(
        (s) =>
          s.active && (s.name === cmdName || parseSkillFile(s.path)?.meta.command === cmdName)
      );
      if (!hasActive) {
        orphans.push(cmdName);
      }
    }
  }

  if (orphans.length > 0) {
    return {
      name,
      status: "warn",
      message: `Orphaned managed commands: ${orphans.join(", ")}`,
    };
  }
  return { name, status: "pass", message: "No orphaned commands." };
}

function checkMissingSkillFiles(): CheckResult {
  const name = "Missing skill files";
  const registry = readRegistry();
  const missing: string[] = [];

  for (const entry of registry.skills) {
    if (!fs.existsSync(entry.path)) {
      missing.push(entry.name);
    }
  }

  if (missing.length > 0) {
    return {
      name,
      status: "fail",
      message: `Missing on disk: ${missing.join(", ")}`,
    };
  }
  return { name, status: "pass", message: "All skill paths exist." };
}

function checkActiveConflicts(): CheckResult {
  const name = "Active conflicts";
  const registry = readRegistry();
  const active = getActiveSkills(registry);
  const conflicts: string[] = [];

  for (const entry of active) {
    const parsed = parseSkillFile(entry.path);
    if (!parsed?.meta.conflicts?.length) continue;

    for (const conflict of parsed.meta.conflicts) {
      const other = active.find((a) => a.name === conflict);
      if (other) {
        const pair = [entry.name, conflict].sort().join(" <-> ");
        if (!conflicts.includes(pair)) {
          conflicts.push(pair);
        }
      }
    }
  }

  if (conflicts.length > 0) {
    return {
      name,
      status: "warn",
      message: `Conflicting active skills: ${conflicts.join("; ")}`,
    };
  }
  return { name, status: "pass", message: "No active conflicts." };
}

function checkClaudeMdSync(): CheckResult {
  const name = "CLAUDE.md in sync";
  const config = readConfig();
  const registry = readRegistry();
  const activeEntries = getActiveSkills(registry);

  const skills = activeEntries
    .map((e) => parseSkillFile(e.path))
    .filter((p) => p !== null);

  const claudeMdPath = getClaudeMdPath();
  const existing = fs.existsSync(claudeMdPath)
    ? fs.readFileSync(claudeMdPath, "utf-8")
    : "";

  const expected = injectSkills(existing, skills, config.inject_mode);

  if (existing === expected) {
    return { name, status: "pass", message: "CLAUDE.md is up to date." };
  }
  return {
    name,
    status: "warn",
    message: "CLAUDE.md is out of sync. Run 'claude-skills sync' to update.",
  };
}

function checkContextBudget(): CheckResult {
  const name = "Context budget";
  const config = readConfig();
  const registry = readRegistry();
  const active = getActiveSkills(registry);

  const contents = active
    .map((e) => parseSkillFile(e.path))
    .filter((p) => p !== null)
    .map((p) => p.content);

  const budget = calculateBudget(contents, config.context_budget_kb);

  if (budget.level === "red") {
    return { name, status: "fail", message: budget.message };
  }
  if (budget.level === "yellow") {
    return { name, status: "warn", message: budget.message };
  }
  return { name, status: "pass", message: budget.message };
}

function checkGroupsIntegrity(): CheckResult {
  const name = "Groups integrity";
  const config = readConfig();
  const registry = readRegistry();
  const missing: string[] = [];

  for (const [groupName, skills] of Object.entries(config.groups)) {
    for (const skillName of skills) {
      if (!registry.skills.find((s) => s.name === skillName)) {
        missing.push(`${groupName}/${skillName}`);
      }
    }
  }

  if (missing.length > 0) {
    return {
      name,
      status: "warn",
      message: `Group references to missing skills: ${missing.join(", ")}`,
    };
  }
  return { name, status: "pass", message: "All group references valid." };
}

export async function doctorAction(): Promise<void> {
  const results: CheckResult[] = [];

  // 1. Global registry
  const globalCheck = checkRegistryValid("global", getRegistryPath());
  results.push(globalCheck);

  // 2. Project registry (if exists)
  const projectPath = getProjectRegistryPath();
  if (projectPath) {
    results.push(checkRegistryValid("project", projectPath));
  }

  // If global registry is invalid, skip checks that depend on it
  if (globalCheck.status === "fail") {
    results.push({ name: "Orphaned commands", status: "warn", message: "Skipped — registry invalid." });
    results.push({ name: "Missing skill files", status: "warn", message: "Skipped — registry invalid." });
    results.push({ name: "Active conflicts", status: "warn", message: "Skipped — registry invalid." });
    results.push({ name: "CLAUDE.md in sync", status: "warn", message: "Skipped — registry invalid." });
    results.push({ name: "Context budget", status: "warn", message: "Skipped — registry invalid." });
    results.push({ name: "Groups integrity", status: "warn", message: "Skipped — registry invalid." });
  } else {
    // 3. Orphaned commands
    results.push(checkOrphanedCommands());

    // 4. Missing skill files
    results.push(checkMissingSkillFiles());

    // 5. Active conflicts
    results.push(checkActiveConflicts());

    // 6. CLAUDE.md in sync
    results.push(checkClaudeMdSync());

    // 7. Context budget
    results.push(checkContextBudget());

    // 8. Groups integrity
    results.push(checkGroupsIntegrity());
  }

  // Print results
  console.log("");
  const icons = { pass: "✓", warn: "⚠", fail: "✗" } as const;

  let passes = 0;
  let warns = 0;
  let fails = 0;

  for (const r of results) {
    const icon = icons[r.status];
    if (r.status === "pass") {
      print.success(`${r.name}: ${r.message}`);
      passes++;
    } else if (r.status === "warn") {
      print.warn(`${r.name}: ${r.message}`);
      warns++;
    } else {
      print.error(`${r.name}: ${r.message}`);
      fails++;
    }
  }

  console.log("");
  print.info(
    `${results.length} checks: ${passes} passed, ${warns} warning(s), ${fails} failed`
  );
}
