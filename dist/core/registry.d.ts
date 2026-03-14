export interface RegistryEntry {
    name: string;
    path: string;
    active: boolean;
    scope: string;
    pinned_version: string | null;
    source: string;
    added_at: string;
}
export interface Registry {
    version: string;
    skills: RegistryEntry[];
}
export declare function readRegistry(registryPath?: string): Registry;
export declare function writeRegistry(registry: Registry, registryPath?: string): void;
export declare function findSkill(registry: Registry, name: string): RegistryEntry | undefined;
export declare function addSkill(registry: Registry, entry: RegistryEntry): Registry;
export declare function removeSkill(registry: Registry, name: string): Registry;
export declare function setActive(registry: Registry, name: string, active: boolean): Registry;
export declare function getActiveSkills(registry: Registry): RegistryEntry[];
