// npm registry API types - based on the public packument format.

export interface NpmPerson {
  name: string;
  email: string;
}

export interface DistInfo {
  /** SHA-512 integrity hash: "sha512-<base64>" */
  integrity: string;
  /** Direct URL to the .tgz tarball */
  tarball: string;
  /** SHA-1 shasum (legacy) */
  shasum?: string;
  fileCount?: number;
  unpackedSize?: number;
}

export interface VersionMetadata {
  name: string;
  version: string;
  description?: string;
  scripts?: Record<string, string>;
  dist: DistInfo;
  maintainers: NpmPerson[];
  /** The npm user who published this specific version */
  _npmUser?: NpmPerson;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

/** Full package document returned by GET /registry.npmjs.org/<name> */
export interface Packument {
  name: string;
  'dist-tags': Record<string, string>;
  versions: Record<string, VersionMetadata>;
  /** ISO timestamp per version, plus "created" and "modified" keys */
  time: Record<string, string>;
  maintainers: NpmPerson[];
  readme?: string;
  repository?: { type: string; url: string };
}

/** Resolved package ready for download and analysis */
export interface ResolvedPackage {
  name: string;
  version: string;
  tarballUrl: string;
  /** sha512-<base64> integrity string from the registry */
  integrity: string;
  packument: Packument;
}
