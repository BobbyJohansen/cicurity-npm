// Detects child_process usage in install scripts.
// Spawning subprocesses at install time enables arbitrary command execution.
import { parseScript, walkAst } from '../ast-utils.js';
const CHILD_PROCESS_METHODS = new Set([
    'exec', 'execSync', 'execFile', 'execFileSync',
    'spawn', 'spawnSync',
    'fork',
]);
const SHELL_METHODS = new Set(['system', 'popen']);
export function analyzeChildProcess(context) {
    const findings = [];
    for (const script of context.installScripts) {
        if (!script.source)
            continue;
        const ast = parseScript(script.source, script.resolvedFile);
        if (!ast)
            continue;
        const src = script.source;
        const fileRef = script.resolvedFile ?? `[${script.lifecycle}]`;
        walkAst(ast, (node) => {
            // require('child_process') or require('node:child_process')
            if (node.type === 'CallExpression' &&
                node.callee?.type === 'Identifier' &&
                node.callee.name === 'require' &&
                node.arguments?.[0]?.type === 'Literal' &&
                typeof node.arguments[0].value === 'string' &&
                (node.arguments[0].value === 'child_process' ||
                    node.arguments[0].value === 'node:child_process')) {
                findings.push({
                    category: 'install-script-child-process',
                    level: 'high',
                    title: 'child_process module loaded in install script',
                    description: `The ${script.lifecycle} script loads the 'child_process' module, enabling ` +
                        'arbitrary command execution on the host system.',
                    evidence: sliceSource(src, node),
                    file: fileRef,
                    line: node.loc?.start.line,
                });
            }
            // exec(), spawn(), execSync(), etc. - direct calls (may be destructured)
            if (node.type === 'CallExpression' &&
                node.callee?.type === 'Identifier' &&
                CHILD_PROCESS_METHODS.has(node.callee.name ?? '')) {
                const methodName = node.callee.name ?? 'unknown';
                findings.push({
                    category: 'install-script-child-process',
                    level: 'high',
                    title: `${methodName}() called in install script`,
                    description: `The ${script.lifecycle} script calls \`${methodName}()\`, executing a ` +
                        'shell command at install time.',
                    evidence: sliceSource(src, node),
                    file: fileRef,
                    line: node.loc?.start.line,
                });
            }
            // cp.exec(), childProcess.spawn(), etc. - member calls
            if (node.type === 'CallExpression' &&
                node.callee?.type === 'MemberExpression' &&
                node.callee.property?.type === 'Identifier' &&
                CHILD_PROCESS_METHODS.has(node.callee.property.name ?? '')) {
                const method = node.callee.property.name ?? 'unknown';
                findings.push({
                    category: 'install-script-child-process',
                    level: 'high',
                    title: `.${method}() called in install script`,
                    description: `The ${script.lifecycle} script calls \`.${method}()\` to execute a command.`,
                    evidence: sliceSource(src, node),
                    file: fileRef,
                    line: node.loc?.start.line,
                });
            }
        });
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
//# sourceMappingURL=child-process.js.map