// Extracts a tarball to a managed temp directory and returns the path.
// Delegates to src/internal/tar.ts.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { extractTarball } from '../internal/tar.js';

export interface ExtractionResult {
  /** Absolute path to the directory containing extracted package files */
  extractedPath: string;
  /** All extracted file paths relative to extractedPath */
  files: string[];
  /** Cleanup function - call when analysis is done */
  cleanup: () => Promise<void>;
}

/**
 * Extracts a .tgz tarball to a unique temp directory.
 * npm tarballs contain a top-level "package/" directory; this is preserved.
 * Call result.cleanup() when done to remove the temp dir.
 */
export async function extractPackageTarball(tgzPath: string): Promise<ExtractionResult> {
  const id = crypto.randomBytes(8).toString('hex');
  const extractedPath = path.join(os.tmpdir(), `cicurity-extract-${id}`);

  await fs.promises.mkdir(extractedPath, { recursive: true });

  const files = await extractTarball(tgzPath, extractedPath);

  return {
    extractedPath,
    files,
    cleanup: async () => {
      await fs.promises.rm(extractedPath, { recursive: true, force: true });
    },
  };
}

/**
 * Reads and parses the package.json from an extracted tarball.
 * npm tarballs always place it at package/package.json.
 */
export async function readPackageJson(
  extractedPath: string,
): Promise<Record<string, unknown> | null> {
  const candidates = [
    path.join(extractedPath, 'package', 'package.json'),
    path.join(extractedPath, 'package.json'),
  ];

  for (const candidate of candidates) {
    try {
      const content = await fs.promises.readFile(candidate, 'utf8');
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      // try next candidate
    }
  }

  return null;
}
