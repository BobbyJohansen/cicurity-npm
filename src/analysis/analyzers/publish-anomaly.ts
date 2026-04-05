// Detects anomalous publish patterns that signal account takeover.
// Account takeover often results in burst publishing (multiple versions in hours)
// or a package resurrection after months of dormancy.

import type { AnalysisContext, Finding } from '../types.js';

/** Max versions published in 24 hours before flagging */
const BURST_VERSION_THRESHOLD = 2;
/** Hours that define a "burst" publish window */
const BURST_WINDOW_HOURS = 24;
/** Months of inactivity that make a resurrection suspicious */
const DORMANCY_THRESHOLD_MONTHS = 6;
/** Major version jump that suggests version bump squatting */
const MAJOR_VERSION_JUMP_THRESHOLD = 5;

export function analyzePublishAnomaly(context: AnalysisContext): Finding[] {
  const findings: Finding[] = [];
  const { packument, version } = context;

  const versionTimes = buildVersionTimeline(packument.time);
  if (versionTimes.length < 2) return findings;

  const currentEntry = versionTimes.find((v) => v.version === version);
  if (!currentEntry) return findings;

  const currentIdx = versionTimes.indexOf(currentEntry);
  const previousEntry = currentIdx > 0 ? versionTimes[currentIdx - 1] : null;

  // --- Burst publish detection ---
  // Count how many versions were published within BURST_WINDOW_HOURS of the current version
  const burstWindowMs = BURST_WINDOW_HOURS * 60 * 60 * 1000;
  const versionsInWindow = versionTimes.filter(
    (v) =>
      v.version !== version &&
      currentEntry.time - v.time >= 0 &&
      currentEntry.time - v.time <= burstWindowMs,
  );

  if (versionsInWindow.length >= BURST_VERSION_THRESHOLD) {
    // Find the most recent version published BEFORE the burst window to measure the gap
    const burstWindowStart = currentEntry.time - burstWindowMs;
    const lastBeforeWindow = [...versionTimes]
      .reverse()
      .find((v) => v.time < burstWindowStart);

    if (lastBeforeWindow) {
      const gapDays = (burstWindowStart - lastBeforeWindow.time) / (1000 * 60 * 60 * 24);
      if (gapDays > 30) {
        findings.push({
          category: 'publish-anomaly',
          level: 'high',
          title: `Burst publish detected: ${versionsInWindow.length + 1} versions in ${BURST_WINDOW_HOURS}h after ${Math.round(gapDays)}-day gap`,
          description:
            `${versionsInWindow.length + 1} versions of '${context.packageName}' were published within ` +
            `${BURST_WINDOW_HOURS} hours, but the previous publish gap was ${Math.round(gapDays)} days. ` +
            'Rapid publishing after a long gap is a strong signal of account takeover - the new owner ' +
            'is trying to push a malicious version before the community notices.',
          evidence: `Versions in window: ${versionsInWindow.map((v) => v.version).join(', ')}, ${version}`,
        });
      }
    }
  }

  // --- Resurrection detection ---
  // Package dormant for >6 months, then suddenly published
  if (previousEntry) {
    const dormancyMs = currentEntry.time - previousEntry.time;
    const dormancyMonths = dormancyMs / (1000 * 60 * 60 * 24 * 30);

    if (dormancyMonths >= DORMANCY_THRESHOLD_MONTHS) {
      findings.push({
        category: 'publish-anomaly',
        level: 'medium',
        title: `Package resurrected after ${Math.round(dormancyMonths)} months of inactivity`,
        description:
          `'${context.packageName}' had no new versions for ${Math.round(dormancyMonths)} months ` +
          `(last: ${previousEntry.version}, ${new Date(previousEntry.time).toISOString().slice(0, 10)}). ` +
          'Resurrected packages are a common account takeover vector - the original maintainer ' +
          'loses interest and the account is later compromised or the name re-registered.',
        evidence: `Previous version: ${previousEntry.version} | Gap: ${Math.round(dormancyMonths)} months`,
      });
    }
  }

  // --- Version bump squatting detection ---
  // A dramatically higher version number can win semver resolution in package.json ranges
  if (previousEntry) {
    const prevMajor = parseMajor(previousEntry.version);
    const currMajor = parseMajor(version);

    if (prevMajor !== null && currMajor !== null && currMajor - prevMajor >= MAJOR_VERSION_JUMP_THRESHOLD) {
      findings.push({
        category: 'publish-anomaly',
        level: 'high',
        title: `Major version jump: ${previousEntry.version} → ${version} (+${currMajor - prevMajor} major versions)`,
        description:
          `'${context.packageName}' jumped from v${previousEntry.version} to v${version} ` +
          `(${currMajor - prevMajor} major version jump). ` +
          'Publishing an artificially high version can force resolution over locked or range-pinned versions, ' +
          'making projects unknowingly install a malicious release.',
        evidence: `${previousEntry.version} → ${version}`,
      });
    }
  }

  return findings;
}

interface VersionEntry {
  version: string;
  time: number;
}

function buildVersionTimeline(time: Record<string, string>): VersionEntry[] {
  const entries: VersionEntry[] = [];

  for (const [key, value] of Object.entries(time)) {
    // Skip meta-keys like 'created', 'modified'
    if (key === 'created' || key === 'modified') continue;
    const ts = new Date(value).getTime();
    if (!isNaN(ts)) {
      entries.push({ version: key, time: ts });
    }
  }

  return entries.sort((a, b) => a.time - b.time);
}

function parseMajor(version: string): number | null {
  const major = parseInt(version.replace(/^[v=]/, '').split('.')[0] ?? '', 10);
  return isNaN(major) ? null : major;
}
