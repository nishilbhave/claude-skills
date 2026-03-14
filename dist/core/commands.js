import fs from "node:fs";
import fse from "fs-extra";
import path from "node:path";
import { getCommandsDir } from "../utils/paths.js";
const MARKER_PREFIX = "<!-- claude-skills:managed -->";
function buildCommandFile(skill) {
    return `${MARKER_PREFIX}
# ${skill.meta.name}

${skill.content}
`;
}
export function syncCommands(skills, options) {
    const commandsDir = getCommandsDir();
    const created = [];
    const removed = [];
    const activeNames = new Set();
    for (const skill of skills) {
        const name = skill.meta.command || skill.meta.name;
        activeNames.add(name);
        created.push(name);
        if (!options?.dryRun) {
            fse.ensureDirSync(commandsDir);
            const filePath = path.join(commandsDir, `${name}.md`);
            const content = buildCommandFile(skill);
            fs.writeFileSync(filePath, content, "utf-8");
        }
    }
    // Find managed command files to remove
    if (fs.existsSync(commandsDir)) {
        const files = fs.readdirSync(commandsDir);
        for (const file of files) {
            if (!file.endsWith(".md"))
                continue;
            const name = file.replace(/\.md$/, "");
            if (activeNames.has(name))
                continue;
            const filePath = path.join(commandsDir, file);
            const content = fs.readFileSync(filePath, "utf-8");
            if (content.startsWith(MARKER_PREFIX)) {
                if (!options?.dryRun) {
                    fs.unlinkSync(filePath);
                }
                removed.push(name);
            }
        }
    }
    return { created, removed };
}
//# sourceMappingURL=commands.js.map