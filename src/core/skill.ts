import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { getSkillFilePath } from "../utils/paths.js";

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

function extractFirstHeadingOrParagraph(content: string): string {
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

export function parseSkillFile(skillDir: string): ParsedSkill | null {
  const filePath = getSkillFilePath(skillDir);
  if (!filePath) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const dirName = path.basename(skillDir);

  // Check for frontmatter
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (fmMatch) {
    const yamlStr = fmMatch[1];
    const body = fmMatch[2];

    try {
      const parsed = yaml.load(yamlStr) as Record<string, unknown>;
      const meta: SkillMeta = {
        name: (parsed.name as string) || dirName,
        version:
          (parsed.version as string) ||
          (parsed.metadata as Record<string, unknown>)?.version as string ||
          "0.0.0",
        description: (parsed.description as string) || extractFirstHeadingOrParagraph(body),
        author:
          (parsed.author as string) ||
          ((parsed.metadata as Record<string, unknown>)?.author as string) ||
          undefined,
        command: (parsed.command as string) || undefined,
        tags: (parsed.tags as string[]) || undefined,
        group: (parsed.group as string) || undefined,
        scope: (parsed.scope as string) || undefined,
        conflicts: (parsed.conflicts as string[]) || undefined,
        requires: (parsed.requires as string[]) || undefined,
        userInvokable: parsed["user-invokable"] !== undefined
          ? Boolean(parsed["user-invokable"])
          : undefined,
        allowedTools: (parsed["allowed-tools"] as string[]) || undefined,
      };

      return { meta, content: body.trim(), filePath, dirPath: skillDir };
    } catch {
      // YAML parse failed, treat as no frontmatter
    }
  }

  // No frontmatter
  const meta: SkillMeta = {
    name: dirName,
    version: "0.0.0",
    description: extractFirstHeadingOrParagraph(raw),
    author: undefined,
  };

  return { meta, content: raw.trim(), filePath, dirPath: skillDir };
}

export function validateSkill(meta: SkillMeta, dirPath: string): string[] {
  const warnings: string[] = [];
  const dirName = path.basename(dirPath);

  if (meta.name !== dirName) {
    warnings.push(
      `Skill name "${meta.name}" does not match directory name "${dirName}"`
    );
  }

  if (!meta.description || meta.description === "No description") {
    warnings.push("Missing description");
  }

  return warnings;
}
