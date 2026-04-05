// Downloads a package tarball from the registry, verifies its sha512 integrity,
// and caches it. Returns the local path to the verified .tgz file.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as stream from 'node:stream';
import { cachePathForIntegrity, isCached, verifyIntegrity, cacheFile } from './cache.js';

export class IntegrityError extends Error {
  constructor(public readonly packageName: string, public readonly version: string) {
    super(
      `Integrity check failed for ${packageName}@${version} — ` +
      'the downloaded tarball does not match the registry hash. ' +
      'This may indicate a compromised registry response or MITM attack.'
    );
    this.name = 'IntegrityError';
  }
}

export class DownloadError extends Error {
  constructor(message: string, public readonly url: string) {
    super(message);
    this.name = 'DownloadError';
  }
}

/**
 * Returns a local path to the verified tarball for the given package.
 * Uses cache when available; downloads and verifies otherwise.
 */
export async function fetchTarball(
  name: string,
  version: string,
  tarballUrl: string,
  integrity: string,
): Promise<string> {
  // Cache hit
  if (await isCached(integrity)) {
    return cachePathForIntegrity(integrity);
  }

  // Download to a temp file first
  const tmpPath = path.join(os.tmpdir(), `cicurity-dl-${Date.now()}-${Math.random().toString(36).slice(2)}.tgz`);

  try {
    await downloadToFile(tarballUrl, tmpPath);

    if (!(await verifyIntegrity(tmpPath, integrity))) {
      throw new IntegrityError(name, version);
    }

    // Move into cache
    return await cacheFile(tmpPath, integrity);
  } finally {
    // Clean up temp file (best-effort)
    fs.promises.unlink(tmpPath).catch(() => undefined);
  }
}

async function downloadToFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new DownloadError(
      `Failed to download tarball: HTTP ${response.status}`,
      url,
    );
  }

  if (!response.body) {
    throw new DownloadError('Response body is null', url);
  }

  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

  const writer = fs.createWriteStream(destPath);
  const nodeReadable = stream.Readable.fromWeb(
    response.body as import('node:stream/web').ReadableStream<Uint8Array>
  );

  await stream.promises.pipeline(nodeReadable, writer);
}
