// Flags very new packages with low download counts.
// New, unknown packages are higher risk than established ones.

import type { AnalysisContext, Finding } from '../types.js';

const NEW_PACKAGE_THRESHOLD_DAYS = 30;
const LOW_DOWNLOAD_THRESHOLD = 100;

export async function analyzePackageAge(context: AnalysisContext): Promise<Finding[]> {
  const findings: Finding[] = [];
  const { packument, packageName } = context;

  const createdAt = packument.time['created'];
  if (!createdAt) return findings;

  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays > NEW_PACKAGE_THRESHOLD_DAYS) return findings;

  // Package is new - fetch last-month download count
  const downloads = await fetchDownloadCount(packageName);

  if (downloads !== null && downloads < LOW_DOWNLOAD_THRESHOLD) {
    findings.push({
      category: 'package-age',
      level: 'medium',
      title: `New package with low download count`,
      description:
        `'${packageName}' was published ${Math.round(ageDays)} days ago and has only ${downloads} ` +
        'downloads in the past month. Malicious packages often appear as new, unknown packages.',
      evidence: `Age: ${Math.round(ageDays)} days | Last-month downloads: ${downloads}`,
    });
  } else if (downloads === null && ageDays < NEW_PACKAGE_THRESHOLD_DAYS) {
    // Could not fetch downloads - still flag the age
    findings.push({
      category: 'package-age',
      level: 'low',
      title: 'Very new package',
      description:
        `'${packageName}' was published only ${Math.round(ageDays)} days ago. ` +
        'Consider verifying the package is legitimate before installing.',
      evidence: `Age: ${Math.round(ageDays)} days`,
    });
  }

  return findings;
}

/** Fetches the last-month download count from the npm downloads API. */
async function fetchDownloadCount(packageName: string): Promise<number | null> {
  try {
    const url = `https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(packageName)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return null;
      const data = (await response.json()) as { downloads?: number };
      return typeof data.downloads === 'number' ? data.downloads : null;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}
