// Finds lifecycle install hooks in package.json and resolves their JS files.
// This is the foundation — other AST-based analyzers depend on the context it builds.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AnalysisContext, Finding, InstallScript } from '../types.js';

const LIFECYCLE_HOOKS = ['preinstall', 'install', 'postinstall', 'prepare'] as const;

/**
 * Reads package.json from the extracted tarball, finds all lifecycle install
 * hooks, and resolves any JS files they reference.
 * Returns a Finding for each hook found (informational) and populates
 * context.installScripts for downstream analyzers.
 */
export async function analyzeInstallScripts(
  context: AnalysisContext,
): Promise<{ installScripts: InstallScript[]; findings: Finding[] }> {
  const findings: Finding[] = [];
  const installScripts: InstallScript[] = [];

  const pkgJsonPath = findPackageJson(context.extractedPath);
  if (!pkgJsonPath) return { installScripts, findings };

  let pkgJson: Record<string, unknown>;
  try {
    const raw = await fs.promises.readFile(pkgJsonPath, 'utf8');
    pkgJson = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { installScripts, findings };
  }

  const scripts = pkgJson['scripts'];
  if (typeof scripts !== 'object' || scripts === null) return { installScripts, findings };

  const scriptsObj = scripts as Record<string, unknown>;

  for (const hook of LIFECYCLE_HOOKS) {
    const cmd = scriptsObj[hook];
    if (typeof cmd !== 'string' || cmd.trim() === '') continue;

    const script: InstallScript = {
      lifecycle: hook,
      command: cmd,
    };

    // Try to resolve and read the JS file being invoked
    const jsFile = resolveScriptFile(cmd, context.extractedPath);
    if (jsFile) {
      script.resolvedFile = jsFile;
      try {
        script.source = await fs.promises.readFile(jsFile, 'utf8');
      } catch {
        // File may not be readable; continue without source
      }
    }

    installScripts.push(script);
  }

  return { installScripts, findings };
}

/** Finds package.json in the extracted tarball (npm places it at package/package.json) */
function findPackageJson(extractedPath: string): string | null {
  const candidates = [
    path.join(extractedPath, 'package', 'package.json'),
    path.join(extractedPath, 'package.json'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/**
 * Attempts to resolve a script command like "node scripts/install.js"
 * to an absolute file path within the extracted tarball.
 */
function resolveScriptFile(command: string, extractedPath: string): string | null {
  // Match patterns like: node script.js, node ./scripts/install.js, node "scripts/install.js"
  const nodeMatch = /^node\s+["']?([^\s"']+\.(?:js|cjs|mjs))["']?/.exec(command);
  if (!nodeMatch?.[1]) return null;

  const rel = nodeMatch[1];
  const bases = [
    path.join(extractedPath, 'package', rel),
    path.join(extractedPath, rel),
  ];

  for (const candidate of bases) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}
