import { RegistryError } from './client.js';
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
export declare function parseSpecifier(specifier: string): {
    name: string;
    range: string;
};
/**
 * Resolves a package specifier to a concrete version using the npm registry.
 * Always picks the highest matching version (same behaviour as npm install).
 */
export declare function resolvePackage(specifier: string, options?: RegistryClientOptions): Promise<ResolvedPackage>;
//# sourceMappingURL=resolver.d.ts.map