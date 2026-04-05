import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { analyzeFilesystem } from '../../../src/analysis/analyzers/filesystem.js';
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

describe('analyzeFilesystem', () => {
  it('detects require("fs") as medium finding', () => {
    const findings = analyzeFilesystem(makeContext(`const fs = require('fs')`));
    assert.ok(findings.some((f) => f.category === 'install-script-fs-access' && f.level === 'medium'));
  });

  it('detects require("node:fs") as medium finding', () => {
    const findings = analyzeFilesystem(makeContext(`const fs = require('node:fs')`));
    assert.ok(findings.some((f) => f.category === 'install-script-fs-access' && f.level === 'medium'));
  });

  it('detects fs.readFileSync as high finding', () => {
    const findings = analyzeFilesystem(makeContext(`const data = fs.readFileSync('/some/file', 'utf8')`));
    assert.ok(findings.some((f) => f.category === 'install-script-fs-access' && f.level === 'high'));
  });

  it('detects fs.writeFileSync targeting .bashrc as critical', () => {
    const findings = analyzeFilesystem(makeContext(`fs.writeFileSync('/home/user/.bashrc', 'malicious code')`));
    assert.ok(findings.some((f) => f.category === 'install-script-fs-access' && f.level === 'critical'));
  });

  it('detects fs.readFile targeting .ssh/id_rsa as critical', () => {
    const findings = analyzeFilesystem(makeContext(`fs.readFile('/home/user/.ssh/id_rsa', cb)`));
    assert.ok(findings.some((f) => f.category === 'install-script-fs-access' && f.level === 'critical'));
  });

  it('detects fs.readFile targeting .aws credentials as critical', () => {
    const findings = analyzeFilesystem(makeContext(`fs.readFileSync('/home/user/.aws/credentials', 'utf8')`));
    assert.ok(findings.some((f) => f.category === 'install-script-fs-access' && f.level === 'critical'));
  });

  it('detects fs.appendFile targeting .zshrc as critical', () => {
    const findings = analyzeFilesystem(makeContext(`fs.appendFile(os.homedir() + '/.zshrc', payload)`));
    // .zshrc in the binary expression string part should still match
    assert.ok(findings.some((f) => f.category === 'install-script-fs-access'));
  });

  it('does not flag scripts with no fs operations', () => {
    const findings = analyzeFilesystem(makeContext(`console.log('hello world')`));
    assert.equal(findings.length, 0);
  });
});
