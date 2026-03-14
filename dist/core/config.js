import fs from "node:fs";
import fse from "fs-extra";
import { getConfigPath } from "../utils/paths.js";
const defaults = {
    inject_mode: "full",
    context_budget_kb: 100,
    auto_sync: true,
    backup_count: 5,
};
export function readConfig() {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
        return { ...defaults };
    }
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
}
export function writeConfig(config) {
    const configPath = getConfigPath();
    fse.ensureDirSync(configPath.replace(/\/[^/]+$/, ""));
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}
export function ensureConfig() {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
        writeConfig(defaults);
    }
    return readConfig();
}
//# sourceMappingURL=config.js.map