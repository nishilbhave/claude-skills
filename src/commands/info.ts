import { readRegistry, findSkill } from "../core/registry.js";
import { parseSkillFile } from "../core/skill.js";
import * as print from "../utils/print.js";

export async function infoAction(name: string): Promise<void> {
  const registry = readRegistry();
  const entry = findSkill(registry, name);

  if (!entry) {
    print.error(`Skill "${name}" not found in registry.`);
    process.exit(1);
  }

  const parsed = parseSkillFile(entry.path);
  if (!parsed) {
    print.error(`Skill file not found at ${entry.path}`);
    process.exit(1);
  }

  const { meta } = parsed;

  console.log("");
  console.log(`  ${print.bold("name:")}       ${meta.name}`);
  console.log(`  ${print.bold("version:")}    ${meta.version}`);
  console.log(`  ${print.bold("path:")}       ${entry.path}`);
  console.log(`  ${print.bold("active:")}     ${entry.active ? "yes" : "no"}`);
  console.log(`  ${print.bold("scope:")}      ${entry.scope}`);
  if (meta.command) console.log(`  ${print.bold("command:")}    /${meta.command}`);
  if (meta.author) console.log(`  ${print.bold("author:")}     ${meta.author}`);
  if (meta.tags?.length) console.log(`  ${print.bold("tags:")}       ${meta.tags.join(", ")}`);
  if (meta.description) {
    console.log(`  ${print.bold("description:")} ${meta.description.replace(/\n/g, " ").slice(0, 200)}`);
  }
  if (entry.pinned_version) {
    console.log(`  ${print.bold("pinned:")}     ${entry.pinned_version}`);
  }
  console.log(`  ${print.bold("added:")}      ${entry.added_at.slice(0, 10)}`);
  console.log(`  ${print.bold("source:")}     ${entry.source}`);
  if (entry.source.startsWith("plugin:")) {
    const pluginId = entry.source.slice("plugin:".length);
    console.log(`  ${print.bold("plugin:")}     ${pluginId}`);
  }

  const contentKb = Math.round(Buffer.byteLength(parsed.content, "utf-8") / 1024 * 10) / 10;
  console.log(`  ${print.bold("size:")}       ${contentKb}KB`);
  console.log("");
}
