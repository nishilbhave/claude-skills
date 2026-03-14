# claude-skills

CLI tool to manage [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skills. Register, enable/disable, and sync skills into `CLAUDE.md` and `.claude/commands/` so Claude Code can discover them automatically.

## The Problem

Claude Code only loads skills wired into `~/.claude/CLAUDE.md` or `.claude/commands/*.md`. With 30+ skills, you're manually editing files and bloating your context window with instructions irrelevant to the current task.

`claude-skills` maintains a registry, supports enable/disable toggling, and regenerates the required files via a `sync` command.

## Install

```bash
npm install -g claude-skills
```

Or clone and link locally:

```bash
git clone https://github.com/nishil/claude-skills.git
cd claude-skills
npm install && npm run build
npm link
```

Requires Node.js 18+.

## Quick Start

```bash
# Register all skills from ~/.claude/skills/
claude-skills add --all

# Activate a skill (auto-syncs CLAUDE.md + creates slash command)
claude-skills enable resume-tailor

# Or add + enable + sync in one step
claude-skills install ~/.claude/skills/resume-tailor

# See what's registered
claude-skills list

# Deactivate a skill
claude-skills disable resume-tailor
```

## Commands

### `claude-skills add [path]`

Register a skill into the registry (inactive by default).

```bash
claude-skills add ~/.claude/skills/my-skill
claude-skills add --all    # scan ~/.claude/skills/ and register everything
```

### `claude-skills install [path]`

Shorthand for `add` + `enable` + `sync` in one step.

```bash
claude-skills install ~/.claude/skills/my-skill
claude-skills install --all
```

### `claude-skills enable <name>`

Activate a registered skill. Runs `sync` automatically.

### `claude-skills disable <name>`

Deactivate a skill. Runs `sync` automatically.

### `claude-skills list`

List all registered skills with status.

```
GLOBAL (30 skills)
  ✓  resume-tailor    0.0.0   Tailor a resume to a specific job description
  ✗  blog             1.3.1   Full-lifecycle blog engine with 12 commands
  ✗  market           0.0.0   AI Marketing Suite — Main Orchestrator
```

Flags: `--active`, `--inactive`, `--json`

### `claude-skills sync`

Regenerate `~/.claude/CLAUDE.md` and `~/.claude/commands/` from active skills. This is called automatically by `enable`/`disable` when `auto_sync` is on.

### `claude-skills info <name>`

Show full metadata for a registered skill.

```
  name:        resume-tailor
  version:     0.0.0
  path:        ~/.claude/skills/resume-tailor
  active:      yes
  size:        10.9KB
```

### `claude-skills init`

Create a new skill interactively with proper `SKILL.md` frontmatter.

## How It Works

### Registry

`~/.claude/skills.json` tracks all registered skills with their paths and active/inactive status. The registry is an index — skill content always lives in the skill directory.

### Sync

When you run `sync` (or enable/disable with `auto_sync: true`):

1. Reads all active skills from the registry
2. Parses each skill's `SKILL.md` frontmatter + content
3. Checks the context budget (warns at 50KB, blocks at 100KB)
4. Backs up existing `CLAUDE.md` (rotates last 5 backups)
5. Injects skill content into `CLAUDE.md` between managed markers
6. Generates `.claude/commands/<name>.md` for each active skill

Content outside the `<!-- claude-skills:begin -->` / `<!-- claude-skills:end -->` markers is preserved.

### Injection Modes

Configured in `~/.claude/skills-config.json`:

- **`full`** (default) — embeds complete skill content into `CLAUDE.md`. Best for 1-9 active skills.
- **`catalog`** — embeds only a table of skill names + descriptions (~2KB total). Full content stays in `.claude/commands/` and loads on-demand via slash commands. Best for 10+ active skills.

### Skill Format

Skills are directories containing a `SKILL.md` (or `skill.md`) file. Three frontmatter patterns are supported:

**Full frontmatter:**
```yaml
---
name: my-skill
description: What this skill does
version: 1.0.0
command: my-skill
tags: [dev, tools]
metadata:
  author: yourname
---
```

**Minimal frontmatter:**
```yaml
---
name: my-skill
description: What this skill does
---
```

**No frontmatter:** Name is derived from the directory, description from the first heading.

### Context Budget

`sync` tracks total injected content size:

| Level | Threshold | Behavior |
|-------|-----------|----------|
| Green | < 50KB | No warnings |
| Yellow | 50-100KB | Suggests catalog mode |
| Red | > 100KB | Warns, recommends catalog mode |

### Backups

`CLAUDE.md` is backed up before every sync to `~/.claude/skills-backup/`. The last 5 backups are kept as `CLAUDE.md.{1-5}.bak` with 1 being the most recent.

## Configuration

`~/.claude/skills-config.json`:

```json
{
  "inject_mode": "full",
  "context_budget_kb": 100,
  "auto_sync": true,
  "backup_count": 5
}
```

Created automatically with defaults on first use.

## Development

```bash
npm install
npm run build        # compile TypeScript
npm test             # run tests
npm run dev -- list  # run CLI directly via tsx
```

## Project Structure

```
src/
  cli.ts              # Commander entry point
  commands/            # CLI command handlers
    add.ts, install.ts, enable.ts, disable.ts,
    list.ts, sync.ts, init.ts, info.ts
  core/                # Business logic
    skill.ts           # SKILL.md parser (3 frontmatter patterns)
    registry.ts        # skills.json CRUD
    config.ts          # skills-config.json
    inject.ts          # CLAUDE.md managed block injection
    commands.ts        # .claude/commands/ stub generation
    backup.ts          # CLAUDE.md backup rotation
    budget.ts          # Context budget calculation
  utils/
    paths.ts           # Path resolution
    print.ts           # Terminal output formatting
tests/
  skill.test.ts, registry.test.ts, inject.test.ts, sync.test.ts
```

## Roadmap

- **Phase 1:** Skill groups, project scope, `--dry-run`, `doctor` command
- **Phase 2:** Git/remote skill sources, `pinned_version`
- **Phase 3:** Community registry via GitHub

## License

MIT
