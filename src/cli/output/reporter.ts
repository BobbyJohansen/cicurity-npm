// Terminal reporter - formats analysis results for human-readable output.

import { ansi, colorize, supportsColor } from '../../internal/ansi.js';
import type { PackageAnalysisResult } from '../../analysis/types.js';
import type { Finding, RiskLevel, Action } from '../../analysis/types.js';

const LEVEL_ICONS: Record<RiskLevel, string> = {
  critical: '[CRITICAL]',
  high: '   [HIGH] ',
  medium: ' [MEDIUM] ',
  low: '    [LOW] ',
  info: '   [INFO] ',
};

const LEVEL_COLOR: Record<RiskLevel, (s: string) => string> = {
  critical: ansi.redBold,
  high: ansi.red,
  medium: ansi.yellow,
  low: ansi.gray,
  info: ansi.gray,
};

const ACTION_ICON: Record<Action, string> = {
  block: '✗',
  warn: '⚠',
  allow: '✓',
};

const ACTION_COLOR: Record<Action, (s: string) => string> = {
  block: ansi.redBold,
  warn: ansi.yellowBold,
  allow: ansi.greenBold,
};

/**
 * Prints a summary line for a single package result.
 * Used in the per-package progress display.
 */
export function printPackageSummary(result: PackageAnalysisResult): void {
  const icon = colorize(ACTION_COLOR[result.action], ACTION_ICON[result.action]);
  const nameVer = `${result.packageName}@${result.version}`;
  const label =
    result.action === 'allow'
      ? colorize(ansi.green, 'clean')
      : result.action === 'warn'
        ? colorize(ansi.yellow, `WARNING (score: ${result.score.total}/100)`)
        : colorize(ansi.redBold, `BLOCKED (score: ${result.score.total}/100)`);

  process.stdout.write(`  ${icon} ${nameVer.padEnd(35)} ${label}\n`);

  for (const finding of result.findings) {
    printFinding(finding, result.lifecycle ?? undefined);
  }
}

/**
 * Prints the full analysis report after all packages have been processed.
 */
export function printReport(results: PackageAnalysisResult[]): void {
  const blocked = results.filter((r) => r.action === 'block');
  const warned = results.filter((r) => r.action === 'warn');

  process.stdout.write('\n');

  if (blocked.length > 0) {
    process.stdout.write(
      colorize(ansi.redBold, `✗ Installation blocked. ${blocked.length} package(s) have critical security issues.\n`)
    );
    for (const b of blocked) {
      process.stdout.write(
        `  To allowlist: ${colorize(ansi.cyan, `cicurity config allow ${b.packageName}@${b.version}`)}\n`
      );
    }
  } else if (warned.length > 0) {
    process.stdout.write(
      colorize(ansi.yellowBold, `⚠ ${warned.length} package(s) have warnings - review before proceeding.\n`)
    );
  } else {
    process.stdout.write(colorize(ansi.greenBold, '✓ All packages passed security analysis.\n'));
  }
}

function printFinding(finding: Finding, lifecycle?: string): void {
  const icon = colorize(LEVEL_COLOR[finding.level], LEVEL_ICONS[finding.level]);
  process.stdout.write(`    ${icon} ${finding.title}\n`);
  if (finding.file) {
    process.stdout.write(`               ${colorize(ansi.gray, finding.file)}\n`);
  }
  if (finding.evidence) {
    const truncated = finding.evidence.slice(0, 120);
    process.stdout.write(`               ${colorize(ansi.dim, truncated)}\n`);
  }
}

// Augment result type locally for the lifecycle field
declare module '../../analysis/types.js' {
  interface PackageAnalysisResult {
    lifecycle?: string;
  }
}
