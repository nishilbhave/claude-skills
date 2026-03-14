import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { getSkillFilePath } from "../utils/paths.js";
function extractFirstHeadingOrParagraph(content) {
    const lines = content.split("\n").filter((l) => l.trim());
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("#")) {
            return trimmed.replace(/^#+\s*/, "");
        }
        if (trimmed.length > 10) {
            return trimmed.slice(0, 120);
        }
    }
    return "No description";
}
export function parseSkillFile(skillDir) {
    const filePath = getSkillFilePath(skillDir);
    if (!filePath)
        return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    const dirName = path.basename(skillDir);
    // Check for frontmatter
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (fmMatch) {
        const yamlStr = fmMatch[1];
        const body = fmMatch[2];
        try {
            const parsed = yaml.load(yamlStr);
            const meta = {
                name: parsed.name || dirName,
                version: parsed.version ||
                    parsed.metadata?.version ||
                    "0.0.0",
                description: parsed.description || extractFirstHeadingOrParagraph(body),
                author: parsed.author ||
                    parsed.metadata?.author ||
                    undefined,
                command: parsed.command || undefined,
                tags: parsed.tags || undefined,
                group: parsed.group || undefined,
                scope: parsed.scope || undefined,
                conflicts: parsed.conflicts || undefined,
                requires: parsed.requires || undefined,
                userInvokable: parsed["user-invokable"] !== undefined
                    ? Boolean(parsed["user-invokable"])
                    : undefined,
                allowedTools: parsed["allowed-tools"] || undefined,
            };
            return { meta, content: body.trim(), filePath, dirPath: skillDir };
        }
        catch {
            // YAML parse failed, treat as no frontmatter
        }
    }
    // No frontmatter
    const meta = {
        name: dirName,
        version: "0.0.0",
        description: extractFirstHeadingOrParagraph(raw),
        author: undefined,
    };
    return { meta, content: raw.trim(), filePath, dirPath: skillDir };
}
export function validateSkill(meta, dirPath) {
    const warnings = [];
    const dirName = path.basename(dirPath);
    if (meta.name !== dirName) {
        warnings.push(`Skill name "${meta.name}" does not match directory name "${dirName}"`);
    }
    if (!meta.description || meta.description === "No description") {
        warnings.push("Missing description");
    }
    return warnings;
}
//# sourceMappingURL=skill.js.map