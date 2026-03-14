import { readConfig, writeConfig } from "./config.js";

export function createGroup(name: string, skillNames?: string[]): void {
  const config = readConfig();
  if (config.groups[name]) {
    throw new Error(`Group "${name}" already exists.`);
  }
  config.groups[name] = skillNames || [];
  writeConfig(config);
}

export function addSkillToGroup(groupName: string, skillName: string): void {
  const config = readConfig();
  if (!config.groups[groupName]) {
    config.groups[groupName] = [];
  }
  if (!config.groups[groupName].includes(skillName)) {
    config.groups[groupName].push(skillName);
  }
  writeConfig(config);
}

export function removeSkillFromGroup(
  groupName: string,
  skillName: string
): void {
  const config = readConfig();
  if (!config.groups[groupName]) {
    throw new Error(`Group "${groupName}" does not exist.`);
  }
  config.groups[groupName] = config.groups[groupName].filter(
    (s) => s !== skillName
  );
  writeConfig(config);
}

export function getAllGroups(): Record<string, string[]> {
  const config = readConfig();
  return config.groups;
}

export function getGroupsForSkill(skillName: string): string[] {
  const config = readConfig();
  return Object.entries(config.groups)
    .filter(([, skills]) => skills.includes(skillName))
    .map(([name]) => name);
}
