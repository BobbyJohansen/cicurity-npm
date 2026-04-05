import type { PackageAnalysisResult, CicurityReport } from '../../analysis/types.js';
import type { ResolvedPackage } from '../../registry/types.js';
export declare function resolveProjectName(explicitName?: string): string;
export declare function buildReport(results: PackageAnalysisResult[], resolvedPackages: Map<string, ResolvedPackage>, projectName: string): CicurityReport;
export declare function writeAnalyzerReport(results: PackageAnalysisResult[], resolvedPackages: Map<string, ResolvedPackage>, projectName: string): void;
//# sourceMappingURL=report.d.ts.map