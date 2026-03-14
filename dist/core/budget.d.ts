export type BudgetLevel = "green" | "yellow" | "red";
export interface BudgetResult {
    totalKb: number;
    level: BudgetLevel;
    message: string;
}
export declare function calculateBudget(contents: string[], budgetKb: number): BudgetResult;
