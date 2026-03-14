import { type Registry } from "./registry.js";
export interface ResolvedRegistries {
    global: Registry;
    project: Registry | null;
    merged: Registry;
}
export declare function resolveRegistries(): ResolvedRegistries;
