import { ParsedSkill } from "./skill.js";
export declare function syncCommands(skills: ParsedSkill[], options?: {
    dryRun?: boolean;
}): {
    created: string[];
    removed: string[];
};
