// Content-addressed tarball cache: ~/.cicurity/cache/<sha512-hex>.tgz
// Keyed by the integrity hash from the registry, not the URL.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

const CACHE_DIR = path.join(os.homedir(), '.cicurity', 'cache');

/** Returns the file path for a cached tarball given its integrity hash. */
export function cachePathForIntegrity(integrity: string): string {
  // integrity format: "sha512-<base64>"
  const hex = integrityToHex(integrity);
  return path.join(CACHE_DIR, `${hex}.tgz`);
}

/** Returns true if the tarball for this integrity hash is already cached. */
export async function isCached(integrity: string): Promise<boolean> {
  const cachePath = cachePathForIntegrity(integrity);
  try {
    await fs.promises.access(cachePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifies a downloaded file against an integrity hash.
 * Returns true if the file matches.
 * integrity format: "sha512-<base64>"
 */
export async function verifyIntegrity(filePath: string, integrity: string): Promise<boolean> {
  const [algorithm, expected] = integrity.split('-');
  if (!algorithm || !expected) return false;

  const nodeAlg = algorithm.toLowerCase().replace('sha', 'sha') as string;
  const data = await fs.promises.readFile(filePath);
  const actual = crypto.createHash(nodeAlg).update(data).digest('base64');
  return actual === expected;
}

/**
 * Moves a downloaded tarball into the cache.
 * The caller is responsible for integrity verification before calling this.
 */
export async function cacheFile(sourcePath: string, integrity: string): Promise<string> {
  await fs.promises.mkdir(CACHE_DIR, { recursive: true });
  const dest = cachePathForIntegrity(integrity);
  await fs.promises.copyFile(sourcePath, dest);
  return dest;
}

/** Converts a "sha512-<base64>" integrity string to a hex filename. */
function integrityToHex(integrity: string): string {
  const b64 = integrity.split('-')[1] ?? integrity;
  return Buffer.from(b64, 'base64').toString('hex').slice(0, 64);
}
