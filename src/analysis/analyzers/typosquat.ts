// Detects typosquatting by comparing package names against the top-500 npm packages
// using Levenshtein distance. Distance ≤ 2 (but > 0) is flagged.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import type { AnalysisContext, Finding } from '../types.js';

const _require = createRequire(import.meta.url);
const DATA_PATH = path.resolve(
  fileURLToPath(import.meta.url),
  '../../../../data/top-500-packages.json',
);

let cachedTop500: string[] | null = null;

function loadTop500(): string[] {
  if (cachedTop500) return cachedTop500;
  try {
    cachedTop500 = _require(DATA_PATH) as string[];
    return cachedTop500;
  } catch {
    // Data file missing - skip typosquat check gracefully
    return [];
  }
}

/** Iterative Levenshtein distance, O(m*n) time, O(n) space */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (curr[j - 1] ?? j) + 1,
        (prev[j] ?? i) + 1,
        (prev[j - 1] ?? i - 1) + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[b.length] ?? Math.max(a.length, b.length);
}

export function analyzeTyposquat(context: AnalysisContext): Finding[] {
  const findings: Finding[] = [];
  const top500 = loadTop500();

  if (top500.length === 0) return findings;

  const name = context.packageName;

  // Strip scope from scoped packages for comparison: @scope/name → name
  const bareName = name.startsWith('@') ? (name.split('/')[1] ?? name) : name;

  for (const popular of top500) {
    if (name === popular) return []; // Exact match to a popular package - not a typosquat

    const popularBareName = popular.startsWith('@')
      ? (popular.split('/')[1] ?? popular)
      : popular;

    const dist = levenshtein(bareName.toLowerCase(), popularBareName.toLowerCase());

    if (dist > 0 && dist <= 2) {
      findings.push({
        category: 'typosquatting',
        level: 'high',
        title: `Package name is similar to '${popular}' (edit distance: ${dist})`,
        description:
          `'${name}' is very similar to the popular package '${popular}' (Levenshtein distance ${dist}). ` +
          'This may be a typosquatting attack designed to be installed by accident.',
        evidence: `${name} vs ${popular}`,
      });
      // Report the closest match only - avoid flooding findings
      break;
    }
  }

  return findings;
}
