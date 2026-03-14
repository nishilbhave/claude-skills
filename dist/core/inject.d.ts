import { ParsedSkill } from "./skill.js";
export declare function injectSkills(existingContent: string, skills: ParsedSkill[], mode: "full" | "catalog" | "summary" | "reference"): string;
export declare function removeBlock(content: string): string;
