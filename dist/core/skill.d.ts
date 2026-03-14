export interface SkillMeta {
    name: string;
    version: string;
    description: string;
    author?: string;
    command?: string;
    tags?: string[];
    group?: string;
    scope?: string;
    conflicts?: string[];
    requires?: string[];
    userInvokable?: boolean;
    allowedTools?: string[];
}
export interface ParsedSkill {
    meta: SkillMeta;
    content: string;
    filePath: string;
    dirPath: string;
}
export declare function parseSkillFile(skillDir: string): ParsedSkill | null;
export declare function validateSkill(meta: SkillMeta, dirPath: string): string[];
