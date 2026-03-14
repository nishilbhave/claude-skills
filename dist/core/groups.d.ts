export declare function createGroup(name: string, skillNames?: string[]): void;
export declare function addSkillToGroup(groupName: string, skillName: string): void;
export declare function removeSkillFromGroup(groupName: string, skillName: string): void;
export declare function getAllGroups(): Record<string, string[]>;
export declare function getGroupsForSkill(skillName: string): string[];
