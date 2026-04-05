// Manual cicurity.config.json validator - no zod dependency.

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

export type ConfigError = { field: string; message: string };

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isString);
}

const VALID_RISK_LEVELS = new Set<string>(['critical', 'high', 'medium', 'low']);
const VALID_WARN_ACTIONS = new Set<string>(['block', 'warn', 'allow']);
const VALID_OUTPUT_FORMATS = new Set<string>(['text', 'json']);

/**
 * Validates a parsed JSON object against the CicurityConfig schema.
 * Returns the validated config and any errors found.
 */
export function validateConfig(
  raw: unknown
): { config: CicurityConfig; errors: ConfigError[] } {
  const errors: ConfigError[] = [];
  const defaults = defaultConfig();

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {
      config: defaults,
      errors: [{ field: 'root', message: 'Config must be a JSON object' }],
    };
  }

  const obj = raw as Record<string, unknown>;
  const config: CicurityConfig = { ...defaults };

  // allowlist
  if ('allowlist' in obj) {
    if (!isStringArray(obj['allowlist'])) {
      errors.push({ field: 'allowlist', message: 'Must be an array of strings' });
    } else {
      config.allowlist = obj['allowlist'];
    }
  }

  // blockOn
  if ('blockOn' in obj) {
    if (!isStringArray(obj['blockOn'])) {
      errors.push({ field: 'blockOn', message: 'Must be an array of strings' });
    } else {
      const invalid = obj['blockOn'].filter((v) => !VALID_RISK_LEVELS.has(v));
      if (invalid.length > 0) {
        errors.push({ field: 'blockOn', message: `Invalid values: ${invalid.join(', ')}. Must be critical|high|medium|low` });
      } else {
        config.blockOn = obj['blockOn'] as RiskLevelName[];
      }
    }
  }

  // registry
  if ('registry' in obj) {
    if (!isString(obj['registry'])) {
      errors.push({ field: 'registry', message: 'Must be a string URL' });
    } else {
      try {
        new URL(obj['registry']);
        config.registry = obj['registry'];
      } catch {
        errors.push({ field: 'registry', message: 'Must be a valid URL' });
      }
    }
  }

  // ci
  if ('ci' in obj) {
    const ci = obj['ci'];
    if (typeof ci !== 'object' || ci === null || Array.isArray(ci)) {
      errors.push({ field: 'ci', message: 'Must be an object' });
    } else {
      const ciObj = ci as Record<string, unknown>;
      if ('warnAction' in ciObj) {
        if (!isString(ciObj['warnAction']) || !VALID_WARN_ACTIONS.has(ciObj['warnAction'])) {
          errors.push({ field: 'ci.warnAction', message: 'Must be block|warn|allow' });
        } else {
          config.ci.warnAction = ciObj['warnAction'] as WarnAction;
        }
      }
      if ('outputFormat' in ciObj) {
        if (!isString(ciObj['outputFormat']) || !VALID_OUTPUT_FORMATS.has(ciObj['outputFormat'])) {
          errors.push({ field: 'ci.outputFormat', message: 'Must be text|json' });
        } else {
          config.ci.outputFormat = ciObj['outputFormat'] as OutputFormat;
        }
      }
    }
  }

  return { config, errors };
}

export function defaultConfig(): CicurityConfig {
  return {
    allowlist: [],
    blockOn: ['critical', 'high'],
    ci: {
      warnAction: 'block',
      outputFormat: 'text',
    },
    registry: 'https://registry.npmjs.org',
  };
}

/**
 * Returns true if a package specifier matches an allowlist entry.
 * Supports exact "name@version" and wildcard "name@*".
 */
export function isAllowlisted(name: string, version: string, allowlist: string[]): boolean {
  const exact = `${name}@${version}`;
  const wildcard = `${name}@*`;
  return allowlist.includes(exact) || allowlist.includes(wildcard);
}
