import { readRegistry, writeRegistry, findSkill, setActive, } from "../core/registry.js";
import { readConfig } from "../core/config.js";
import { syncAction } from "./sync.js";
import * as print from "../utils/print.js";
export async function disableAction(name) {
    const registry = readRegistry();
    const entry = findSkill(registry, name);
    if (!entry) {
        print.error(`Skill "${name}" not found in registry.`);
        process.exit(1);
    }
    if (!entry.active) {
        print.info(`Skill "${name}" is already inactive.`);
        return;
    }
    setActive(registry, name, false);
    writeRegistry(registry);
    print.success(`Disabled "${name}".`);
    const config = readConfig();
    if (config.auto_sync) {
        await syncAction();
    }
}
//# sourceMappingURL=disable.js.map