import fs from "node:fs";
import { readRegistry, writeRegistry, findSkill, setActive } from "../core/registry.js";
import { readConfig, writeConfig } from "../core/config.js";
import { syncAction } from "./sync.js";
import * as print from "../utils/print.js";

interface ProfileData {
  name: string;
  exported_at: string;
  skills: Array<{ name: string; active: boolean }>;
  groups: Record<string, string[]>;
}

export async function profileExportAction(name?: string): Promise<void> {
  const registry = readRegistry();
  const config = readConfig();

  const profile: ProfileData = {
    name: name || "default",
    exported_at: new Date().toISOString(),
    skills: registry.skills.map((s) => ({ name: s.name, active: s.active })),
    groups: config.groups,
  };

  console.log(JSON.stringify(profile, null, 2));
}

export async function profileImportAction(file: string): Promise<void> {
  if (!fs.existsSync(file)) {
    print.error(`File not found: ${file}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(file, "utf-8");
  let profile: ProfileData;
  try {
    profile = JSON.parse(raw) as ProfileData;
  } catch {
    print.error("Invalid JSON in profile file.");
    process.exit(1);
  }

  const registry = readRegistry();
  let applied = 0;
  let missing = 0;

  for (const skill of profile.skills) {
    const entry = findSkill(registry, skill.name);
    if (entry) {
      setActive(registry, skill.name, skill.active);
      applied++;
    } else {
      print.warn(`Skill "${skill.name}" not found in registry — skipping.`);
      missing++;
    }
  }

  writeRegistry(registry);

  // Merge groups
  if (profile.groups && Object.keys(profile.groups).length > 0) {
    const config = readConfig();
    for (const [groupName, skills] of Object.entries(profile.groups)) {
      if (!config.groups[groupName]) {
        config.groups[groupName] = skills;
      } else {
        // Merge: add skills not already present
        for (const s of skills) {
          if (!config.groups[groupName].includes(s)) {
            config.groups[groupName].push(s);
          }
        }
      }
    }
    writeConfig(config);
  }

  print.success(
    `Imported profile "${profile.name}": ${applied} skill(s) updated, ${missing} missing.`
  );
  await syncAction();
}
