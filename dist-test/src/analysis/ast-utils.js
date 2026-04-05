// Shared AST parsing and traversal utilities.
// Uses the vendored acorn parser.
// @ts-ignore — vendored ESM module
import * as acorn from '../vendor/acorn/acorn.mjs';
/**
 * Parses JavaScript source code into an AST.
 * Returns null if parsing fails (malformed/minified code).
 * Tries modern syntax first, falls back to older for compatibility.
 */
export function parseScript(source, filePath) {
    const parseOptions = {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true,
        allowHashBang: true,
        allowAwaitOutsideFunction: true,
        allowImportExportEverywhere: true,
    };
    try {
        return acorn.parse(source, parseOptions);
    }
    catch {
        // Fall back to script mode (CommonJS)
        try {
            return acorn.parse(source, { ...parseOptions, sourceType: 'script' });
        }
        catch {
            // Parsing failed (obfuscated, minified, syntax error) — not parseable
            return null;
        }
    }
}
/**
 * Walks an AST depth-first, calling visitor on every node.
 * Skips null/undefined values and primitive children.
 */
export function walkAst(node, visitor, parent = null) {
    if (!node || typeof node !== 'object')
        return;
    visitor(node, parent);
    for (const key of Object.keys(node)) {
        if (key === 'loc' || key === 'start' || key === 'end' || key === 'type')
            continue;
        const child = node[key];
        if (Array.isArray(child)) {
            for (const item of child) {
                if (item && typeof item === 'object' && 'type' in item) {
                    walkAst(item, visitor, node);
                }
            }
        }
        else if (child && typeof child === 'object' && 'type' in child) {
            walkAst(child, visitor, node);
        }
    }
}
/**
 * Calculates Shannon entropy of a string (bits per character).
 * High entropy (> 4.5) is a signal for base64/hex encoded payloads.
 */
export function shannonEntropy(s) {
    if (s.length === 0)
        return 0;
    const freq = new Map();
    for (const ch of s) {
        freq.set(ch, (freq.get(ch) ?? 0) + 1);
    }
    let entropy = 0;
    for (const count of freq.values()) {
        const p = count / s.length;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}
//# sourceMappingURL=ast-utils.js.map