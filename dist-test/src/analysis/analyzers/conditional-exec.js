// Detects CI-targeted conditional execution in install scripts.
// Sophisticated malware only runs on CI to avoid detection during local dev installs.
// Checks for CI env var checks (process.env.CI, GITHUB_ACTIONS, etc.) that guard a payload.
import { parseScript, walkAst } from '../ast-utils.js';
/** CI-specific environment variable names that indicate conditional targeting */
const CI_ENV_VARS = new Set([
    'CI', 'GITHUB_ACTIONS', 'GITHUB_ENV', 'GITHUB_WORKSPACE',
    'JENKINS_URL', 'JENKINS_HOME',
    'GITLAB_CI', 'CI_SERVER',
    'CIRCLECI',
    'TRAVIS', 'TRAVIS_BUILD_DIR',
    'BUILDKITE',
    'TEAMCITY_VERSION',
    'TF_BUILD', // Azure DevOps
    'BITBUCKET_BUILD_NUMBER',
    'DRONE',
    'CODEBUILD_BUILD_ID', // AWS CodeBuild
]);
/** process.env property access - returns the property name if it matches a CI var */
function getCiEnvVar(node) {
    if (node.type === 'MemberExpression' &&
        node.object?.type === 'MemberExpression' &&
        node.object.object?.type === 'Identifier' &&
        node.object.object.name === 'process' &&
        node.object.property?.type === 'Identifier' &&
        node.object.property.name === 'env' &&
        node.property?.type === 'Identifier' &&
        CI_ENV_VARS.has(node.property.name ?? '')) {
        return node.property.name ?? null;
    }
    return null;
}
/** Checks if a node is inside an IfStatement test, ConditionalExpression test,
 *  or logical expression (&&, ||, ??) - i.e. used as a condition */
function isConditionalContext(node, ast) {
    let found = false;
    walkAst(ast, (n) => {
        if (found)
            return;
        if ((n.type === 'IfStatement' || n.type === 'ConditionalExpression') &&
            containsNode(n.test, node)) {
            found = true;
        }
        if ((n.type === 'LogicalExpression') &&
            (containsNode(n.left, node) || containsNode(n.right, node))) {
            found = true;
        }
    });
    return found;
}
function containsNode(subtree, target) {
    if (!subtree)
        return false;
    if (subtree === target)
        return true;
    for (const key of Object.keys(subtree)) {
        if (key === 'loc' || key === 'start' || key === 'end' || key === 'type')
            continue;
        const child = subtree[key];
        if (Array.isArray(child)) {
            for (const item of child) {
                if (item && typeof item === 'object' && 'type' in item) {
                    if (containsNode(item, target))
                        return true;
                }
            }
        }
        else if (child && typeof child === 'object' && 'type' in child) {
            if (containsNode(child, target))
                return true;
        }
    }
    return false;
}
export function analyzeConditionalExec(context) {
    const findings = [];
    for (const script of context.installScripts) {
        if (!script.source)
            continue;
        const ast = parseScript(script.source, script.resolvedFile);
        if (!ast)
            continue;
        const src = script.source;
        const fileRef = script.resolvedFile ?? `[${script.lifecycle}]`;
        const ciVarsFound = [];
        // First pass: collect all CI env var accesses
        walkAst(ast, (node) => {
            const varName = getCiEnvVar(node);
            if (varName) {
                ciVarsFound.push({ varName, node });
            }
        });
        // For each CI var access, check if it's used in a conditional context
        for (const { varName, node } of ciVarsFound) {
            if (isConditionalContext(node, ast)) {
                findings.push({
                    category: 'install-script-conditional-exec',
                    level: 'high',
                    title: `CI environment check found in install script (process.env.${varName})`,
                    description: `The ${script.lifecycle} script checks \`process.env.${varName}\` inside a conditional. ` +
                        'Malware often guards its payload behind CI env var checks to run only in CI pipelines ' +
                        'and avoid detection during local developer installs.',
                    evidence: sliceSource(src, node),
                    file: fileRef,
                    line: node.loc?.start.line,
                });
            }
        }
    }
    return deduplicate(findings);
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
        const key = `${f.category}:${f.file}:${f.line}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
//# sourceMappingURL=conditional-exec.js.map