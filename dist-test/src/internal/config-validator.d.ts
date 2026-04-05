export type RiskLevelName = 'critical' | 'high' | 'medium' | 'low';
export type WarnAction = 'block' | 'warn' | 'allow';
export type OutputFormat = 'text' | 'json';
export interface CicurityConfig {
    /**
     * Package specifiers to skip analysis for.
     * Supports exact "name@version" or wildcard "name@*".
     */
    allowlist: string[];
    /** Which risk levels should cause an install to be blocked. */
    blockOn: RiskLevelName[];
    ci: {
        /** What to do when a package scores 'warn' inside a CI environment. */
        warnAction: WarnAction;
        outputFormat: OutputFormat;
    };
    /** npm-compatible registry URL */
    registry: string;
}
export type ConfigError = {
    field: string;
    message: string;
};
/**
 * Validates a parsed JSON object against the CicurityConfig schema.
 * Returns the validated config and any errors found.
 */
export declare function validateConfig(raw: unknown): {
    config: CicurityConfig;
    errors: ConfigError[];
};
export declare function defaultConfig(): CicurityConfig;
/**
 * Returns true if a package specifier matches an allowlist entry.
 * Supports exact "name@version" and wildcard "name@*".
 */
export declare function isAllowlisted(name: string, version: string, allowlist: string[]): boolean;
//# sourceMappingURL=config-validator.d.ts.map