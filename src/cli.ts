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
import { restoreAction } from "./commands/restore.js";
import { doctorAction } from "./commands/doctor.js";
import { updateAction } from "./commands/update.js";
import {
  groupCreateAction,
  groupEnableAction,
  groupDisableAction,
  groupListAction,
  groupAddAction,
  groupRemoveAction,
  groupOnlyAction,
} from "./commands/group.js";
import {
  profileExportAction,
  profileImportAction,
} from "./commands/profile.js";

const program = new Command();

program
  .name("claude-skills")
  .description("CLI tool to manage Claude Code skills")
  .version("0.2.0");

program
  .command("add [path]")
  .description("Register a skill into the registry (inactive by default)")
  .option("--all", "Scan ~/.claude/skills/ and register all found skills")
  .option("--pin <version>", "Pin to a specific git tag (remote skills only)")
  .option("-g, --global", "Target global registry")
  .option("-p, --project", "Target project registry")
  .action(addAction);

program
  .command("install [path]")
  .description("Add, enable, and sync a skill in one step")
  .option("--all", "Install all skills from ~/.claude/skills/")
  .option("--pin <version>", "Pin to a specific git tag (remote skills only)")
  .option("-g, --global", "Target global registry")
  .option("-p, --project", "Target project registry")
  .action(installAction);

program
  .command("enable <name>")
  .description("Activate a registered skill")
  .option("-g, --global", "Target global registry")
  .option("-p, --project", "Target project registry")
  .action(enableAction);

program
  .command("disable <name>")
  .description("Deactivate a skill")
  .option("-g, --global", "Target global registry")
  .option("-p, --project", "Target project registry")
  .action(disableAction);

program
  .command("list")
  .description("List all registered skills")
  .option("--active", "Show only active skills")
  .option("--inactive", "Show only inactive skills")
  .option("--json", "Output as JSON")
  .option("-g, --global", "Show only global skills")
  .option("-p, --project", "Show only project skills")
  .action(listAction);

program
  .command("sync")
  .description("Regenerate CLAUDE.md and commands from active skills")
  .option("--dry-run", "Show what would change without writing files")
  .option("-g, --global", "Target global registry")
  .option("-p, --project", "Target project registry")
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

program
  .command("restore")
  .description("Restore CLAUDE.md from the most recent backup")
  .action(restoreAction);

program
  .command("doctor")
  .description("Run diagnostic checks on your skills setup")
  .action(doctorAction);

program
  .command("update [name]")
  .description("Update remote skills to latest version or a specific tag")
  .option("--all", "Update all remote skills")
  .option("--pin <version>", "Pin to a specific git tag, or 'latest' to unpin")
  .action(updateAction);

// Group commands
const group = program
  .command("group")
  .description("Manage skill groups");

group
  .command("create <name>")
  .description("Create a new group")
  .option("--skills <skills>", "Comma-separated list of skills to include")
  .action(groupCreateAction);

group
  .command("enable <name>")
  .description("Enable all skills in a group")
  .action(groupEnableAction);

group
  .command("disable <name>")
  .description("Disable all skills in a group")
  .action(groupDisableAction);

group
  .command("list")
  .description("List all groups and their skills")
  .action(groupListAction);

group
  .command("add <group> <skill>")
  .description("Add a skill to a group")
  .action(groupAddAction);

group
  .command("remove <group> <skill>")
  .description("Remove a skill from a group")
  .action(groupRemoveAction);

group
  .command("only <name>")
  .description("Enable only the skills in this group, disable all others")
  .action(groupOnlyAction);

// Profile commands
const profile = program
  .command("profile")
  .description("Export and import skill profiles");

profile
  .command("export [name]")
  .description("Export current skill configuration to stdout as JSON")
  .action(profileExportAction);

profile
  .command("import <file>")
  .description("Import a skill profile from a JSON file")
  .action(profileImportAction);

program.parse();
