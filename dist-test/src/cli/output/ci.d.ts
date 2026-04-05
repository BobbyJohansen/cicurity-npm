import type { PackageAnalysisResult } from '../../analysis/types.js';
/** Prints machine-readable JSON results to stdout (for CI parsing) */
export declare function printJsonResults(results: PackageAnalysisResult[]): void;
/** Prints a plain-text CI summary to stderr (always visible even with JSON stdout) */
export declare function printCiSummary(results: PackageAnalysisResult[]): void;
//# sourceMappingURL=ci.d.ts.map