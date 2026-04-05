import type { PackageAnalysisResult } from '../../analysis/types.js';
/**
 * Prints a summary line for a single package result.
 * Used in the per-package progress display.
 */
export declare function printPackageSummary(result: PackageAnalysisResult): void;
/**
 * Prints the full analysis report after all packages have been processed.
 */
export declare function printReport(results: PackageAnalysisResult[]): void;
declare module '../../analysis/types.js' {
    interface PackageAnalysisResult {
        lifecycle?: string;
    }
}
//# sourceMappingURL=reporter.d.ts.map