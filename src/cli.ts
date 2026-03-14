#!/usr/bin/env node

import { Command } from "commander";
import { addAction } from "./commands/add.js";
import { installAction } from "./commands/install.js";
import { enableAction } from "./commands/enable.js";
import { disableAction } from "./commands/disable.js";
import { listAction } from "./commands/list.js";
import { syncAction } from "./commands/sync.js";
import { initAction } from "./commands/init.js";
import { infoAction } from "./commands/info.js";

const program = new Command();

program
  .name("claude-skills")
  .description("CLI tool to manage Claude Code skills")
  .version("0.1.0");

program
  .command("add [path]")
  .description("Register a skill into the registry (inactive by default)")
  .option("--all", "Scan ~/.claude/skills/ and register all found skills")
  .action(addAction);

program
  .command("install [path]")
  .description("Add, enable, and sync a skill in one step")
  .option("--all", "Install all skills from ~/.claude/skills/")
  .action(installAction);

program
  .command("enable <name>")
  .description("Activate a registered skill")
  .action(enableAction);

program
  .command("disable <name>")
  .description("Deactivate a skill")
  .action(disableAction);

program
  .command("list")
  .description("List all registered skills")
  .option("--active", "Show only active skills")
  .option("--inactive", "Show only inactive skills")
  .option("--json", "Output as JSON")
  .action(listAction);

program
  .command("sync")
  .description("Regenerate CLAUDE.md and commands from active skills")
  .action(syncAction);

program
  .command("init")
  .description("Create a new skill interactively")
  .option("--install", "Also register and activate after creation")
  .action(initAction);

program
  .command("info <name>")
  .description("Show full metadata for a skill")
  .action(infoAction);

program.parse();
