import { ParsedSkill } from "./skill.js";
export declare function syncCommands(skills: ParsedSkill[]): {
    created: string[];
    removed: string[];
};
