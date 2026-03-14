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
function c(color, text) {
    if (!isTTY)
        return text;
    return `${colors[color]}${text}${colors.reset}`;
}
export function success(msg) {
    console.log(`${c("green", "✓")} ${msg}`);
}
export function warn(msg) {
    console.log(`${c("yellow", "⚠")} ${msg}`);
}
export function error(msg) {
    console.error(`${c("red", "✗")} ${msg}`);
}
export function info(msg) {
    console.log(`${c("cyan", "ℹ")} ${msg}`);
}
export function dim(msg) {
    console.log(c("dim", msg));
}
export function bold(msg) {
    return c("bold", msg);
}
export function table(rows, colWidths) {
    if (rows.length === 0)
        return;
    const widths = colWidths ||
        rows[0].map((_, i) => Math.max(...rows.map((r) => (r[i] || "").length)) + 2);
    for (const row of rows) {
        const line = row
            .map((cell, i) => (cell || "").padEnd(widths[i] || 20))
            .join("");
        console.log(`  ${line}`);
    }
}
//# sourceMappingURL=print.js.map