import type { Packument, VersionMetadata } from './types.js';
export declare class RegistryError extends Error {
    readonly statusCode?: number | undefined;
    readonly packageName?: string | undefined;
    constructor(message: string, statusCode?: number | undefined, packageName?: string | undefined);
}
export interface RegistryClientOptions {
    registry?: string;
    /** Request timeout in milliseconds */
    timeoutMs?: number;
}
/**
 * Fetches the full packument (all versions) for a package.
 * Results are cached for the lifetime of the process.
 */
export declare function fetchPackument(name: string, options?: RegistryClientOptions): Promise<Packument>;
/**
 * Fetches metadata for a specific version of a package.
 * Uses the cached packument when available.
 */
export declare function fetchVersionMetadata(name: string, version: string, options?: RegistryClientOptions): Promise<VersionMetadata>;
/** Clears the in-process packument cache. Primarily for testing. */
export declare function clearPackumentCache(): void;
//# sourceMappingURL=client.d.ts.map