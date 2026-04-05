import type { AnalysisContext, Finding, InstallScript } from '../types.js';
/**
 * Reads package.json from the extracted tarball, finds all lifecycle install
 * hooks, and resolves any JS files they reference.
 * Returns a Finding for each hook found (informational) and populates
 * context.installScripts for downstream analyzers.
 */
export declare function analyzeInstallScripts(context: AnalysisContext): Promise<{
    installScripts: InstallScript[];
    findings: Finding[];
}>;
//# sourceMappingURL=install-scripts.d.ts.map