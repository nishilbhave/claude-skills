import fs from "node:fs";
import fse from "fs-extra";
import { getRegistryPath } from "../utils/paths.js";

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

export function readRegistry(registryPath?: string): Registry {
  const regPath = registryPath || getRegistryPath();
  if (!fs.existsSync(regPath)) {
    return { version: "1", skills: [] };
  }
  const raw = fs.readFileSync(regPath, "utf-8");
  return JSON.parse(raw) as Registry;
}

export function writeRegistry(
  registry: Registry,
  registryPath?: string
): void {
  const regPath = registryPath || getRegistryPath();
  fse.ensureDirSync(regPath.replace(/\/[^/]+$/, ""));
  fs.writeFileSync(
    regPath,
    JSON.stringify(registry, null, 2) + "\n",
    "utf-8"
  );
}

export function findSkill(
  registry: Registry,
  name: string
): RegistryEntry | undefined {
  return registry.skills.find((s) => s.name === name);
}

export function addSkill(
  registry: Registry,
  entry: RegistryEntry
): Registry {
  const existing = findSkill(registry, entry.name);
  if (existing) {
    // Update existing entry
    Object.assign(existing, entry);
  } else {
    registry.skills.push(entry);
  }
  return registry;
}

export function removeSkill(registry: Registry, name: string): Registry {
  registry.skills = registry.skills.filter((s) => s.name !== name);
  return registry;
}

export function setActive(
  registry: Registry,
  name: string,
  active: boolean
): Registry {
  const entry = findSkill(registry, name);
  if (entry) {
    entry.active = active;
  }
  return registry;
}

export function getActiveSkills(registry: Registry): RegistryEntry[] {
  return registry.skills.filter((s) => s.active);
}
