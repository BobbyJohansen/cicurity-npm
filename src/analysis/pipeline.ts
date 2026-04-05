// Analysis pipeline orchestrator.
// Downloads, extracts, and analyzes a package through all analyzers.
// Returns PackageAnalysisResult with findings, score, and action.

import { fetchTarball } from '../tarball/fetcher.js';
import { extractPackageTarball, readPackageJson } from '../tarball/extractor.js';
import { analyzeInstallScripts } from './analyzers/install-scripts.js';
import { analyzeNetworkCalls } from './analyzers/network-calls.js';
import { analyzeObfuscation } from './analyzers/obfuscation.js';
import { analyzeEnvAccess } from './analyzers/env-access.js';
import { analyzeBinaryFiles } from './analyzers/binary-files.js';
import { analyzeTyposquat } from './analyzers/typosquat.js';
import { analyzeMaintainerChanges } from './analyzers/maintainer.js';
import { analyzePackageAge } from './analyzers/package-age.js';
import { analyzeChildProcess } from './analyzers/child-process.js';
import { analyzeFilesystem } from './analyzers/filesystem.js';
import { analyzeConditionalExec } from './analyzers/conditional-exec.js';
import { analyzeRemoteExec } from './analyzers/remote-exec.js';
import { analyzePublishAnomaly } from './analyzers/publish-anomaly.js';
import { analyzeMetadataIntegrity } from './analyzers/metadata-integrity.js';
import { analyzeDepConfusion } from './analyzers/dep-confusion.js';
import { scoreFindings, applyEnvironmentOverride } from './scoring.js';
import type { AnalysisContext, Finding, PackageAnalysisResult } from './types.js';
import type { ResolvedPackage } from '../registry/types.js';
import type { WarnAction } from '../internal/config-validator.js';

export interface PipelineOptions {
  ciWarnAction?: WarnAction;
}

/**
 * Runs the full analysis pipeline for a resolved package.
 * Downloads the tarball, extracts to temp dir, runs all analyzers in parallel,
 * scores the findings, and cleans up.
 */
export async function analyzePackage(
  resolved: ResolvedPackage,
  options: PipelineOptions = {},
): Promise<PackageAnalysisResult> {
  const startMs = Date.now();
  const { name, version, tarballUrl, integrity, packument } = resolved;

  // Step 1: Download and verify tarball
  const tgzPath = await fetchTarball(name, version, tarballUrl, integrity);

  // Step 2: Extract to temp dir
  const { extractedPath, files, cleanup } = await extractPackageTarball(tgzPath);

  try {
    // Step 3: Build install script context (foundation for AST analyzers)
    const { installScripts } = await analyzeInstallScripts({
      packageName: name,
      version,
      extractedPath,
      allFiles: files,
      installScripts: [],
      packument,
    });

    const context: AnalysisContext = {
      packageName: name,
      version,
      extractedPath,
      allFiles: files,
      installScripts,
      packument,
    };

    // Step 4: Run all analyzers in parallel
    const [
      networkFindings,
      obfuscationFindings,
      envFindings,
      binaryFindings,
      typosquatFindings,
      maintainerFindings,
      ageFindings,
      childProcessFindings,
      filesystemFindings,
      conditionalExecFindings,
      remoteExecFindings,
      publishAnomalyFindings,
      metadataIntegrityFindings,
      depConfusionFindings,
    ] = await Promise.all([
      Promise.resolve(analyzeNetworkCalls(context)),
      Promise.resolve(analyzeObfuscation(context)),
      Promise.resolve(analyzeEnvAccess(context)),
      analyzeBinaryFiles(context),
      Promise.resolve(analyzeTyposquat(context)),
      Promise.resolve(analyzeMaintainerChanges(context)),
      analyzePackageAge(context),
      Promise.resolve(analyzeChildProcess(context)),
      Promise.resolve(analyzeFilesystem(context)),
      Promise.resolve(analyzeConditionalExec(context)),
      Promise.resolve(analyzeRemoteExec(context)),
      Promise.resolve(analyzePublishAnomaly(context)),
      Promise.resolve(analyzeMetadataIntegrity(context)),
      Promise.resolve(analyzeDepConfusion(context)),
    ]);

    const allFindings: Finding[] = [
      ...networkFindings,
      ...obfuscationFindings,
      ...envFindings,
      ...binaryFindings,
      ...typosquatFindings,
      ...maintainerFindings,
      ...ageFindings,
      ...childProcessFindings,
      ...filesystemFindings,
      ...conditionalExecFindings,
      ...remoteExecFindings,
      ...publishAnomalyFindings,
      ...metadataIntegrityFindings,
      ...depConfusionFindings,
    ];

    // Step 5: Score and apply environment override
    const { score, action: rawAction } = scoreFindings(allFindings);
    const action = applyEnvironmentOverride(rawAction, options.ciWarnAction ?? 'block');

    return {
      packageName: name,
      version,
      integrity,
      findings: allFindings,
      score,
      action,
      durationMs: Date.now() - startMs,
    };
  } finally {
    // Always clean up the temp directory
    await cleanup();
  }
}
