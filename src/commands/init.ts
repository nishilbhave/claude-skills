import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import fse from "fs-extra";
import { getSkillsDir } from "../utils/paths.js";
import * as print from "../utils/print.js";

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

export async function initAction(options: { install?: boolean }): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("");
    const name = await ask(rl, "  Skill name (slug, no spaces): ");
    if (!name) {
      print.error("Name is required.");
      return;
    }

    const description = await ask(rl, "  Description: ");
    const version = (await ask(rl, "  Version [0.1.0]: ")) || "0.1.0";
    const command = await ask(rl, `  Create slash command? Name [${name}] or empty to skip: `);

    const skillDir = path.join(getSkillsDir(), name);
    if (fs.existsSync(skillDir)) {
      print.error(`Directory already exists: ${skillDir}`);
      return;
    }

    fse.ensureDirSync(skillDir);

    const frontmatter = [
      "---",
      `name: ${name}`,
      `description: ${description || "TODO: Add description"}`,
      `version: ${version}`,
    ];

    if (command) {
      frontmatter.push(`command: ${command || name}`);
    }

    frontmatter.push("---");

    const content = `${frontmatter.join("\n")}

# ${name}

TODO: Add skill instructions here.
`;

    fs.writeFileSync(path.join(skillDir, "SKILL.md"), content, "utf-8");

    print.success(`Created ${skillDir}/SKILL.md`);

    if (options.install) {
      print.info(
        "Use 'claude-skills install' to register and activate this skill."
      );
    } else {
      print.info(
        `Run 'claude-skills install ${skillDir}' to register and activate.`
      );
    }
    console.log("");
  } finally {
    rl.close();
  }
}
