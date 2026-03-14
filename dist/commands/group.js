import { readRegistry, writeRegistry, findSkill, setActive, } from "../core/registry.js";
import { createGroup, addSkillToGroup, removeSkillFromGroup, getAllGroups, } from "../core/groups.js";
import { syncAction } from "./sync.js";
import * as print from "../utils/print.js";
export async function groupCreateAction(name, options) {
    const skillNames = options.skills
        ? options.skills.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
    // Validate skills exist in registry
    if (skillNames?.length) {
        const registry = readRegistry();
        for (const sn of skillNames) {
            if (!findSkill(registry, sn)) {
                print.warn(`Skill "${sn}" not found in registry.`);
            }
        }
    }
    try {
        createGroup(name, skillNames);
        print.success(`Created group "${name}"${skillNames?.length ? ` with ${skillNames.length} skill(s).` : "."}`);
    }
    catch (err) {
        print.error(err.message);
        process.exit(1);
    }
}
export async function groupEnableAction(name) {
    const groups = getAllGroups();
    if (!groups[name]) {
        print.error(`Group "${name}" does not exist.`);
        process.exit(1);
    }
    const registry = readRegistry();
    let enabled = 0;
    for (const skillName of groups[name]) {
        const entry = findSkill(registry, skillName);
        if (!entry) {
            print.warn(`Skill "${skillName}" in group "${name}" not found in registry — skipping.`);
            continue;
        }
        if (!entry.active) {
            setActive(registry, skillName, true);
            enabled++;
        }
    }
    writeRegistry(registry);
    print.success(`Enabled ${enabled} skill(s) in group "${name}".`);
    await syncAction();
}
export async function groupDisableAction(name) {
    const groups = getAllGroups();
    if (!groups[name]) {
        print.error(`Group "${name}" does not exist.`);
        process.exit(1);
    }
    const registry = readRegistry();
    let disabled = 0;
    for (const skillName of groups[name]) {
        const entry = findSkill(registry, skillName);
        if (!entry)
            continue;
        if (entry.active) {
            setActive(registry, skillName, false);
            disabled++;
        }
    }
    writeRegistry(registry);
    print.success(`Disabled ${disabled} skill(s) in group "${name}".`);
    await syncAction();
}
export async function groupListAction() {
    const groups = getAllGroups();
    const groupNames = Object.keys(groups);
    if (groupNames.length === 0) {
        print.info("No groups defined. Use 'claude-skills group create <name>' to create one.");
        return;
    }
    const registry = readRegistry();
    console.log("");
    for (const gName of groupNames) {
        const skills = groups[gName];
        const activeCount = skills.filter((s) => {
            const entry = findSkill(registry, s);
            return entry?.active ?? false;
        }).length;
        console.log(`  ${print.bold(gName)} (${skills.length} skill${skills.length !== 1 ? "s" : ""}, ${activeCount} active)`);
        const rows = [];
        for (const sn of skills) {
            const entry = findSkill(registry, sn);
            const status = entry?.active ? "✓" : "✗";
            rows.push([`    ${status}`, sn]);
        }
        print.table(rows);
        console.log("");
    }
}
export async function groupAddAction(group, skill) {
    const registry = readRegistry();
    if (!findSkill(registry, skill)) {
        print.warn(`Skill "${skill}" not found in registry.`);
    }
    addSkillToGroup(group, skill);
    print.success(`Added "${skill}" to group "${group}".`);
}
export async function groupRemoveAction(group, skill) {
    try {
        removeSkillFromGroup(group, skill);
        print.success(`Removed "${skill}" from group "${group}".`);
    }
    catch (err) {
        print.error(err.message);
        process.exit(1);
    }
}
export async function groupOnlyAction(name) {
    const groups = getAllGroups();
    if (!groups[name]) {
        print.error(`Group "${name}" does not exist.`);
        process.exit(1);
    }
    const registry = readRegistry();
    const groupSkills = new Set(groups[name]);
    // Disable all skills
    for (const entry of registry.skills) {
        entry.active = false;
    }
    // Enable only group members
    let enabled = 0;
    for (const skillName of groupSkills) {
        const entry = findSkill(registry, skillName);
        if (entry) {
            entry.active = true;
            enabled++;
        }
        else {
            print.warn(`Skill "${skillName}" in group "${name}" not found in registry — skipping.`);
        }
    }
    writeRegistry(registry);
    print.success(`Activated only group "${name}": ${enabled} skill(s) enabled, all others disabled.`);
    await syncAction();
}
//# sourceMappingURL=group.js.map