// Core install command orchestration:
// resolve → analyze → report → run original tool or exit 1
import * as childProcess from 'node:child_process';
import { resolvePackage } from '../../registry/resolver.js';
import { analyzePackage } from '../../analysis/pipeline.js';
import { loadConfig } from '../../config/loader.js';
import { isAllowlisted } from '../../internal/config-validator.js';
import { startSpinner, ansi, colorize } from '../../internal/ansi.js';
import { confirm } from '../../internal/prompt.js';
import { printPackageSummary, printReport } from '../output/reporter.js';
import { printJsonResults, printCiSummary } from '../output/ci.js';
export async function runInstall(parsed) {
    const { config } = await loadConfig();
    // If no packages are named explicitly, run the tool directly (e.g. bare `npm install`)
    if (parsed.packages.length === 0) {
        runOriginalTool(parsed);
        return;
    }
    const isCI = process.env['CI'] === 'true' ||
        process.env['GITHUB_ACTIONS'] === 'true' ||
        process.env['CIRCLECI'] === 'true' ||
        process.env['TRAVIS'] === 'true';
    const useJson = parsed.flags.json || (isCI && config.ci.outputFormat === 'json');
    if (!useJson) {
        process.stdout.write(`${colorize(ansi.bold, 'cicurity')} ${colorize(ansi.gray, `analyzing ${parsed.packages.length} package(s)...\n`)}`);
    }
    const results = [];
    for (const specifier of parsed.packages) {
        // Check allowlist before fetching
        const { name } = preParseSpecifier(specifier);
        if (isAllowlisted(name, '*', config.allowlist)) {
            if (!useJson) {
                process.stdout.write(`  ${colorize(ansi.gray, '○')} ${specifier.padEnd(35)} ${colorize(ansi.gray, 'allowlisted')}\n`);
            }
            continue;
        }
        const spinner = useJson ? null : startSpinner(`${specifier}`);
        let result;
        try {
            const resolved = await resolvePackage(specifier, { registry: config.registry });
            // Check allowlist with exact version
            if (isAllowlisted(resolved.name, resolved.version, config.allowlist)) {
                spinner?.stop();
                if (!useJson) {
                    process.stdout.write(`  ${colorize(ansi.gray, '○')} ${(resolved.name + '@' + resolved.version).padEnd(35)} ${colorize(ansi.gray, 'allowlisted')}\n`);
                }
                continue;
            }
            result = await analyzePackage(resolved, { ciWarnAction: config.ci.warnAction });
        }
        catch (err) {
            spinner?.stop();
            const msg = err instanceof Error ? err.message : String(err);
            process.stderr.write(`  ${colorize(ansi.red, '✗')} ${specifier}: ${msg}\n`);
            process.exit(1);
        }
        spinner?.stop();
        if (!useJson) {
            printPackageSummary(result);
        }
        results.push(result);
    }
    // Output
    if (useJson) {
        printJsonResults(results);
        printCiSummary(results);
    }
    else {
        printReport(results);
    }
    const blocked = results.filter((r) => r.action === 'block');
    const warned = results.filter((r) => r.action === 'warn');
    if (blocked.length > 0) {
        process.exit(1);
    }
    if (warned.length > 0 && !isCI) {
        const choice = await confirm(`${warned.length} package(s) have warnings. Proceed with install?`);
        if (choice === 'no') {
            process.stdout.write(colorize(ansi.yellow, 'Installation cancelled.\n'));
            process.exit(1);
        }
    }
    // All clear - run the original tool
    runOriginalTool(parsed);
}
/** Runs the original npm/pnpm/npx command, inheriting stdio and mirroring exit code */
function runOriginalTool(parsed) {
    const { tool, passthroughArgs } = parsed;
    const result = childProcess.spawnSync(tool, passthroughArgs, {
        stdio: 'inherit',
        shell: false,
    });
    if (result.error) {
        process.stderr.write(`cicurity: failed to run ${tool}: ${result.error.message}\n`);
        process.exit(1);
    }
    process.exit(result.status ?? 0);
}
/** Quick pre-parse to get just the package name from a specifier (for allowlist check) */
function preParseSpecifier(specifier) {
    if (specifier.startsWith('@')) {
        const atIdx = specifier.indexOf('@', 1);
        return { name: atIdx === -1 ? specifier : specifier.slice(0, atIdx) };
    }
    const atIdx = specifier.indexOf('@');
    return { name: atIdx === -1 ? specifier : specifier.slice(0, atIdx) };
}
//# sourceMappingURL=install.js.map