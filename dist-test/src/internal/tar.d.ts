import * as stream from 'node:stream';
/**
 * Extracts a gzipped tar archive to destDir.
 * Only extracts regular files; skips directories (creates them as needed),
 * symlinks, and special entries.
 *
 * @param tgzPath  Absolute path to the .tgz file
 * @param destDir  Absolute path to the extraction destination directory
 * @returns List of extracted file paths (relative to destDir)
 */
export declare function extractTarball(tgzPath: string, destDir: string): Promise<string[]>;
/**
 * Convenience: pipe a readable stream to disk, then extract.
 * Used by tarball/fetcher.ts to write the download and extract in two steps.
 */
export declare function writeStream(readable: stream.Readable, destPath: string): Promise<void>;
//# sourceMappingURL=tar.d.ts.map