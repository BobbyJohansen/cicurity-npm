// Detects filesystem access in install scripts.
// Malware reads credential files (~/.ssh, ~/.aws/credentials) or writes backdoors
// to shell profiles (.bashrc, .zshrc). The node-ipc attack wrote destructively to the fs.
import { parseScript, walkAst } from '../ast-utils.js';
/** fs method names that read from the filesystem */
const FS_READ_METHODS = new Set([
    'readFile', 'readFileSync', 'createReadStream',
    'readdir', 'readdirSync', 'readlink', 'readlinkSync',
    'stat', 'statSync', 'lstat', 'lstatSync',
]);
/** fs method names that write to the filesystem */
const FS_WRITE_METHODS = new Set([
    'writeFile', 'writeFileSync', 'appendFile', 'appendFileSync',
    'createWriteStream', 'copyFile', 'copyFileSync',
    'rename', 'renameSync', 'unlink', 'unlinkSync',
    'chmod', 'chmodSync', 'chown', 'chownSync',
    'mkdir', 'mkdirSync', 'symlink', 'symlinkSync',
]);
/** Path fragments that indicate credential files */
const CREDENTIAL_PATHS = [
    '.ssh', '.aws', '.npmrc', '.netrc', '.gnupg', '.gpg',
    'id_rsa', 'id_ed25519', 'id_ecdsa', 'authorized_keys', 'known_hosts',
    'credentials', 'config', '.pypirc', '.docker', 'keychain',
];
/** Path fragments that indicate shell persistence targets */
const SHELL_PROFILE_PATHS = [
    '.bashrc', '.zshrc', '.profile', '.bash_profile', '.bash_login',
    '.zprofile', '.zlogin', '.zshenv', '.config/fish', '.tcshrc', '.cshrc',
];
export function analyzeFilesystem(context) {
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
            // require('fs') or require('node:fs') or require('fs/promises')
            if (isFsRequire(node)) {
                findings.push({
                    category: 'install-script-fs-access',
                    level: 'medium',
                    title: 'Filesystem module loaded in install script',
                    description: `The ${script.lifecycle} script loads the 'fs' module. Filesystem access ` +
                        'in install scripts is unusual and can be used to read credentials or write backdoors.',
                    evidence: sliceSource(src, node),
                    file: fileRef,
                    line: node.loc?.start.line,
                });
            }
            // fs.readFile(), fs.writeFile(), etc.
            if (node.type === 'CallExpression' &&
                node.callee?.type === 'MemberExpression' &&
                node.callee.property?.type === 'Identifier') {
                const method = node.callee.property.name ?? '';
                if (FS_READ_METHODS.has(method)) {
                    const pathArg = extractStringArg(node.arguments?.[0]);
                    const credentialPath = pathArg ? matchesCredentialPath(pathArg) : null;
                    const shellPath = pathArg ? matchesShellProfilePath(pathArg) : null;
                    if (credentialPath) {
                        findings.push({
                            category: 'install-script-fs-access',
                            level: 'critical',
                            title: `Credential file read in install script: ${credentialPath}`,
                            description: `The ${script.lifecycle} script reads from a credential file path ('${pathArg}'). ` +
                                'This is a strong signal of credential theft.',
                            evidence: sliceSource(src, node),
                            file: fileRef,
                            line: node.loc?.start.line,
                        });
                    }
                    else if (shellPath) {
                        findings.push({
                            category: 'install-script-fs-access',
                            level: 'critical',
                            title: `Shell profile read in install script: ${shellPath}`,
                            description: `The ${script.lifecycle} script reads a shell config file ('${pathArg}'), ` +
                                'possibly to extract aliases, tokens, or environment setup.',
                            evidence: sliceSource(src, node),
                            file: fileRef,
                            line: node.loc?.start.line,
                        });
                    }
                    else {
                        findings.push({
                            category: 'install-script-fs-access',
                            level: 'high',
                            title: `fs.${method}() called in install script`,
                            description: `The ${script.lifecycle} script reads from the filesystem using \`${method}()\`. ` +
                                'Install scripts should not need to read arbitrary files.',
                            evidence: sliceSource(src, node),
                            file: fileRef,
                            line: node.loc?.start.line,
                        });
                    }
                }
                if (FS_WRITE_METHODS.has(method)) {
                    const pathArg = extractStringArg(node.arguments?.[0]);
                    const credentialPath = pathArg ? matchesCredentialPath(pathArg) : null;
                    const shellPath = pathArg ? matchesShellProfilePath(pathArg) : null;
                    if (shellPath) {
                        findings.push({
                            category: 'install-script-fs-access',
                            level: 'critical',
                            title: `Shell profile modified in install script: ${shellPath}`,
                            description: `The ${script.lifecycle} script writes to a shell config file ('${pathArg}'). ` +
                                'This is the canonical persistence technique - injecting malicious code that runs on every shell start.',
                            evidence: sliceSource(src, node),
                            file: fileRef,
                            line: node.loc?.start.line,
                        });
                    }
                    else if (credentialPath) {
                        findings.push({
                            category: 'install-script-fs-access',
                            level: 'critical',
                            title: `Credential file written in install script: ${credentialPath}`,
                            description: `The ${script.lifecycle} script writes to a credential path ('${pathArg}'). ` +
                                'This could corrupt credentials or implant backdoor credentials.',
                            evidence: sliceSource(src, node),
                            file: fileRef,
                            line: node.loc?.start.line,
                        });
                    }
                    else {
                        findings.push({
                            category: 'install-script-fs-access',
                            level: 'high',
                            title: `fs.${method}() called in install script`,
                            description: `The ${script.lifecycle} script writes to the filesystem using \`${method}()\`. ` +
                                'Writing files at install time can be used to drop backdoors or modify system config.',
                            evidence: sliceSource(src, node),
                            file: fileRef,
                            line: node.loc?.start.line,
                        });
                    }
                }
            }
            // Direct calls: readFileSync(...), writeFileSync(...) without fs. prefix
            if (node.type === 'CallExpression' &&
                node.callee?.type === 'Identifier') {
                const name = node.callee.name ?? '';
                if (FS_READ_METHODS.has(name) || FS_WRITE_METHODS.has(name)) {
                    const pathArg = extractStringArg(node.arguments?.[0]);
                    const credentialPath = pathArg ? matchesCredentialPath(pathArg) : null;
                    const shellPath = pathArg ? matchesShellProfilePath(pathArg) : null;
                    const isWrite = FS_WRITE_METHODS.has(name);
                    if (credentialPath || shellPath) {
                        findings.push({
                            category: 'install-script-fs-access',
                            level: 'critical',
                            title: `${name}() targeting sensitive path in install script`,
                            description: `The ${script.lifecycle} script calls \`${name}()\` with a sensitive path ('${pathArg ?? ''}'). ` +
                                (isWrite ? 'Writing to this location is a persistence or sabotage technique.' : 'Reading from this location is a credential theft technique.'),
                            evidence: sliceSource(src, node),
                            file: fileRef,
                            line: node.loc?.start.line,
                        });
                    }
                }
            }
        });
    }
    return deduplicate(findings);
}
function isFsRequire(node) {
    if (node.type === 'CallExpression' &&
        node.callee?.type === 'Identifier' &&
        node.callee.name === 'require' &&
        node.arguments?.[0]?.type === 'Literal' &&
        typeof node.arguments[0].value === 'string') {
        const mod = node.arguments[0].value;
        return mod === 'fs' || mod === 'node:fs' || mod === 'fs/promises' || mod === 'node:fs/promises';
    }
    return false;
}
function extractStringArg(node) {
    if (!node)
        return null;
    if (node.type === 'Literal' && typeof node.value === 'string')
        return node.value;
    // BinaryExpression: path.join(...) or string + string - extract any string literal parts
    if (node.type === 'BinaryExpression' && node.operator === '+') {
        const left = extractStringArg(node.left);
        const right = extractStringArg(node.right);
        if (left || right)
            return `${left ?? ''}${right ?? ''}`;
    }
    return null;
}
function matchesCredentialPath(pathArg) {
    const lower = pathArg.toLowerCase();
    for (const fragment of CREDENTIAL_PATHS) {
        if (lower.includes(fragment))
            return fragment;
    }
    return null;
}
function matchesShellProfilePath(pathArg) {
    const lower = pathArg.toLowerCase();
    for (const fragment of SHELL_PROFILE_PATHS) {
        if (lower.includes(fragment))
            return fragment;
    }
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
        const key = `${f.category}:${f.title}:${f.file}:${f.line}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
//# sourceMappingURL=filesystem.js.map