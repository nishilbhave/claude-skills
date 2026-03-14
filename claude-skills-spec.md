# claude-skills — Technical Specification

> CLI tool to manage Claude Code skills across global and project scopes.

---

## 1. Problem Statement

Claude Code only loads skills if they're wired into:
- `~/.claude/CLAUDE.md` (global context)
- `.claude/commands/*.md` (slash commands)
- `./CLAUDE.md` in project root

There is no discovery, activation toggle, versioning, or conflict detection. With 10+ skills, you're manually grepping files and copy-pasting blocks. The skill doesn't show in the terminal because nothing told Claude Code it exists.

Beyond wiring, **skill blast** is the real pain at scale. When you accumulate 30-50+ skills, even if they're individually well-authored, the result is a bloated CLAUDE.md that wastes context window on instructions irrelevant to the current task. You need a way to group skills by workflow and switch entire contexts — not toggle 50 individual flags.

`claude-skills` solves this by maintaining a registry, supporting skill groups for context switching, and regenerating the required files via a `sync` command.

### Platform Risk

Anthropic is actively developing Claude Code and native skill management is a likely future feature. This project is positioned as:
- A stopgap tool that delivers value today
- A reference implementation that could inform official approaches
- Lightweight by design — easy to migrate away from if native support lands

Ship fast, stay minimal, don't over-invest in infrastructure (registries, hosting) that Anthropic would own.

---

## 2. Core Concepts

### Scope
Two scopes, resolved in order (project overrides global):

| Scope | Registry location | Affects |
|---|---|---|
| `global` | `~/.claude/skills.json` | All Claude Code sessions |
| `project` | `.claude/skills.json` | Current project only |

### Skill
A skill is a directory containing at minimum a `skill.md` file. The directory is the canonical source — the registry just indexes it.

### Group
A group is a named collection of skills that can be enabled/disabled as a unit. Groups solve the "skill blast" problem — instead of toggling 15 individual marketing skills, you toggle one `marketing` group. Groups are stored in the config file.

### Sync
`sync` is the core operation. It reads the registry, collects all active skills for the current scope, and writes:
1. Skill content injected into `CLAUDE.md` (global or project)
2. Stub `.claude/commands/<skill-name>.md` for each active skill with a `command` key
3. Backs up `CLAUDE.md` to `~/.claude/skills-backup/` before writing (keeps last 5 backups)

Claude Code reads both of these at startup. After `sync`, skills are visible.

---

## 3. File System Layout

```
~/.claude/
  skills/                     ← global skill store
    resume-tailor/
      skill.md
    seo-audit/
      skill.md
    mcp-builder/
      skill.md
  skills.json                 ← global registry
  CLAUDE.md                   ← auto-generated (DO NOT EDIT MANUALLY)

<project-root>/
  .claude/
    skills.json               ← project registry (optional)
    commands/
      resume-tailor.md        ← auto-generated stub
      seo-audit.md
    CLAUDE.md                 ← project-level auto-generated (optional)
  CLAUDE.md                   ← project root (merged at sync)
```

> `.claude/commands/` and `CLAUDE.md` blocks marked with `<!-- claude-skills:begin -->` / `<!-- claude-skills:end -->` are managed. Everything outside those markers is preserved.

---

## 4. Skill Format

### Directory structure
```
my-skill/
  skill.md          ← required
  examples/         ← optional, referenced in skill.md
  tests/            ← optional
```

### `skill.md` frontmatter (YAML)
```yaml
---
name: resume-tailor          # required, slug, no spaces
version: 1.0.0               # semver
description: >               # required, shown in `list`
  ATS-optimized resume tailoring with parallel subagents.
author: nishil               # optional
command: resume-tailor       # optional — creates slash command if set
tags: [career, ats, parallel]
group: career                # optional — auto-assign to a group
scope: global                # hint: global | project | any (default: any)
conflicts: []                # skill names that cannot be active simultaneously
requires: []                 # skill names that must be active
---

# Resume Tailor

<actual skill content here — what Claude reads>
```

### Validation rules
- `name` must match directory name
- `version` must be valid semver
- `command` value must be unique across active skills (conflict at sync time)
- If `conflicts` lists an active skill, `enable` fails with an error

---

## 5. Registry Format (`skills.json`)

```json
{
  "version": "1",
  "skills": [
    {
      "name": "resume-tailor",
      "path": "~/.claude/skills/resume-tailor",
      "active": true,
      "scope": "global",
      "pinned_version": null,
      "source": "local",
      "added_at": "2026-03-13T10:00:00Z"
    },
    {
      "name": "seo-audit",
      "path": "~/.claude/skills/seo-audit",
      "active": false,
      "scope": "any",
      "pinned_version": null,
      "source": "local",
      "added_at": "2026-03-10T08:00:00Z"
    }
  ]
}
```

**Fields:**
- `source`: `local` | `git:<url>` | `registry:<package-name>` (v2)
- `pinned_version`: null = latest, semver = locked
- `scope`: stored scope for this entry — `global`, `project`, or `any`

---

## 6. CLI Interface

### Global flags
```
--global, -g    Force global registry (default: auto-detect)
--project, -p   Force project registry
--dry-run       Show what would change, write nothing
--json          Output as JSON (for scripting)
```

### Commands

#### `claude-skills list`
List all skills across scopes.

```
$ claude-skills list

GLOBAL (3 skills)
  ✓  resume-tailor    1.0.0   ATS-optimized resume tailoring
  ✓  mcp-builder      0.3.1   MCP server scaffolding
  ✗  seo-audit        1.1.0   Keyword + meta optimization

PROJECT (.claude/skills.json)
  ✓  growth-engine-copy  0.1.0  Growth Engine content agent
```

Flags: `--active` (active only), `--inactive` (inactive only), `--tag <tag>`

---

#### `claude-skills add <path-or-url>`
Register a skill into the registry. Does not activate.

```bash
claude-skills add ~/.claude/skills/resume-tailor
claude-skills add ./local-skill-dir           # relative path
claude-skills add github:nishil/claude-skills/resume-tailor  # v2
```

- Reads `skill.md` frontmatter, validates it
- Writes entry to registry with `active: false`
- If skill has a `group` key in frontmatter, auto-assigns to that group (creates group if needed)
- Prints: `Added resume-tailor (inactive). Run 'claude-skills enable resume-tailor' to activate.`

---

#### `claude-skills install <path-or-url>`
Shorthand for `add` + `enable` in one step (the common case).

```bash
claude-skills install ~/.claude/skills/resume-tailor
claude-skills install ./local-skill-dir --project
```

- Runs `add` logic, then immediately `enable` + `sync`
- Prints: `Installed and activated resume-tailor.`

---

#### `claude-skills enable <name>`
Activate a skill. Runs `sync` automatically.

```bash
claude-skills enable resume-tailor
claude-skills enable resume-tailor --project   # project scope only
```

- Sets `active: true` in registry
- Checks `conflicts` — fails if a conflicting skill is active
- Checks `requires` — warns if a required skill is not active
- Calls `sync` internally

---

#### `claude-skills disable <name>`
Deactivate a skill. Runs `sync` automatically.

```bash
claude-skills disable seo-audit
```

---

#### `claude-skills remove <name>`
Remove from registry entirely (does not delete the skill directory).

```bash
claude-skills remove seo-audit
```

Prompts for confirmation. Runs `sync` after.

---

#### `claude-skills sync`
Regenerate `CLAUDE.md` and `.claude/commands/` from active skills.

```bash
claude-skills sync            # sync both global + project
claude-skills sync --global   # global only
claude-skills sync --project  # project only
claude-skills sync --dry-run  # show diff, write nothing
```

**What sync does:**

1. Resolve active skills: global skills + project skills (project takes precedence on name conflicts)
2. For each active skill with a `command` key → write `.claude/commands/<command>.md`:
   ```markdown
   <!-- claude-skills:begin:resume-tailor -->
   # resume-tailor

   <skill.md content>
   <!-- claude-skills:end:resume-tailor -->
   ```
3. Inject skill summaries into `CLAUDE.md` between managed markers:
   ```markdown
   <!-- claude-skills:begin -->
   ## Active Skills

   ### resume-tailor
   <first 20 lines of skill.md or full content if short>

   ### mcp-builder
   ...
   <!-- claude-skills:end -->
   ```
4. Preserve all content in `CLAUDE.md` outside the managed block

**Dry-run output:**
```
[sync dry-run]
  CLAUDE.md: would add 2 skill blocks (resume-tailor, mcp-builder)
  .claude/commands/resume-tailor.md: would create
  .claude/commands/mcp-builder.md: would create
  .claude/commands/seo-audit.md: would remove (disabled)
Run without --dry-run to apply.
```

---

#### `claude-skills info <name>`
Show full skill metadata.

```bash
claude-skills info resume-tailor

  name:     resume-tailor
  version:  1.0.0
  path:     ~/.claude/skills/resume-tailor
  active:   true (global)
  command:  /resume-tailor
  tags:     career, ats, parallel
  conflicts: []
  requires: []
  added:    2026-03-13
```

---

#### `claude-skills init [--install]`
Initialize a new skill interactively.

```bash
claude-skills init

  Skill name: my-skill
  Description: Does X
  Version: 0.1.0
  Group (optional): dev-tools
  Create slash command? [y/N]: y
  Command name: my-skill

  Created ~/.claude/skills/my-skill/skill.md
  Run 'claude-skills install ~/.claude/skills/my-skill' to register and activate.
```

With `--install`: also registers and activates the skill after creation (equivalent to running `install` on it).

---

#### `claude-skills edit <name>`
Open skill.md in `$EDITOR`. Runs `sync` after save.

---

#### `claude-skills update [name]`
Re-read skill.md from disk and update the registry metadata (version, description, tags, etc.). Useful after manually editing a skill file.

```bash
claude-skills update resume-tailor   # re-read one skill
claude-skills update                 # re-read all registered skills
```

For remote-sourced skills (Phase 2), `update` fetches the latest version from the source (`git pull` / re-download) and then re-reads.

---

#### `claude-skills doctor`
Diagnose issues: orphaned commands, missing skill files, CLAUDE.md drift, conflicts, context budget.

```bash
claude-skills doctor

  ✓ Registry valid (global)
  ✓ Registry valid (project)
  ✗ .claude/commands/old-skill.md exists but no active skill named old-skill
  ✗ seo-audit skill file not found at ~/.claude/skills/seo-audit
  ✓ No conflicts
  ✓ CLAUDE.md in sync
  ⚠ Context budget: 68KB / 100KB (consider switching to summary mode)

  2 issues found. Run 'claude-skills sync' to fix command drift.
```

---

#### `claude-skills group create <name> [--skills skill1,skill2,...]`
Create a named group of skills.

```bash
claude-skills group create marketing --skills blog,blog-write,blog-audit,blog-seo,market
claude-skills group create career --skills resume-tailor,cover-letter
```

---

#### `claude-skills group enable <name>` / `group disable <name>`
Enable or disable all skills in a group as a unit.

```bash
claude-skills group enable marketing    # activates all 5 marketing skills + sync
claude-skills group disable marketing   # deactivates all 5 + sync
```

---

#### `claude-skills group list`
Show all groups and their skills.

```bash
$ claude-skills group list

  marketing (5 skills, 3 active)
    ✓ blog  ✓ blog-write  ✓ blog-audit  ✗ blog-seo  ✗ market

  career (2 skills, 2 active)
    ✓ resume-tailor  ✓ cover-letter

  ungrouped (3 skills)
    ✓ mcp-builder  ✗ seo-audit  ✗ code-reviewer
```

---

#### `claude-skills group add <group> <skill>` / `group remove <group> <skill>`
Add or remove a skill from an existing group.

```bash
claude-skills group add marketing blog-rewrite
claude-skills group remove marketing market
```

---

#### `claude-skills group only <name>`
Enable a group and disable everything else. The "context switch" command.

```bash
claude-skills group only marketing
# Disables all skills, then enables only the marketing group + sync
```

---

#### `claude-skills profile export [name]`
Export the current active skill configuration to a file.

```bash
claude-skills profile export > my-setup.json
claude-skills profile export marketing-mode > marketing-mode.json
```

---

#### `claude-skills profile import <file>`
Import a previously exported configuration.

```bash
claude-skills profile import marketing-mode.json
# Sets active/inactive states to match the profile, then syncs
```

---

#### `claude-skills restore`
Restore CLAUDE.md from the most recent backup (created automatically before each sync).

```bash
claude-skills restore
# Restores CLAUDE.md from ~/.claude/skills-backup/CLAUDE.md.1.bak
# Shows diff before applying, prompts for confirmation
```

---

## 7. CLAUDE.md Injection Format

The managed block is idempotent — running `sync` multiple times produces the same output.

```markdown
# My Project

This is my own content. claude-skills will not touch this.

<!-- claude-skills:begin -->
<!-- Generated by claude-skills v1.0.0 — do not edit this block manually -->
## Active Skills

### resume-tailor (v1.0.0)
ATS-optimized resume tailoring with parallel subagents.

<full skill.md content or truncated preview>

### mcp-builder (v0.3.1)
MCP server scaffolding for Claude Code.

<full skill.md content or truncated preview>

<!-- claude-skills:end -->

More of my own content here.
```

**Injection strategy options** (config flag `inject_mode`):
- `full` (default): embed complete skill.md content
- `catalog`: embed a skill catalog (name + description + trigger pattern) into CLAUDE.md, full content only in `.claude/commands/`. Claude sees what's available and invokes the slash command when relevant. Best balance of discoverability vs. context usage.
- `summary`: embed only frontmatter description + file path reference
- `reference`: only write the slash commands, no CLAUDE.md injection. Skills are invisible unless user invokes the slash command directly. Only use for skills you always invoke explicitly.

`catalog` is the recommended mode at scale (10+ active skills). `full` is fine for 1-9 active skills.

**Catalog mode injection example:**
```markdown
<!-- claude-skills:begin -->
<!-- Generated by claude-skills v1.0.0 — do not edit this block manually -->
## Available Skills

| Skill | Command | Description |
|---|---|---|
| resume-tailor | /resume-tailor | ATS-optimized resume tailoring with parallel subagents |
| blog-write | /blog-write | Write blog articles optimized for Google rankings and AI citations |
| mcp-builder | /mcp-builder | MCP server scaffolding for Claude Code |

Use the slash command to invoke a skill. Full skill instructions are loaded on invocation.
<!-- claude-skills:end -->
```

### Context Budget

`sync` tracks total injected size and warns when approaching limits:
- **< 50KB**: green, no warnings
- **50-100KB**: yellow, suggests switching to `catalog` mode
- **> 100KB**: red, blocks sync unless `--force` is passed, strongly recommends `catalog` or `summary` mode

The budget is calculated from all active skill content that would be injected into CLAUDE.md. Slash command files (`.claude/commands/`) are not counted since they're loaded on-demand.

---

## 8. Config File (`~/.claude/skills-config.json`)

```json
{
  "inject_mode": "full",
  "context_budget_kb": 100,
  "editor": "$EDITOR",
  "auto_sync": true,
  "backup_count": 5,
  "registry_sources": [],
  "ignore_tags": [],
  "groups": {
    "marketing": ["blog", "blog-write", "blog-audit", "blog-seo", "market"],
    "career": ["resume-tailor", "cover-letter"]
  }
}
```

- `auto_sync: true` means `enable` / `disable` / `remove` always trigger `sync`. Set to `false` to batch changes and sync manually.
- `context_budget_kb`: maximum injected content size before sync warns/blocks. Default 100.
- `backup_count`: number of CLAUDE.md backups to keep. Default 5.
- `groups`: named collections of skill names. Skills can appear in multiple groups.

---

## 9. Tech Stack

| Concern | Choice | Reason |
|---|---|---|
| Language | TypeScript (Node.js) | npm publish, Claude Code is Node ecosystem |
| CLI framework | `commander` | Mature, low overhead |
| YAML parsing | `js-yaml` | Frontmatter parsing |
| File ops | `fs-extra` | Drop-in `fs` + `ensureDir`, `copy` |
| Diff output | `diff` | Dry-run display |
| Testing | `vitest` | Fast, TypeScript-native |
| Packaging | `pkg` or `esbuild` + shebang | Single binary option |

**Min Node version**: 18 (LTS, `fs/promises` native)

**Binary name**: `claude-skills` (published as `@nishil/claude-skills` or `claude-skills` on npm)

---

## 10. Project Structure

```
claude-skills/
  src/
    cli.ts              ← commander entry, registers all commands
    commands/
      add.ts
      install.ts        ← add + enable shorthand
      enable.ts
      disable.ts
      list.ts
      sync.ts
      doctor.ts
      init.ts
      info.ts
      group.ts          ← group create/enable/disable/list/only
      profile.ts        ← profile export/import
      restore.ts        ← CLAUDE.md backup restore
    core/
      registry.ts       ← read/write skills.json, resolve scope
      skill.ts          ← parse skill.md frontmatter, validate
      inject.ts         ← CLAUDE.md managed block read/write
      commands.ts       ← .claude/commands/*.md write
      resolver.ts       ← merge global + project registries
      groups.ts         ← group operations, config read/write
      backup.ts         ← CLAUDE.md backup/restore
      budget.ts         ← context budget calculation + warnings
    utils/
      paths.ts          ← all path resolution logic
      print.ts          ← formatted terminal output
  tests/
    registry.test.ts
    sync.test.ts
    inject.test.ts
    groups.test.ts
    budget.test.ts
  package.json
  tsconfig.json
```

---

## 11. Build Phases

Estimates assume building with Claude (AI-assisted development).

### Phase 0 — Bootstrap (~half day)
- `init`, `add`, `install`, `list`, `enable`, `disable`, `sync`
- Global scope only
- `full` + `catalog` inject modes
- CLAUDE.md backup before sync
- Context budget warnings
- Published to npm
- Shell completions (bash/zsh)

**Done when**: `claude-skills install ./my-skill` makes the skill appear in Claude Code terminal without manual file editing.

---

### Phase 1 — Groups + Project Scope (~half day)
- `group create/enable/disable/list/only/add/remove`
- `profile export/import`
- Project scope support (`--project` flag)
- Registry merge (project overrides global)
- `doctor` command
- `conflicts` and `requires` enforcement at `enable` time
- `summary` + `reference` inject modes
- `--dry-run` on sync
- `restore` command

**Done when**: `claude-skills group only marketing` switches your entire Claude Code context in one command.

---

### Phase 2 — Git + Remote Sources (~1-2 days)
- `add github:<user>/<repo>/<skill-dir>` — clones/copies skill from GitHub
- `pinned_version` support — lock to a git tag
- `update` fetches latest from source
- Remote registry spec (simple JSON at a known URL)

---

### Phase 3 — Community (defer until traction)
- Public registry (GitHub-based — repos with a convention, not a hosted service)
- `claude-skills search <query>` — discover community skills via GitHub API
- `claude-skills publish` — submit to registry (create/tag a GitHub repo)
- Skill versioning + semver range support in `requires`

> **Note:** Do not build a hosted registry. Use GitHub as the registry. A hosted service is a different product with different maintenance costs. Only revisit if the tool gets significant community adoption.

---

## 12. Edge Cases and Design Decisions

**CLAUDE.md marker collision**: If user manually writes `<!-- claude-skills:begin -->` outside the managed block, sync replaces the first occurrence only. Document this.

**Multiple project registries** (monorepo): Walk up from cwd until `.claude/skills.json` is found. Stop at the first git root (`/.git` exists) or `$HOME`. In a monorepo with multiple workspaces, each workspace can have its own `.claude/skills.json`. Do not merge multiple project registries — use the first one found.

**Skill file missing after add**: `doctor` catches this. `sync` skips missing skills with a warning, does not error.

**Command name collisions**: Two active skills with the same `command` value → `sync` fails with a clear error naming both skills. User must disable one.

**Context window limit**: Full inject of 15 skills × 5KB each = 75KB in CLAUDE.md. The `catalog` inject mode is the primary escape hatch — it injects only a table of skill names/descriptions (~2KB regardless of skill count) and keeps full content in slash command files that load on-demand. The context budget system warns at 50KB and blocks at 100KB (configurable).

**`auto_sync: false` footgun**: User enables a skill but forgets to sync. Claude Code doesn't see it. The `list` command shows `[!] sync required` next to modified skills to make this visible.

**CLAUDE.md conflict with existing content**: If user already has content that overlaps with skill instructions (e.g. their own "always use TypeScript" instruction and the skill also says this), there's no deduplication. Document that skill instructions are additive.

**Sync during active Claude Code session**: If Claude Code is running when `sync` writes CLAUDE.md, the changes take effect on the next conversation (not mid-conversation). Document this — sync is a "between sessions" operation.

**Group with missing skills**: If a group references a skill name that isn't in the registry, `group enable` warns about the missing skill and activates the rest. `doctor` flags this.

**Skill in multiple groups**: A skill can belong to multiple groups. `group disable marketing` disables those skills even if they also belong to another group. `group only` is the nuclear option — it disables everything outside the named group.

**Backup rotation**: Backups are stored as `CLAUDE.md.{1-5}.bak` with 1 being the most recent. When a 6th backup is needed, the oldest is deleted. Backups include a timestamp comment on the first line.

---

## 13. Claude Code Hooks Integration

Claude Code supports hooks — shell commands that run on events. `claude-skills` can optionally install a hook to auto-sync on session start.

```bash
claude-skills hooks install
```

This adds to `~/.claude/settings.json`:
```json
{
  "hooks": {
    "session_start": [
      {
        "command": "claude-skills sync --quiet",
        "description": "Auto-sync skills on Claude Code startup"
      }
    ]
  }
}
```

`claude-skills hooks remove` removes it. This is opt-in — not installed by default.

---

## 14. Non-Goals (v1)

- GUI / TUI
- Skill authoring linter (beyond YAML validation)
- Claude.ai web skills integration (different system)
- Auto-updating skills on a schedule
- Paid/private skill registry
- Hosted registry service (use GitHub repos instead)
- Skill deduplication or content merging across overlapping skills
