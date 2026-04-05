/** Returns the file path for a cached tarball given its integrity hash. */
export declare function cachePathForIntegrity(integrity: string): string;
/** Returns true if the tarball for this integrity hash is already cached. */
export declare function isCached(integrity: string): Promise<boolean>;
/**
 * Verifies a downloaded file against an integrity hash.
 * Returns true if the file matches.
 * integrity format: "sha512-<base64>"
 */
export declare function verifyIntegrity(filePath: string, integrity: string): Promise<boolean>;
/**
 * Moves a downloaded tarball into the cache.
 * The caller is responsible for integrity verification before calling this.
 */
export declare function cacheFile(sourcePath: string, integrity: string): Promise<string>;
//# sourceMappingURL=cache.d.ts.map