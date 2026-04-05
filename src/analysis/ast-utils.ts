// Shared AST parsing and traversal utilities.
// Uses the vendored acorn parser.

// @ts-ignore — vendored ESM module
import * as acorn from '../vendor/acorn/acorn.mjs';

export interface AcornNode {
  type: string;
  start: number;
  end: number;
  loc?: { start: { line: number; column: number }; end: { line: number; column: number } };
  // Common child node fields
  body?: AcornNode | AcornNode[];
  expression?: AcornNode;
  callee?: AcornNode;
  arguments?: AcornNode[];
  source?: AcornNode;
  value?: unknown;
  name?: string;
  object?: AcornNode;
  property?: AcornNode;
  left?: AcornNode;
  right?: AcornNode;
  argument?: AcornNode;
  init?: AcornNode;
  test?: AcornNode;
  consequent?: AcornNode | AcornNode[];
  alternate?: AcornNode;
  declarations?: AcornNode[];
  id?: AcornNode;
  params?: AcornNode[];
  [key: string]: unknown;
}

interface ParseResult {
  type: 'Program';
  body: AcornNode[];
  [key: string]: unknown;
}

/**
 * Parses JavaScript source code into an AST.
 * Returns null if parsing fails (malformed/minified code).
 * Tries modern syntax first, falls back to older for compatibility.
 */
export function parseScript(source: string, filePath?: string): ParseResult | null {
  const parseOptions = {
    ecmaVersion: 'latest' as const,
    sourceType: 'module' as const,
    locations: true,
    allowHashBang: true,
    allowAwaitOutsideFunction: true,
    allowImportExportEverywhere: true,
  };

  try {
    return acorn.parse(source, parseOptions) as unknown as ParseResult;
  } catch {
    // Fall back to script mode (CommonJS)
    try {
      return acorn.parse(source, { ...parseOptions, sourceType: 'script' as const }) as unknown as ParseResult;
    } catch {
      // Parsing failed (obfuscated, minified, syntax error) — not parseable
      return null;
    }
  }
}

type Visitor = (node: AcornNode, parent: AcornNode | null) => void;

/**
 * Walks an AST depth-first, calling visitor on every node.
 * Skips null/undefined values and primitive children.
 */
export function walkAst(
  node: AcornNode | ParseResult | null | undefined,
  visitor: Visitor,
  parent: AcornNode | null = null,
): void {
  if (!node || typeof node !== 'object') return;

  visitor(node as AcornNode, parent);

  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'type') continue;
    const child = (node as Record<string, unknown>)[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && 'type' in item) {
          walkAst(item as AcornNode, visitor, node as AcornNode);
        }
      }
    } else if (child && typeof child === 'object' && 'type' in child) {
      walkAst(child as AcornNode, visitor, node as AcornNode);
    }
  }
}

/**
 * Calculates Shannon entropy of a string (bits per character).
 * High entropy (> 4.5) is a signal for base64/hex encoded payloads.
 */
export function shannonEntropy(s: string): number {
  if (s.length === 0) return 0;
  const freq = new Map<string, number>();
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
