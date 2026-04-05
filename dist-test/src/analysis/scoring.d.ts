import type { Finding, RiskScore, Action } from './types.js';
/**
 * Computes an aggregate risk score and recommended action from a list of findings.
 *
 * Score is capped at 100.
 * Action thresholds:
 *   block - score ≥ 40 OR any critical finding
 *   warn  - score ≥ 10 OR any high finding
 *   allow - everything else
 */
export declare function scoreFindings(findings: Finding[]): {
    score: RiskScore;
    action: Action;
};
/**
 * Applies CI override: in CI environments, 'warn' escalates to 'block'.
 * This ensures CI builds fail hard on any concerning package.
 */
export declare function applyEnvironmentOverride(action: Action, warnActionInCi?: 'block' | 'warn' | 'allow'): Action;
//# sourceMappingURL=scoring.d.ts.map