// Non-interactive CI output formatter.
// Prints structured text or JSON depending on config.
/** Prints machine-readable JSON results to stdout (for CI parsing) */
export function printJsonResults(results) {
    const output = {
        blocked: results.filter((r) => r.action === 'block').length,
        warned: results.filter((r) => r.action === 'warn').length,
        clean: results.filter((r) => r.action === 'allow').length,
        packages: results.map((r) => ({
            name: r.packageName,
            version: r.version,
            action: r.action,
            score: r.score.total,
            findings: r.findings.map((f) => ({
                level: f.level,
                category: f.category,
                title: f.title,
                file: f.file,
                line: f.line,
                evidence: f.evidence,
            })),
        })),
    };
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}
/** Prints a plain-text CI summary to stderr (always visible even with JSON stdout) */
export function printCiSummary(results) {
    const blocked = results.filter((r) => r.action === 'block');
    const warned = results.filter((r) => r.action === 'warn');
    if (blocked.length > 0) {
        process.stderr.write(`[cicurity] BLOCKED: ${blocked.map((r) => `${r.packageName}@${r.version}`).join(', ')}\n`);
        for (const b of blocked) {
            for (const f of b.findings) {
                process.stderr.write(`  [${f.level.toUpperCase()}] ${b.packageName}@${b.version}: ${f.title}\n`);
                if (f.evidence)
                    process.stderr.write(`    ${f.evidence.slice(0, 120)}\n`);
            }
        }
    }
    else if (warned.length > 0) {
        process.stderr.write(`[cicurity] WARN: ${warned.map((r) => `${r.packageName}@${r.version}`).join(', ')}\n`);
    }
    else {
        process.stderr.write(`[cicurity] OK: all ${results.length} package(s) passed\n`);
    }
}
//# sourceMappingURL=ci.js.map