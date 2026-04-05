import type { Packument } from '../registry/types.js';
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Action = 'block' | 'warn' | 'allow';
export type FindingCategory = 'install-script-network' | 'install-script-eval' | 'install-script-obfuscation' | 'install-script-env-access' | 'install-script-fs-escape' | 'install-script-child-process' | 'install-script-fs-access' | 'install-script-conditional-exec' | 'install-script-remote-exec' | 'typosquatting' | 'maintainer-change' | 'binary-files' | 'package-age' | 'integrity-mismatch' | 'dependency-confusion' | 'publish-anomaly' | 'metadata-integrity';
export interface Finding {
    category: FindingCategory;
    level: RiskLevel;
    title: string;
    description: string;
    /** The actual code snippet or data that triggered the finding */
    evidence?: string;
    /** File path inside the tarball */
    file?: string;
    line?: number;
}
export interface RiskScore {
    /** Aggregate score 0–100 (capped) */
    total: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
}
export interface PackageAnalysisResult {
    packageName: string;
    version: string;
    /** sha512 integrity hash from the registry */
    integrity: string;
    findings: Finding[];
    score: RiskScore;
    action: Action;
    durationMs: number;
}
/** A resolved install script lifecycle hook */
export interface InstallScript {
    lifecycle: 'preinstall' | 'install' | 'postinstall' | 'prepare';
    /** Raw command string, e.g. "node scripts/install.js" */
    command: string;
    /** Absolute path to the JS/TS file being invoked, if resolvable */
    resolvedFile?: string;
    /** File contents of resolvedFile, if read */
    source?: string;
}
/** Context passed to all analyzers */
export interface AnalysisContext {
    packageName: string;
    version: string;
    /** Absolute path to extracted tarball directory (contains "package/" subdir) */
    extractedPath: string;
    /** All files in the tarball, relative to extractedPath */
    allFiles: string[];
    installScripts: InstallScript[];
    packument: Packument;
}
export type PackageState = 'clean' | 'warn' | 'block';
export interface ReportPackage {
    name: string;
    version: string;
    integrity: string;
    /** ISO timestamp from packument.time[version], null if not available */
    publishedAt: string | null;
    /** 'allow' mapped to 'clean' */
    state: PackageState;
    score: number;
    recommendation: string;
    findings: Finding[];
}
export interface CicurityReport {
    projectName: string;
    cicurityVersion: string;
    timestamp: string;
    summary: {
        total: number;
        blocked: number;
        warned: number;
        clean: number;
    };
    /** All analyzed packages regardless of state */
    packages: ReportPackage[];
}
//# sourceMappingURL=types.d.ts.map