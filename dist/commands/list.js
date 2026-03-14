import { readRegistry } from "../core/registry.js";
import { resolveRegistries } from "../core/resolver.js";
import { parseSkillFile } from "../core/skill.js";
import { getProjectRegistryPath } from "../utils/paths.js";
import * as print from "../utils/print.js";
function filterSkills(skills, options) {
    if (options.active)
        return skills.filter((s) => s.active);
    if (options.inactive)
        return skills.filter((s) => !s.active);
    return skills;
}
function sortSkills(skills) {
    return [...skills].sort((a, b) => {
        if (a.active !== b.active)
            return a.active ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
}
function printSection(label, skills) {
    console.log(print.bold(`${label} (${skills.length} skill${skills.length !== 1 ? "s" : ""})`));
    const rows = [];
    for (const entry of skills) {
        const status = entry.active ? "✓" : "✗";
        const parsed = parseSkillFile(entry.path);
        const version = parsed?.meta.version || "—";
        const desc = parsed?.meta.description?.replace(/\n/g, " ").slice(0, 60) || "—";
        rows.push([`  ${status}`, entry.name, version, desc]);
    }
    print.table(rows);
}
export async function listAction(options) {
    // If scoped to global only
    if (options.global) {
        const registry = readRegistry();
        const skills = sortSkills(filterSkills(registry.skills, options));
        if (skills.length === 0) {
            print.info("No skills registered.");
            return;
        }
        if (options.json) {
            console.log(JSON.stringify(skills, null, 2));
            return;
        }
        console.log("");
        printSection("GLOBAL", skills);
        console.log("");
        return;
    }
    // If scoped to project only
    if (options.project) {
        const projectPath = getProjectRegistryPath();
        if (!projectPath) {
            print.info("No project registry found in current directory tree.");
            return;
        }
        const registry = readRegistry(projectPath);
        const skills = sortSkills(filterSkills(registry.skills, options));
        if (skills.length === 0) {
            print.info("No skills in project registry.");
            return;
        }
        if (options.json) {
            console.log(JSON.stringify(skills, null, 2));
            return;
        }
        console.log("");
        printSection("PROJECT", skills);
        console.log("");
        return;
    }
    // Default: show both
    const { global, project } = resolveRegistries();
    if (options.json) {
        const result = {
            global: filterSkills(global.skills, options),
        };
        if (project) {
            result.project = filterSkills(project.skills, options);
        }
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    const globalSkills = sortSkills(filterSkills(global.skills, options));
    const projectSkills = project
        ? sortSkills(filterSkills(project.skills, options))
        : null;
    if (globalSkills.length === 0 && (!projectSkills || projectSkills.length === 0)) {
        print.info("No skills registered. Run 'claude-skills add --all' to scan ~/.claude/skills/");
        return;
    }
    console.log("");
    if (globalSkills.length > 0) {
        printSection("GLOBAL", globalSkills);
        console.log("");
    }
    if (projectSkills && projectSkills.length > 0) {
        printSection("PROJECT", projectSkills);
        console.log("");
    }
}
//# sourceMappingURL=list.js.map