import { readRegistry } from "./registry.js";
import { getRegistryPath, getProjectRegistryPath } from "../utils/paths.js";
export function resolveRegistries() {
    const globalPath = getRegistryPath();
    const projectPath = getProjectRegistryPath();
    const global = readRegistry(globalPath);
    const project = projectPath ? readRegistry(projectPath) : null;
    if (!project) {
        return { global, project: null, merged: global };
    }
    // Merge: project overrides global on name collision
    const merged = {
        version: global.version,
        skills: [...global.skills],
    };
    for (const projSkill of project.skills) {
        const idx = merged.skills.findIndex((s) => s.name === projSkill.name);
        if (idx !== -1) {
            merged.skills[idx] = projSkill;
        }
        else {
            merged.skills.push(projSkill);
        }
    }
    return { global, project, merged };
}
//# sourceMappingURL=resolver.js.map