export interface SkillsConfig {
    inject_mode: "full" | "catalog";
    context_budget_kb: number;
    auto_sync: boolean;
    backup_count: number;
}
export declare function readConfig(): SkillsConfig;
export declare function writeConfig(config: SkillsConfig): void;
export declare function ensureConfig(): SkillsConfig;
