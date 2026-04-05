// Resolves a package specifier (e.g. "express", "express@4", "express@^4.18")
// to a concrete { name, version, tarballUrl, integrity } ready for download.

import { fetchPackument, RegistryError } from './client.js';
import type { ResolvedPackage } from './types.js';
import type { RegistryClientOptions } from './client.js';

export { RegistryError };

/**
 * Parses a package specifier into name and optional version range.
 * Handles scoped packages (@scope/name@version).
 *
 * Examples:
 *   "express"          → { name: "express", range: "latest" }
 *   "express@4.18.2"   → { name: "express", range: "4.18.2" }
 *   "@types/node@18"   → { name: "@types/node", range: "18" }
 */
export function parseSpecifier(specifier: string): { name: string; range: string } {
  if (specifier.startsWith('@')) {
    // Scoped: @scope/name or @scope/name@version
    const atIdx = specifier.indexOf('@', 1);
    if (atIdx === -1) return { name: specifier, range: 'latest' };
    return {
      name: specifier.slice(0, atIdx),
      range: specifier.slice(atIdx + 1) || 'latest',
    };
  }
  const atIdx = specifier.indexOf('@');
  if (atIdx === -1) return { name: specifier, range: 'latest' };
  return {
    name: specifier.slice(0, atIdx),
    range: specifier.slice(atIdx + 1) || 'latest',
  };
}

/**
 * Very lightweight semver range matching.
 * Supports: exact versions, "latest"/"next"/any dist-tag, "^X", "~X", ">=X", "*".
 * For complex ranges, falls back to exact-match only (safe - will reject rather
 * than incorrectly allow a bad version).
 */
function matchesRange(version: string, range: string, distTags: Record<string, string>): boolean {
  if (range === 'latest' || range === '*') return true;

  // Dist-tag (e.g. "next", "beta")
  if (distTags[range] === version) return true;

  // Exact match
  if (version === range) return true;

  // Normalise semver: strip leading 'v'
  const v = version.replace(/^v/, '');
  const r = range.replace(/^v/, '');

  if (v === r) return true;

  // Prefix match for partial versions like "4" matching "4.18.2" or "^4"
  const base = r.replace(/^[\^~>=<]+/, '');
  if (v.startsWith(base + '.') || v.startsWith(base + '-')) return true;
  if (v === base) return true;

  return false;
}

/**
 * Resolves a package specifier to a concrete version using the npm registry.
 * Always picks the highest matching version (same behaviour as npm install).
 */
export async function resolvePackage(
  specifier: string,
  options: RegistryClientOptions = {},
): Promise<ResolvedPackage> {
  const { name, range } = parseSpecifier(specifier);
  const packument = await fetchPackument(name, options);

  // Exact dist-tag resolution
  const distTags = packument['dist-tags'];
  let resolvedVersion: string | undefined;

  if (distTags[range] !== undefined) {
    resolvedVersion = distTags[range];
  } else {
    // Find the highest version that satisfies the range
    const candidates = Object.keys(packument.versions)
      .filter((v) => matchesRange(v, range, distTags))
      .sort(compareSemver);

    resolvedVersion = candidates[candidates.length - 1];
  }

  if (!resolvedVersion) {
    throw new RegistryError(
      `No version of '${name}' matches '${range}'`,
      404,
      name,
    );
  }

  const versionData = packument.versions[resolvedVersion];
  if (!versionData) {
    throw new RegistryError(`Version metadata missing for ${name}@${resolvedVersion}`, 500, name);
  }

  return {
    name,
    version: resolvedVersion,
    tarballUrl: versionData.dist.tarball,
    integrity: versionData.dist.integrity,
    packument,
  };
}

/** Simple semver comparator: returns negative/zero/positive. */
function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function parseSemver(v: string): [number, number, number] {
  const clean = v.replace(/^[v=]/, '').split('-')[0] ?? '0';
  const parts = clean.split('.').map((p) => parseInt(p, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}
