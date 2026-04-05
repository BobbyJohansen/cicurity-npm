export declare class IntegrityError extends Error {
    readonly packageName: string;
    readonly version: string;
    constructor(packageName: string, version: string);
}
export declare class DownloadError extends Error {
    readonly url: string;
    constructor(message: string, url: string);
}
/**
 * Returns a local path to the verified tarball for the given package.
 * Uses cache when available; downloads and verifies otherwise.
 */
export declare function fetchTarball(name: string, version: string, tarballUrl: string, integrity: string): Promise<string>;
//# sourceMappingURL=fetcher.d.ts.map