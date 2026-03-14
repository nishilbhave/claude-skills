import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { createTwoFilesPatch } from "diff";
import { getBackupDir, getClaudeMdPath } from "../utils/paths.js";
import * as print from "../utils/print.js";
function ask(rl, question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer.trim()));
    });
}
export async function restoreAction() {
    const backupDir = getBackupDir();
    const backupPath = path.join(backupDir, "CLAUDE.md.1.bak");
    if (!fs.existsSync(backupPath)) {
        print.error("No backup found. Nothing to restore.");
        process.exit(1);
    }
    const rawBackup = fs.readFileSync(backupPath, "utf-8");
    // Strip timestamp comment from first line
    const backupContent = rawBackup.replace(/^<!-- backup: .* -->\n/, "");
    const claudeMdPath = getClaudeMdPath();
    const currentContent = fs.existsSync(claudeMdPath)
        ? fs.readFileSync(claudeMdPath, "utf-8")
        : "";
    if (currentContent === backupContent) {
        print.info("CLAUDE.md is identical to the most recent backup. Nothing to restore.");
        return;
    }
    // Show diff
    const diff = createTwoFilesPatch("CLAUDE.md (current)", "CLAUDE.md (backup)", currentContent, backupContent);
    console.log(diff);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    try {
        const answer = await ask(rl, "  Restore from backup? (y/N): ");
        if (answer.toLowerCase() !== "y") {
            print.info("Restore cancelled.");
            return;
        }
    }
    finally {
        rl.close();
    }
    fs.writeFileSync(claudeMdPath, backupContent, "utf-8");
    print.success("Restored CLAUDE.md from backup.");
}
//# sourceMappingURL=restore.js.map