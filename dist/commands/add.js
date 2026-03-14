import fs from "node:fs";
import path from "node:path";
import { readRegistry, writeRegistry, addSkill, findSkill, } from "../core/registry.js";
import { parseSkillFile, validateSkill } from "../core/skill.js";
import { getSkillsDir } from "../utils/paths.js";
import * as print from "../utils/print.js";
export async function addAction(pathArg, options) {
    const registry = readRegistry();
    if (options.all) {
        return addAllSkills(registry);
    }
    if (!pathArg) {
        print.error("Please specify a skill path or use --all to scan ~/.claude/skills/");
        process.exit(1);
    }
    const resolved = path.resolve(pathArg);
    addSingleSkill(registry, resolved);
}
function addSingleSkill(registry, skillPath) {
    if (!fs.existsSync(skillPath)) {
        print.error(`Path not found: ${skillPath}`);
        process.exit(1);
    }
    const parsed = parseSkillFile(skillPath);
    if (!parsed) {
        print.error(`No SKILL.md or skill.md found in ${skillPath}`);
        process.exit(1);
    }
    const warnings = validateSkill(parsed.meta, skillPath);
    for (const w of warnings) {
        print.warn(w);
    }
    const existing = findSkill(registry, parsed.meta.name);
    if (existing) {
        print.info(`Skill "${parsed.meta.name}" already registered — updating path.`);
    }
    const entry = {
        name: parsed.meta.name,
        path: skillPath,
        active: existing?.active ?? false,
        scope: parsed.meta.scope || "global",
        pinned_version: null,
        source: "local",
        added_at: existing?.added_at || new Date().toISOString(),
    };
    addSkill(registry, entry);
    writeRegistry(registry);
    if (existing) {
        print.success(`Updated "${parsed.meta.name}".`);
    }
    else {
        print.success(`Added "${parsed.meta.name}" (inactive). Run 'claude-skills enable ${parsed.meta.name}' to activate.`);
    }
}
function addAllSkills(registry) {
    const skillsDir = getSkillsDir();
    if (!fs.existsSync(skillsDir)) {
        print.error(`Skills directory not found: ${skillsDir}`);
        process.exit(1);
    }
    const dirs = fs
        .readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => path.join(skillsDir, d.name));
    let added = 0;
    let updated = 0;
    let skipped = 0;
    for (const dir of dirs) {
        const parsed = parseSkillFile(dir);
        if (!parsed) {
            skipped++;
            continue;
        }
        const existing = findSkill(registry, parsed.meta.name);
        const entry = {
            name: parsed.meta.name,
            path: dir,
            active: existing?.active ?? false,
            scope: parsed.meta.scope || "global",
            pinned_version: null,
            source: "local",
            added_at: existing?.added_at || new Date().toISOString(),
        };
        addSkill(registry, entry);
        if (existing) {
            updated++;
        }
        else {
            added++;
        }
    }
    writeRegistry(registry);
    print.success(`Scanned ${dirs.length} directories: ${added} added, ${updated} updated, ${skipped} skipped.`);
}
//# sourceMappingURL=add.js.map