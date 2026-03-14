const isTTY = process.stdout.isTTY ?? false;

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

function c(color: keyof typeof colors, text: string): string {
  if (!isTTY) return text;
  return `${colors[color]}${text}${colors.reset}`;
}

// Strip ANSI escape codes to get visible string length
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function visibleLength(str: string): number {
  return stripAnsi(str).length;
}

// Pad string to target width based on visible (non-ANSI) length
function padVisible(str: string, width: number): string {
  const pad = width - visibleLength(str);
  return pad > 0 ? str + " ".repeat(pad) : str;
}

// Exported color wrappers for styled table cells
export function green(text: string): string { return c("green", text); }
export function red(text: string): string { return c("red", text); }
export function yellow(text: string): string { return c("yellow", text); }
export function cyan(text: string): string { return c("cyan", text); }
export function dimText(text: string): string { return c("dim", text); }
export function boldText(text: string): string { return c("bold", text); }

export function success(msg: string): void {
  console.log(`${c("green", "✓")} ${msg}`);
}

export function warn(msg: string): void {
  console.log(`${c("yellow", "⚠")} ${msg}`);
}

export function error(msg: string): void {
  console.error(`${c("red", "✗")} ${msg}`);
}

export function info(msg: string): void {
  console.log(`${c("cyan", "ℹ")} ${msg}`);
}

export function dim(msg: string): void {
  console.log(c("dim", msg));
}

export function bold(msg: string): string {
  return c("bold", msg);
}

export function table(rows: string[][], colWidths?: number[]): void {
  if (rows.length === 0) return;
  const widths =
    colWidths ||
    rows[0].map((_, i) =>
      Math.max(...rows.map((r) => visibleLength(r[i] || ""))) + 2
    );
  for (const row of rows) {
    const line = row
      .map((cell, i) => padVisible(cell || "", widths[i] || 20))
      .join("");
    console.log(`  ${line}`);
  }
}
