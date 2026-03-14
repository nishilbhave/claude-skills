import {
  readRegistry,
  writeRegistry,
  findSkill,
  setActive,
} from "../core/registry.js";
import { readConfig } from "../core/config.js";
import { syncAction } from "./sync.js";
import * as print from "../utils/print.js";

export async function enableAction(name: string): Promise<void> {
  const registry = readRegistry();
  const entry = findSkill(registry, name);

  if (!entry) {
    print.error(
      `Skill "${name}" not found in registry. Run 'claude-skills add <path>' first.`
    );
    process.exit(1);
  }

  if (entry.active) {
    print.info(`Skill "${name}" is already active.`);
    return;
  }

  setActive(registry, name, true);
  writeRegistry(registry);
  print.success(`Enabled "${name}".`);

  const config = readConfig();
  if (config.auto_sync) {
    await syncAction();
  }
}
