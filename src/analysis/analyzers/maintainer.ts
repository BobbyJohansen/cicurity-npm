// Detects new or changed maintainers in the current package version.
// Account takeover is a major supply chain attack vector.

import type { AnalysisContext, Finding } from '../types.js';
import type { NpmPerson } from '../../registry/types.js';

/** How recently (days) a new maintainer must have been added to be flagged */
const NEW_MAINTAINER_WINDOW_DAYS = 30;

export function analyzeMaintainerChanges(context: AnalysisContext): Finding[] {
  const findings: Finding[] = [];
  const { packument, packageName, version } = context;

  const versions = Object.keys(packument.versions).sort(compareSemverSimple);
  const currentIdx = versions.indexOf(version);

  // No previous version to compare against (brand new package)
  if (currentIdx <= 0) return findings;

  const previousVersion = versions[currentIdx - 1];
  if (!previousVersion) return findings;

  const currentMeta = packument.versions[version];
  const previousMeta = packument.versions[previousVersion];

  if (!currentMeta || !previousMeta) return findings;

  const currentMaintainers = normalizeMaintainers(currentMeta.maintainers ?? []);
  const previousMaintainers = normalizeMaintainers(previousMeta.maintainers ?? []);

  // Find emails present in current but not previous
  const addedMaintainers = currentMaintainers.filter(
    (m) => !previousMaintainers.some((p) => p.email === m.email || p.name === m.name),
  );

  if (addedMaintainers.length === 0) return findings;

  // Check how long ago the current version was published
  const publishedAt = packument.time[version];
  const daysSincePublish = publishedAt
    ? (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;

  const level = daysSincePublish <= NEW_MAINTAINER_WINDOW_DAYS ? 'high' : 'medium';

  for (const added of addedMaintainers) {
    findings.push({
      category: 'maintainer-change',
      level,
      title: `New maintainer added: ${added.name || added.email}`,
      description:
        `Version ${version} of '${packageName}' was published by or has a new maintainer ` +
        `(${added.name ?? 'unknown'} <${added.email ?? 'unknown'}>). ` +
        `The previous version ${previousVersion} did not include this maintainer. ` +
        (daysSincePublish <= NEW_MAINTAINER_WINDOW_DAYS
          ? `This version was published only ${Math.round(daysSincePublish)} days ago.`
          : 'Account takeover often precedes a malicious version publish.'),
      evidence: `New: ${added.name ?? ''} <${added.email ?? ''}>  |  Previous version maintained by: ${previousMaintainers.map((m) => m.name ?? m.email).join(', ')}`,
    });
  }

  return findings;
}

function normalizeMaintainers(maintainers: NpmPerson[]): NpmPerson[] {
  return maintainers.map((m) => ({
    name: m.name?.trim() ?? '',
    email: m.email?.trim().toLowerCase() ?? '',
  }));
}

function compareSemverSimple(a: string, b: string): number {
  const pa = a.replace(/^[v=]/, '').split('.').map(Number);
  const pb = b.replace(/^[v=]/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
