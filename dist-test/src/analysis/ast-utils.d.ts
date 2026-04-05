export interface AcornNode {
    type: string;
    start: number;
    end: number;
    loc?: {
        start: {
            line: number;
            column: number;
        };
        end: {
            line: number;
            column: number;
        };
    };
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
export declare function parseScript(source: string, filePath?: string): ParseResult | null;
type Visitor = (node: AcornNode, parent: AcornNode | null) => void;
/**
 * Walks an AST depth-first, calling visitor on every node.
 * Skips null/undefined values and primitive children.
 */
export declare function walkAst(node: AcornNode | ParseResult | null | undefined, visitor: Visitor, parent?: AcornNode | null): void;
/**
 * Calculates Shannon entropy of a string (bits per character).
 * High entropy (> 4.5) is a signal for base64/hex encoded payloads.
 */
export declare function shannonEntropy(s: string): number;
export {};
//# sourceMappingURL=ast-utils.d.ts.map