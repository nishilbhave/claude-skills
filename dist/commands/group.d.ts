export declare function groupCreateAction(name: string, options: {
    skills?: string;
}): Promise<void>;
export declare function groupEnableAction(name: string): Promise<void>;
export declare function groupDisableAction(name: string): Promise<void>;
export declare function groupListAction(): Promise<void>;
export declare function groupAddAction(group: string, skill: string): Promise<void>;
export declare function groupRemoveAction(group: string, skill: string): Promise<void>;
export declare function groupOnlyAction(name: string): Promise<void>;
