import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { levenshtein } from '../../../src/analysis/analyzers/typosquat.js';

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    assert.equal(levenshtein('lodash', 'lodash'), 0);
  });

  it('returns string length for empty comparison', () => {
    assert.equal(levenshtein('', 'abc'), 3);
    assert.equal(levenshtein('abc', ''), 3);
  });

  it('detects single character substitution', () => {
    assert.equal(levenshtein('1odash', 'lodash'), 1);  // l → 1
  });

  it('detects single character omission', () => {
    assert.equal(levenshtein('expres', 'express'), 1);
  });

  it('detects single character addition', () => {
    assert.equal(levenshtein('expresss', 'express'), 1);
  });

  it('returns 2 for two-char typo', () => {
    // 'exprs' → 'express' requires 2 insertions ('e' and 's')
    assert.equal(levenshtein('exprs', 'express'), 2);
  });

  it('handles completely different strings', () => {
    assert.ok(levenshtein('react', 'webpack') > 2);
  });

  it('is case-sensitive', () => {
    assert.equal(levenshtein('Lodash', 'lodash'), 1);
  });
});
