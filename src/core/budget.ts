export type BudgetLevel = "green" | "yellow" | "red";

export interface BudgetResult {
  totalKb: number;
  level: BudgetLevel;
  message: string;
}

export function calculateBudget(
  contents: string[],
  budgetKb: number
): BudgetResult {
  const totalBytes = contents.reduce((sum, c) => sum + Buffer.byteLength(c, "utf-8"), 0);
  const totalKb = Math.round((totalBytes / 1024) * 10) / 10;

  if (totalKb > budgetKb) {
    return {
      totalKb,
      level: "red",
      message: `Context budget exceeded: ${totalKb}KB / ${budgetKb}KB. Consider switching to catalog mode.`,
    };
  }

  if (totalKb > budgetKb * 0.5) {
    return {
      totalKb,
      level: "yellow",
      message: `Context usage: ${totalKb}KB / ${budgetKb}KB. Consider switching to catalog mode if adding more skills.`,
    };
  }

  return {
    totalKb,
    level: "green",
    message: `Context usage: ${totalKb}KB / ${budgetKb}KB`,
  };
}
