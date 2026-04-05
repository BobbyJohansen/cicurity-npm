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
export declare function extractPackageTarball(tgzPath: string): Promise<ExtractionResult>;
/**
 * Reads and parses the package.json from an extracted tarball.
 * npm tarballs always place it at package/package.json.
 */
export declare function readPackageJson(extractedPath: string): Promise<Record<string, unknown> | null>;
//# sourceMappingURL=extractor.d.ts.map