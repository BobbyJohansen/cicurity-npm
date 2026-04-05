// npm registry HTTP client - uses Node 20 built-in fetch, zero dependencies.

import type { Packument, VersionMetadata } from './types.js';

export class RegistryError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly packageName?: string,
  ) {
    super(message);
    this.name = 'RegistryError';
  }
}

const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

/** In-process packument cache - avoids duplicate fetches within one cicurity run */
const packumentCache = new Map<string, Packument>();

export interface RegistryClientOptions {
  registry?: string;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
}

async function fetchWithRetry(url: string, timeoutMs: number): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_BASE_MS * 2 ** (attempt - 1)));
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { signal: controller.signal });
        return response;
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Only retry on network errors, not HTTP errors
      if (err instanceof Error && err.name === 'AbortError') throw err;
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

/**
 * Fetches the full packument (all versions) for a package.
 * Results are cached for the lifetime of the process.
 */
export async function fetchPackument(
  name: string,
  options: RegistryClientOptions = {},
): Promise<Packument> {
  const cacheKey = `${options.registry ?? DEFAULT_REGISTRY}/${name}`;
  const cached = packumentCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const registry = (options.registry ?? DEFAULT_REGISTRY).replace(/\/$/, '');
  const url = `${registry}/${encodeURIComponent(name).replace('%40', '@')}`;

  const response = await fetchWithRetry(url, options.timeoutMs ?? 15_000);

  if (response.status === 404) {
    throw new RegistryError(`Package '${name}' not found`, 404, name);
  }
  if (!response.ok) {
    throw new RegistryError(
      `Registry returned ${response.status} for '${name}'`,
      response.status,
      name,
    );
  }

  const packument = (await response.json()) as Packument;
  packumentCache.set(cacheKey, packument);
  return packument;
}

/**
 * Fetches metadata for a specific version of a package.
 * Uses the cached packument when available.
 */
export async function fetchVersionMetadata(
  name: string,
  version: string,
  options: RegistryClientOptions = {},
): Promise<VersionMetadata> {
  const packument = await fetchPackument(name, options);
  const versionData = packument.versions[version];
  if (!versionData) {
    throw new RegistryError(
      `Version '${version}' not found for package '${name}'`,
      404,
      name,
    );
  }
  return versionData;
}

/** Clears the in-process packument cache. Primarily for testing. */
export function clearPackumentCache(): void {
  packumentCache.clear();
}
