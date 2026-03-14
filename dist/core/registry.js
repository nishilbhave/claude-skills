import fs from "node:fs";
import fse from "fs-extra";
import { getRegistryPath } from "../utils/paths.js";
export function readRegistry(registryPath) {
    const regPath = registryPath || getRegistryPath();
    if (!fs.existsSync(regPath)) {
        return { version: "1", skills: [] };
    }
    const raw = fs.readFileSync(regPath, "utf-8");
    return JSON.parse(raw);
}
export function writeRegistry(registry, registryPath) {
    const regPath = registryPath || getRegistryPath();
    fse.ensureDirSync(regPath.replace(/\/[^/]+$/, ""));
    fs.writeFileSync(regPath, JSON.stringify(registry, null, 2) + "\n", "utf-8");
}
export function findSkill(registry, name) {
    return registry.skills.find((s) => s.name === name);
}
export function addSkill(registry, entry) {
    const existing = findSkill(registry, entry.name);
    if (existing) {
        // Update existing entry
        Object.assign(existing, entry);
    }
    else {
        registry.skills.push(entry);
    }
    return registry;
}
export function removeSkill(registry, name) {
    registry.skills = registry.skills.filter((s) => s.name !== name);
    return registry;
}
export function setActive(registry, name, active) {
    const entry = findSkill(registry, name);
    if (entry) {
        entry.active = active;
    }
    return registry;
}
export function getActiveSkills(registry) {
    return registry.skills.filter((s) => s.active);
}
//# sourceMappingURL=registry.js.map