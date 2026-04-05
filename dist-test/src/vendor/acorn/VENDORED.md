# Vendored: acorn

**Source package**: acorn  
**Version**: 8.16.0  
**License**: MIT  
**Source**: https://registry.npmjs.org/acorn/-/acorn-8.16.0.tgz  
**Vendored date**: 2026-04-04  
**Vendored files**: acorn.mjs (ESM build), acorn.d.ts, acorn.d.mts, LICENSE  

## Why vendored?

cicurity is a supply chain attack prevention tool. Depending on an external npm package
at runtime would make cicurity itself vulnerable to the exact attack class it prevents.
acorn was chosen because it has zero runtime dependencies of its own, is MIT licensed,
and is the parser used internally by Node.js/V8.

## Upgrade procedure

To upgrade acorn:
1. Check https://github.com/acornjs/acorn/releases for the new version
2. Download the tarball: `curl -sL https://registry.npmjs.org/acorn/-/acorn-<version>.tgz | tar xz`
3. Replace acorn.mjs, acorn.d.ts, acorn.d.mts, and LICENSE with files from `package/dist/`
4. Update the version and date in this file
5. Verify the new version has zero dependencies: `cat package/package.json | grep dependencies`
