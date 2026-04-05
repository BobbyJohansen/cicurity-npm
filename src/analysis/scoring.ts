// Aggregates analysis findings into a risk score and action decision.
// Pure function - no side effects.

import type { Finding, RiskScore, Action, RiskLevel } from './types.js';

const LEVEL_POINTS: Record<RiskLevel, number> = {
  critical: 40,
  high: 15,
  medium: 5,
  low: 1,
  info: 0,
};

/**
 * Computes an aggregate risk score and recommended action from a list of findings.
 *
 * Score is capped at 100.
 * Action thresholds:
 *   block - score ≥ 40 OR any critical finding
 *   warn  - score ≥ 10 OR any high finding
 *   allow - everything else
 */
export function scoreFindings(findings: Finding[]): { score: RiskScore; action: Action } {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

  let total = 0;
  for (const f of findings) {
    counts[f.level] = (counts[f.level] ?? 0) + 1;
    total += LEVEL_POINTS[f.level] ?? 0;
  }

  const score: RiskScore = {
    total: Math.min(total, 100),
    criticalCount: counts.critical,
    highCount: counts.high,
    mediumCount: counts.medium,
    lowCount: counts.low,
  };

  let action: Action = 'allow';
  if (score.total >= 40 || score.criticalCount > 0) {
    action = 'block';
  } else if (score.total >= 10 || score.highCount > 0) {
    action = 'warn';
  }

  return { score, action };
}

/**
 * Applies CI override: in CI environments, 'warn' escalates to 'block'.
 * This ensures CI builds fail hard on any concerning package.
 */
export function applyEnvironmentOverride(
  action: Action,
  warnActionInCi: 'block' | 'warn' | 'allow' = 'block',
): Action {
  const isCI = process.env['CI'] === 'true' ||
    process.env['GITHUB_ACTIONS'] === 'true' ||
    process.env['CIRCLECI'] === 'true' ||
    process.env['TRAVIS'] === 'true' ||
    process.env['JENKINS_URL'] !== undefined;

  if (isCI && action === 'warn') {
    return warnActionInCi;
  }
  return action;
}
