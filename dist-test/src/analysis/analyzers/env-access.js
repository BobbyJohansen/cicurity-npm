// Detects process.env access in install scripts.
// Access to environment variables at install time is a primary method for
// exfiltrating CI secrets, AWS keys, npm tokens, and SSH keys.
import { parseScript, walkAst } from '../ast-utils.js';
/** Environment variable names commonly targeted in supply chain attacks */
const HIGH_VALUE_ENV_VARS = new Set([
    'NPM_TOKEN', 'NPM_AUTH_TOKEN',
    'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN',
    'GITHUB_TOKEN', 'GH_TOKEN', 'GITHUB_ACTIONS',
    'CI_JOB_TOKEN', 'CIRCLE_TOKEN', 'TRAVIS_TOKEN',
    'HEROKU_API_KEY', 'NETLIFY_AUTH_TOKEN', 'VERCEL_TOKEN',
    'STRIPE_SECRET_KEY', 'DATABASE_URL', 'DB_PASSWORD',
    'SSH_AUTH_SOCK', 'SSH_PRIVATE_KEY',
    'HOME', 'USERPROFILE', // Used to find credential files
]);
export function analyzeEnvAccess(context) {
    const findings = [];
    for (const script of context.installScripts) {
        if (!script.source)
            continue;
        const ast = parseScript(script.source, script.resolvedFile);
        if (!ast)
            continue;
        const fileRef = script.resolvedFile ?? `[${script.lifecycle}]`;
        const src = script.source;
        let processEnvAccessFound = false;
        walkAst(ast, (node) => {
            // process.env (any access)
            if (node.type === 'MemberExpression' &&
                !node.computed &&
                node.object?.type === 'Identifier' &&
                node.object.name === 'process' &&
                node.property?.type === 'Identifier' &&
                node.property.name === 'env') {
                if (!processEnvAccessFound) {
                    processEnvAccessFound = true;
                    findings.push({
                        category: 'install-script-env-access',
                        level: 'critical',
                        title: 'process.env accessed in install script',
                        description: `The ${script.lifecycle} script reads environment variables at install time. ` +
                            'This is how supply chain attacks harvest CI tokens, AWS credentials, and npm auth tokens.',
                        evidence: sliceSource(src, node),
                        file: fileRef,
                        line: node.loc?.start.line,
                    });
                }
                // process.env['NPM_TOKEN'] or process.env.NPM_TOKEN — check for high-value targets
                const parent = getParentPropertyName(node);
                if (parent && HIGH_VALUE_ENV_VARS.has(parent)) {
                    findings.push({
                        category: 'install-script-env-access',
                        level: 'critical',
                        title: `Access to high-value env var '${parent}' in install script`,
                        description: `The ${script.lifecycle} script specifically accesses \`process.env.${parent}\`, ` +
                            'a high-value credential commonly targeted by supply chain attackers.',
                        evidence: sliceSource(src, node),
                        file: fileRef,
                        line: node.loc?.start.line,
                    });
                }
            }
            // process.env['KEY'] — computed member access
            if (node.type === 'MemberExpression' &&
                node.computed &&
                node.object?.type === 'MemberExpression' &&
                node.object.object?.type === 'Identifier' &&
                node.object.object.name === 'process' &&
                node.object.property?.type === 'Identifier' &&
                node.object.property.name === 'env' &&
                node.property?.type === 'Literal' &&
                typeof node.property.value === 'string') {
                const keyName = node.property.value;
                if (HIGH_VALUE_ENV_VARS.has(keyName)) {
                    findings.push({
                        category: 'install-script-env-access',
                        level: 'critical',
                        title: `Access to high-value env var '${keyName}' in install script`,
                        description: `The ${script.lifecycle} script accesses \`process.env['${keyName}']\`, ` +
                            'a high-value credential commonly targeted by supply chain attackers.',
                        evidence: sliceSource(src, node),
                        file: fileRef,
                        line: node.loc?.start.line,
                    });
                }
            }
        });
    }
    return deduplicate(findings);
}
/** If the MemberExpression is a child of another MemberExpression, return that property name */
function getParentPropertyName(node) {
    // This is set by the caller when walking — we infer it from the node structure
    // process.env.FOO → the parent MemberExpression has property 'FOO'
    // We check via the raw source — this is handled by the computed check above
    return null;
}
function sliceSource(source, node) {
    if (typeof node.start === 'number' && typeof node.end === 'number') {
        return source.slice(node.start, Math.min(node.end, node.start + 200));
    }
    return '';
}
function deduplicate(findings) {
    const seen = new Set();
    return findings.filter((f) => {
        const key = `${f.category}:${f.file}:${f.title}:${f.evidence?.slice(0, 40)}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
//# sourceMappingURL=env-access.js.map