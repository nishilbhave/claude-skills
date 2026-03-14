import fs from "node:fs";
import fse from "fs-extra";
import path from "node:path";
import { getBackupDir, getClaudeMdPath } from "../utils/paths.js";
export function backupClaudeMd(maxBackups = 5) {
    const claudeMdPath = getClaudeMdPath();
    if (!fs.existsSync(claudeMdPath))
        return null;
    const backupDir = getBackupDir();
    fse.ensureDirSync(backupDir);
    // Shift existing backups: 4→5, 3→4, 2→3, 1→2
    for (let i = maxBackups - 1; i >= 1; i--) {
        const from = path.join(backupDir, `CLAUDE.md.${i}.bak`);
        const to = path.join(backupDir, `CLAUDE.md.${i + 1}.bak`);
        if (fs.existsSync(from)) {
            if (i + 1 > maxBackups) {
                fs.unlinkSync(from);
            }
            else {
                fs.renameSync(from, to);
            }
        }
    }
    // Delete overflow
    const overflow = path.join(backupDir, `CLAUDE.md.${maxBackups + 1}.bak`);
    if (fs.existsSync(overflow))
        fs.unlinkSync(overflow);
    // Copy current as backup 1
    const dest = path.join(backupDir, "CLAUDE.md.1.bak");
    const timestamp = `<!-- backup: ${new Date().toISOString()} -->\n`;
    const content = fs.readFileSync(claudeMdPath, "utf-8");
    fs.writeFileSync(dest, timestamp + content, "utf-8");
    return dest;
}
//# sourceMappingURL=backup.js.map