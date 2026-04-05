import { type CicurityConfig, type ConfigError } from '../internal/config-validator.js';
export type { CicurityConfig };
export interface LoadConfigResult {
    config: CicurityConfig;
    configPath: string | null;
    errors: ConfigError[];
}
/**
 * Loads the nearest cicurity.config.json walking up from cwd,
 * then falls back to ~/.cicurity/config.json, then defaults.
 */
export declare function loadConfig(cwd?: string): Promise<LoadConfigResult>;
//# sourceMappingURL=loader.d.ts.map