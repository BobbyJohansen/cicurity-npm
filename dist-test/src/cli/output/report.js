// Analyzer report builder and file writer.
// Produces ./cicurity/cicurity-analyzer-report-<timestamp>.json after every run.
import * as fs from 'node:fs';
import * as path from 'node:path';
function formatTimestamp(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
        `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
function toState(action) {
    return action === 'allow' ? 'clean' : action;
}
function buildRecommendation(result) {
    const { action, score } = result;
    if (action === 'block') {
        return `Block installation (score ${score.total}/100 with ${score.criticalCount} critical and ${score.highCount} high finding(s)).`;
    }
    if (action === 'warn') {
        return `Review before installing (score ${score.total}/100 with ${score.highCount} high and ${score.mediumCount} medium finding(s)).`;
    }
    return 'No issues detected.';
}
export function resolveProjectName(explicitName) {
    if (explicitName)
        return explicitName;
    try {
        const pkgPath = path.join(process.cwd(), 'package.json');
        const raw = fs.readFileSync(pkgPath, 'utf8');
        const pkg = JSON.parse(raw);
        if (typeof pkg['name'] === 'string' && pkg['name'].length > 0) {
            return pkg['name'];
        }
    }
    catch {
        // no package.json or unreadable — fall through
    }
    return path.basename(process.cwd());
}
function resolveCicurityVersion() {
    try {
        // Compiled to dist/cli/output/report.js — three levels up = package root
        const pkgPath = new URL('../../../package.json', import.meta.url);
        const raw = fs.readFileSync(pkgPath, 'utf8');
        const pkg = JSON.parse(raw);
        if (typeof pkg['version'] === 'string')
            return pkg['version'];
    }
    catch {
        // fallback for test environments or unexpected layouts
    }
    return 'unknown';
}
export function buildReport(results, resolvedPackages, projectName) {
    const now = new Date();
    const packages = results.map((r) => {
        const key = `${r.packageName}@${r.version}`;
        const resolved = resolvedPackages.get(key);
        const publishedAt = resolved?.packument.time[r.version] ?? null;
        return {
            name: r.packageName,
            version: r.version,
            integrity: r.integrity,
            publishedAt,
            state: toState(r.action),
            score: r.score.total,
            recommendation: buildRecommendation(r),
            findings: r.findings,
        };
    });
    const blocked = results.filter((r) => r.action === 'block').length;
    const warned = results.filter((r) => r.action === 'warn').length;
    const clean = results.filter((r) => r.action === 'allow').length;
    return {
        projectName,
        cicurityVersion: resolveCicurityVersion(),
        timestamp: now.toISOString(),
        summary: { total: results.length, blocked, warned, clean },
        packages,
    };
}
export function writeAnalyzerReport(results, resolvedPackages, projectName) {
    try {
        const now = new Date();
        const report = buildReport(results, resolvedPackages, projectName);
        const dir = path.join(process.cwd(), 'cicurity');
        fs.mkdirSync(dir, { recursive: true });
        const filename = `cicurity-analyzer-report-${formatTimestamp(now)}.json`;
        const filePath = path.join(dir, filename);
        fs.writeFileSync(filePath, JSON.stringify(report, null, 2) + '\n', 'utf8');
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[cicurity] report: failed to write analyzer report: ${msg}\n`);
    }
}
//# sourceMappingURL=report.js.map