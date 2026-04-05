import type { PackageAnalysisResult } from './types.js';
import type { ResolvedPackage } from '../registry/types.js';
import type { WarnAction } from '../internal/config-validator.js';
export interface PipelineOptions {
    ciWarnAction?: WarnAction;
}
/**
 * Runs the full analysis pipeline for a resolved package.
 * Downloads the tarball, extracts to temp dir, runs all analyzers in parallel,
 * scores the findings, and cleans up.
 */
export declare function analyzePackage(resolved: ResolvedPackage, options?: PipelineOptions): Promise<PackageAnalysisResult>;
//# sourceMappingURL=pipeline.d.ts.map