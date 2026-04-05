// Public API — programmatic usage of the analysis pipeline.

export { analyzePackage } from './analysis/pipeline.js';
export { resolvePackage } from './registry/resolver.js';
export { fetchTarball } from './tarball/fetcher.js';
export { scoreFindings, applyEnvironmentOverride } from './analysis/scoring.js';
export { loadConfig } from './config/loader.js';
export type {
  PackageAnalysisResult,
  Finding,
  RiskLevel,
  Action,
  RiskScore,
  AnalysisContext,
  InstallScript,
  FindingCategory,
} from './analysis/types.js';
export type { ResolvedPackage, Packument, VersionMetadata } from './registry/types.js';
export type { CicurityConfig } from './config/loader.js';
