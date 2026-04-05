// Manual cicurity.config.json validator - no zod dependency.
function isString(v) {
    return typeof v === 'string';
}
function isStringArray(v) {
    return Array.isArray(v) && v.every(isString);
}
const VALID_RISK_LEVELS = new Set(['critical', 'high', 'medium', 'low']);
const VALID_WARN_ACTIONS = new Set(['block', 'warn', 'allow']);
const VALID_OUTPUT_FORMATS = new Set(['text', 'json']);
/**
 * Validates a parsed JSON object against the CicurityConfig schema.
 * Returns the validated config and any errors found.
 */
export function validateConfig(raw) {
    const errors = [];
    const defaults = defaultConfig();
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return {
            config: defaults,
            errors: [{ field: 'root', message: 'Config must be a JSON object' }],
        };
    }
    const obj = raw;
    const config = { ...defaults };
    // allowlist
    if ('allowlist' in obj) {
        if (!isStringArray(obj['allowlist'])) {
            errors.push({ field: 'allowlist', message: 'Must be an array of strings' });
        }
        else {
            config.allowlist = obj['allowlist'];
        }
    }
    // blockOn
    if ('blockOn' in obj) {
        if (!isStringArray(obj['blockOn'])) {
            errors.push({ field: 'blockOn', message: 'Must be an array of strings' });
        }
        else {
            const invalid = obj['blockOn'].filter((v) => !VALID_RISK_LEVELS.has(v));
            if (invalid.length > 0) {
                errors.push({ field: 'blockOn', message: `Invalid values: ${invalid.join(', ')}. Must be critical|high|medium|low` });
            }
            else {
                config.blockOn = obj['blockOn'];
            }
        }
    }
    // registry
    if ('registry' in obj) {
        if (!isString(obj['registry'])) {
            errors.push({ field: 'registry', message: 'Must be a string URL' });
        }
        else {
            try {
                new URL(obj['registry']);
                config.registry = obj['registry'];
            }
            catch {
                errors.push({ field: 'registry', message: 'Must be a valid URL' });
            }
        }
    }
    // ci
    if ('ci' in obj) {
        const ci = obj['ci'];
        if (typeof ci !== 'object' || ci === null || Array.isArray(ci)) {
            errors.push({ field: 'ci', message: 'Must be an object' });
        }
        else {
            const ciObj = ci;
            if ('warnAction' in ciObj) {
                if (!isString(ciObj['warnAction']) || !VALID_WARN_ACTIONS.has(ciObj['warnAction'])) {
                    errors.push({ field: 'ci.warnAction', message: 'Must be block|warn|allow' });
                }
                else {
                    config.ci.warnAction = ciObj['warnAction'];
                }
            }
            if ('outputFormat' in ciObj) {
                if (!isString(ciObj['outputFormat']) || !VALID_OUTPUT_FORMATS.has(ciObj['outputFormat'])) {
                    errors.push({ field: 'ci.outputFormat', message: 'Must be text|json' });
                }
                else {
                    config.ci.outputFormat = ciObj['outputFormat'];
                }
            }
        }
    }
    return { config, errors };
}
export function defaultConfig() {
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
export function isAllowlisted(name, version, allowlist) {
    const exact = `${name}@${version}`;
    const wildcard = `${name}@*`;
    return allowlist.includes(exact) || allowlist.includes(wildcard);
}
//# sourceMappingURL=config-validator.js.map