import { readConfig, writeConfig } from "./config.js";
export function createGroup(name, skillNames) {
    const config = readConfig();
    if (config.groups[name]) {
        throw new Error(`Group "${name}" already exists.`);
    }
    config.groups[name] = skillNames || [];
    writeConfig(config);
}
export function addSkillToGroup(groupName, skillName) {
    const config = readConfig();
    if (!config.groups[groupName]) {
        config.groups[groupName] = [];
    }
    if (!config.groups[groupName].includes(skillName)) {
        config.groups[groupName].push(skillName);
    }
    writeConfig(config);
}
export function removeSkillFromGroup(groupName, skillName) {
    const config = readConfig();
    if (!config.groups[groupName]) {
        throw new Error(`Group "${groupName}" does not exist.`);
    }
    config.groups[groupName] = config.groups[groupName].filter((s) => s !== skillName);
    writeConfig(config);
}
export function getAllGroups() {
    const config = readConfig();
    return config.groups;
}
export function getGroupsForSkill(skillName) {
    const config = readConfig();
    return Object.entries(config.groups)
        .filter(([, skills]) => skills.includes(skillName))
        .map(([name]) => name);
}
//# sourceMappingURL=groups.js.map