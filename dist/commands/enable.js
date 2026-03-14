import { readRegistry, writeRegistry, findSkill, setActive, getActiveSkills, } from "../core/registry.js";
import { readConfig } from "../core/config.js";
import { parseSkillFile } from "../core/skill.js";
import { syncAction } from "./sync.js";
import * as print from "../utils/print.js";
export async function enableAction(name) {
    const registry = readRegistry();
    const entry = findSkill(registry, name);
    if (!entry) {
        print.error(`Skill "${name}" not found in registry. Run 'claude-skills add <path>' first.`);
        process.exit(1);
    }
    if (entry.active) {
        print.info(`Skill "${name}" is already active.`);
        return;
    }
    // Parse the skill being enabled to check conflicts/requires
    const parsed = parseSkillFile(entry.path);
    if (parsed) {
        const activeEntries = getActiveSkills(registry);
        const activeSkills = activeEntries
            .map((e) => ({ entry: e, parsed: parseSkillFile(e.path) }))
            .filter((s) => s.parsed !== null);
        // Check conflicts: skill-to-enable conflicts with an active skill
        if (parsed.meta.conflicts?.length) {
            for (const conflict of parsed.meta.conflicts) {
                const conflicting = activeSkills.find((s) => s.entry.name === conflict);
                if (conflicting) {
                    print.error(`Cannot enable "${name}": conflicts with active skill "${conflict}".`);
                    process.exit(1);
                }
            }
        }
        // Check conflicts: an active skill conflicts with skill-to-enable
        for (const active of activeSkills) {
            if (active.parsed.meta.conflicts?.includes(name)) {
                print.error(`Cannot enable "${name}": active skill "${active.entry.name}" conflicts with it.`);
                process.exit(1);
            }
        }
        // Check requires: warn if required skills are not active
        if (parsed.meta.requires?.length) {
            for (const req of parsed.meta.requires) {
                const found = activeSkills.find((s) => s.entry.name === req);
                if (!found) {
                    print.warn(`Skill "${name}" requires "${req}" which is not active.`);
                }
            }
        }
    }
    setActive(registry, name, true);
    writeRegistry(registry);
    print.success(`Enabled "${name}".`);
    const config = readConfig();
    if (config.auto_sync) {
        await syncAction();
    }
}
//# sourceMappingURL=enable.js.map