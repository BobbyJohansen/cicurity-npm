// Detects potential dependency confusion attacks.
// An attacker registers a public npm package with the same name as a company's internal/private
// package. npm resolves by highest version, so the public package wins over private registries.
// See: https://medium.com/@alex.birsan/dependency-confusion-4a5d60fec610

import type { AnalysisContext, Finding } from '../types.js';

/** Patterns that suggest this is an internal/private package name */
const INTERNAL_NAME_PATTERNS: RegExp[] = [
  // Prefix patterns common in internal tooling
  /^internal-/i,
  /^private-/i,
  /^corp-/i,
  /^company-/i,
  /^org-/i,
  /-internal$/i,
  /-private$/i,
  /-corp$/i,
  // Suffix patterns: my-company-utils, acme-shared-config, etc.
  /-(utils|helpers|common|shared|core|lib|sdk|api|client|service|config|auth|infra|internal|private)$/i,
  // Multi-word patterns that look like internal tools
  /^[a-z]+-[a-z]+-[a-z]+-[a-z]+$/, // four-part hyphenated (very specific)
];

/** Fields that legitimate public packages typically have */
const PUBLIC_PACKAGE_SIGNALS = ['repository', 'homepage', 'bugs'] as const;

export function analyzeDepConfusion(context: AnalysisContext): Finding[] {
  const findings: Finding[] = [];
  const { packument, packageName, version } = context;

  // Only check unscoped packages - scoped packages have explicit ownership
  if (packageName.startsWith('@')) return findings;

  const versionMeta = packument.versions[version];
  if (!versionMeta) return findings;

  // Check if the package name matches internal naming patterns
  const matchedPattern = INTERNAL_NAME_PATTERNS.find((p) => p.test(packageName));
  if (!matchedPattern) return findings;

  // Gather signals that suggest this is actually an internal package published publicly
  const suspicionSignals: string[] = [];

  // Very few or no versions (brand new on public registry)
  const versionCount = Object.keys(packument.versions).length;
  if (versionCount <= 2) {
    suspicionSignals.push(`only ${versionCount} version(s) on the public registry`);
  }

  // Missing fields that real public packages have
  const missingPublicFields = PUBLIC_PACKAGE_SIGNALS.filter(
    (field) => !(versionMeta as unknown as Record<string, unknown>)[field] &&
               !(packument as unknown as Record<string, unknown>)[field],
  );
  if (missingPublicFields.length >= 2) {
    suspicionSignals.push(`missing public package fields: ${missingPublicFields.join(', ')}`);
  }

  // No meaningful description
  if (!versionMeta.description || versionMeta.description.trim().length < 10) {
    suspicionSignals.push('no meaningful description');
  }

  // Package was created very recently
  const createdAt = packument.time['created'];
  if (createdAt) {
    const ageDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < 60) {
      suspicionSignals.push(`created only ${Math.round(ageDays)} days ago`);
    }
  }

  // Need at least 2 suspicion signals to flag (avoid false positives)
  if (suspicionSignals.length < 2) return findings;

  findings.push({
    category: 'dependency-confusion',
    level: 'high',
    title: `Possible dependency confusion attack: '${packageName}' looks like an internal package`,
    description:
      `'${packageName}' matches patterns common in internal/private package naming and has multiple ` +
      'signals suggesting it may be a squatted public package targeting a private registry: ' +
      suspicionSignals.join('; ') + '. ' +
      'In a dependency confusion attack, an attacker registers a public package with the same name as ' +
      'your internal package at a higher version to intercept installs.',
    evidence: suspicionSignals.join(' | '),
  });

  return findings;
}
