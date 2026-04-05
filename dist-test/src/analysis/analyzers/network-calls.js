// Detects network calls in install scripts using AST traversal.
// Network calls in install scripts are the primary exfiltration vector.
import { parseScript, walkAst } from '../ast-utils.js';
/** Known HTTP client module names that indicate network access */
const HTTP_MODULES = new Set([
    'http', 'https', 'node:http', 'node:https',
    'net', 'node:net',
    'node-fetch', 'axios', 'got', 'undici', 'superagent', 'request',
    'cross-fetch', 'isomorphic-fetch', 'whatwg-fetch',
]);
/** Global fetch-like function names */
const FETCH_GLOBALS = new Set(['fetch', 'XMLHttpRequest', 'WebSocket']);
export function analyzeNetworkCalls(context) {
    const findings = [];
    for (const script of context.installScripts) {
        if (!script.source)
            continue;
        const ast = parseScript(script.source, script.resolvedFile);
        if (!ast)
            continue;
        walkAst(ast, (node) => {
            // require('http'), require('https'), require('node-fetch'), etc.
            if (isRequireCall(node, HTTP_MODULES)) {
                const moduleName = getRequireArg(node);
                findings.push({
                    category: 'install-script-network',
                    level: 'critical',
                    title: 'Network module loaded in install script',
                    description: `The ${script.lifecycle} script loads the '${moduleName}' module, which enables network access.`,
                    evidence: extractEvidence(script.source, node),
                    file: script.resolvedFile ?? `[${script.lifecycle}]`,
                    line: node.loc?.start.line,
                });
            }
            // import('http'), import('https'), etc.
            if (isDynamicImport(node, HTTP_MODULES)) {
                const moduleName = getDynamicImportArg(node);
                findings.push({
                    category: 'install-script-network',
                    level: 'critical',
                    title: 'Network module dynamically imported in install script',
                    description: `The ${script.lifecycle} script dynamically imports '${moduleName}'.`,
                    evidence: extractEvidence(script.source, node),
                    file: script.resolvedFile ?? `[${script.lifecycle}]`,
                    line: node.loc?.start.line,
                });
            }
            // fetch(), new XMLHttpRequest(), new WebSocket()
            if (isGlobalNetworkCall(node, FETCH_GLOBALS)) {
                const name = getGlobalName(node);
                findings.push({
                    category: 'install-script-network',
                    level: 'critical',
                    title: `Network call via '${name}' in install script`,
                    description: `The ${script.lifecycle} script calls '${name}', making a direct network request.`,
                    evidence: extractEvidence(script.source, node),
                    file: script.resolvedFile ?? `[${script.lifecycle}]`,
                    line: node.loc?.start.line,
                });
            }
            // Hardcoded http:// or https:// URLs as string literals are suspicious in install scripts
            if (node.type === 'Literal' && typeof node.value === 'string') {
                const url = node.value;
                if (/^https?:\/\/[^\s]{5,}/.test(url)) {
                    findings.push({
                        category: 'install-script-network',
                        level: 'high',
                        title: 'Hardcoded URL in install script',
                        description: `The ${script.lifecycle} script contains a hardcoded URL, potentially for data exfiltration or payload download.`,
                        evidence: url,
                        file: script.resolvedFile ?? `[${script.lifecycle}]`,
                        line: node.loc?.start.line,
                    });
                }
            }
        });
    }
    return deduplicate(findings);
}
function isRequireCall(node, modules) {
    return (node.type === 'CallExpression' &&
        node.callee?.type === 'Identifier' &&
        node.callee.name === 'require' &&
        node.arguments?.length === 1 &&
        node.arguments[0]?.type === 'Literal' &&
        typeof node.arguments[0].value === 'string' &&
        modules.has(node.arguments[0].value));
}
function getRequireArg(node) {
    return node.arguments?.[0]?.value ?? '';
}
function isDynamicImport(node, modules) {
    return (node.type === 'ImportExpression' &&
        node.source?.type === 'Literal' &&
        typeof node.source.value === 'string' &&
        modules.has(node.source.value));
}
function getDynamicImportArg(node) {
    return node.source?.value ?? '';
}
function isGlobalNetworkCall(node, globals) {
    // fetch(url) or new XMLHttpRequest()
    if (node.type === 'CallExpression' &&
        node.callee?.type === 'Identifier' &&
        globals.has(node.callee.name ?? ''))
        return true;
    if (node.type === 'NewExpression' &&
        node.callee?.type === 'Identifier' &&
        globals.has(node.callee.name ?? ''))
        return true;
    return false;
}
function getGlobalName(node) {
    return node.callee?.name ?? '';
}
function extractEvidence(source, node) {
    if (!node.loc)
        return '';
    const lines = source.split('\n');
    const line = lines[node.loc.start.line - 1] ?? '';
    return line.trim().slice(0, 200);
}
function deduplicate(findings) {
    const seen = new Set();
    return findings.filter((f) => {
        const key = `${f.category}:${f.file}:${f.line}:${f.evidence?.slice(0, 50)}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
//# sourceMappingURL=network-calls.js.map