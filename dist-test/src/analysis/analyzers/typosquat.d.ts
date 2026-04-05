import type { AnalysisContext, Finding } from '../types.js';
/** Iterative Levenshtein distance, O(m*n) time, O(n) space */
export declare function levenshtein(a: string, b: string): number;
export declare function analyzeTyposquat(context: AnalysisContext): Finding[];
//# sourceMappingURL=typosquat.d.ts.map