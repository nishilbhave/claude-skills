import fs from "node:fs";
import fse from "fs-extra";
import path from "node:path";
import { getCommandsDir } from "../utils/paths.js";
import { ParsedSkill } from "./skill.js";

const MARKER_PREFIX = "<!-- claude-skills:managed -->";

function buildCommandFile(skill: ParsedSkill): string {
  return `${MARKER_PREFIX}
# ${skill.meta.name}

${skill.content}
`;
}

export function syncCommands(skills: ParsedSkill[]): {
  created: string[];
  removed: string[];
} {
  const commandsDir = getCommandsDir();
  fse.ensureDirSync(commandsDir);

  const created: string[] = [];
  const removed: string[] = [];

  // Write command files for active skills
  const activeNames = new Set<string>();
  for (const skill of skills) {
    const name = skill.meta.command || skill.meta.name;
    activeNames.add(name);
    const filePath = path.join(commandsDir, `${name}.md`);
    const content = buildCommandFile(skill);
    fs.writeFileSync(filePath, content, "utf-8");
    created.push(name);
  }

  // Remove managed command files for inactive skills
  if (fs.existsSync(commandsDir)) {
    const files = fs.readdirSync(commandsDir);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const name = file.replace(/\.md$/, "");
      if (activeNames.has(name)) continue;

      const filePath = path.join(commandsDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      // Only remove files we manage (have our marker)
      if (content.startsWith(MARKER_PREFIX)) {
        fs.unlinkSync(filePath);
        removed.push(name);
      }
    }
  }

  return { created, removed };
}
