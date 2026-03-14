import fs from "node:fs";
import fse from "fs-extra";
import { getConfigPath } from "../utils/paths.js";

export interface SkillsConfig {
  inject_mode: "full" | "catalog" | "summary" | "reference";
  context_budget_kb: number;
  auto_sync: boolean;
  backup_count: number;
  groups: Record<string, string[]>;
}

const defaults: SkillsConfig = {
  inject_mode: "full",
  context_budget_kb: 100,
  auto_sync: true,
  backup_count: 5,
  groups: {},
};

export function readConfig(): SkillsConfig {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return { ...defaults };
  }
  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw) as Partial<SkillsConfig>;
  return { ...defaults, ...parsed };
}

export function writeConfig(config: SkillsConfig): void {
  const configPath = getConfigPath();
  fse.ensureDirSync(configPath.replace(/\/[^/]+$/, ""));
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function ensureConfig(): SkillsConfig {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    writeConfig(defaults);
  }
  return readConfig();
}
