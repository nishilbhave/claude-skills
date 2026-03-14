import fs from "node:fs";
import fse from "fs-extra";
import { createTwoFilesPatch } from "diff";
import { readRegistry, getActiveSkills } from "../core/registry.js";
import { readConfig } from "../core/config.js";
import { parseSkillFile } from "../core/skill.js";
import { backupClaudeMd } from "../core/backup.js";
import { calculateBudget } from "../core/budget.js";
import { injectSkills } from "../core/inject.js";
import { syncCommands } from "../core/commands.js";
import { getClaudeMdPath } from "../utils/paths.js";
import * as print from "../utils/print.js";
export async function syncAction(options) {
    const dryRun = options?.dryRun ?? false;
    const config = readConfig();
    const registry = readRegistry();
    const activeEntries = getActiveSkills(registry);
    if (activeEntries.length === 0) {
        print.info("No active skills to sync.");
        // Still clean up CLAUDE.md managed block and commands
        const claudeMdPath = getClaudeMdPath();
        if (fs.existsSync(claudeMdPath)) {
            const existing = fs.readFileSync(claudeMdPath, "utf-8");
            if (existing.includes("<!-- claude-skills:begin -->")) {
                if (dryRun) {
                    const updated = injectSkills(existing, [], config.inject_mode);
                    const diff = createTwoFilesPatch("CLAUDE.md", "CLAUDE.md", existing, updated);
                    console.log(diff);
                    print.info("[dry-run] No files written.");
                    return;
                }
                backupClaudeMd(config.backup_count);
                const updated = injectSkills(existing, [], config.inject_mode);
                fs.writeFileSync(claudeMdPath, updated, "utf-8");
            }
        }
        syncCommands([], { dryRun });
        return;
    }
    // Parse active skills from disk
    const skills = [];
    for (const entry of activeEntries) {
        const parsed = parseSkillFile(entry.path);
        if (parsed) {
            skills.push(parsed);
        }
        else {
            print.warn(`Skill "${entry.name}" not found at ${entry.path} — skipping.`);
        }
    }
    // Budget check (only for full mode)
    if (config.inject_mode === "full") {
        const budget = calculateBudget(skills.map((s) => s.content), config.context_budget_kb);
        if (budget.level === "red") {
            print.warn(budget.message);
            print.info("Tip: Run claude-skills config --inject-mode catalog to reduce context usage.");
        }
        else if (budget.level === "yellow") {
            print.warn(budget.message);
        }
        else {
            print.info(budget.message);
        }
    }
    // Build new CLAUDE.md content
    const claudeMdPath = getClaudeMdPath();
    const existing = fs.existsSync(claudeMdPath)
        ? fs.readFileSync(claudeMdPath, "utf-8")
        : "";
    const updated = injectSkills(existing, skills, config.inject_mode);
    if (dryRun) {
        // Show diff
        const diff = createTwoFilesPatch("CLAUDE.md", "CLAUDE.md", existing, updated);
        console.log(diff);
        // Show command changes without writing
        const { created, removed } = syncCommands(skills, { dryRun: true });
        if (created.length > 0) {
            print.dim(`  Commands to create: ${created.join(", ")}`);
        }
        if (removed.length > 0) {
            print.dim(`  Commands to remove: ${removed.join(", ")}`);
        }
        print.info("[dry-run] No files written.");
        return;
    }
    // Backup CLAUDE.md
    const backupPath = backupClaudeMd(config.backup_count);
    if (backupPath) {
        print.dim(`  Backed up CLAUDE.md → ${backupPath}`);
    }
    // Write CLAUDE.md
    fse.ensureDirSync(claudeMdPath.replace(/\/[^/]+$/, ""));
    fs.writeFileSync(claudeMdPath, updated, "utf-8");
    // Sync commands
    const { created, removed } = syncCommands(skills);
    // Summary
    print.success(`Synced ${skills.length} skill${skills.length !== 1 ? "s" : ""} to CLAUDE.md (${config.inject_mode} mode)`);
    if (created.length > 0) {
        print.dim(`  Commands: ${created.join(", ")}`);
    }
    if (removed.length > 0) {
        print.dim(`  Removed commands: ${removed.join(", ")}`);
    }
}
//# sourceMappingURL=sync.js.map