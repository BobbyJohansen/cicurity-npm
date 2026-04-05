import { describe, it, before } from 'node:test';
import * as assert from 'node:assert/strict';
import { analyzeObfuscation } from '../../../src/analysis/analyzers/obfuscation.js';
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

describe('analyzeObfuscation', () => {
  it('detects eval() call', () => {
    const findings = analyzeObfuscation(makeContext(`eval("malicious code")`));
    assert.ok(findings.some((f) => f.category === 'install-script-eval'), 'should detect eval()');
    assert.ok(findings.some((f) => f.level === 'critical'));
  });

  it('detects new Function()', () => {
    const findings = analyzeObfuscation(makeContext(`new Function("return process.env")()`));
    assert.ok(findings.some((f) => f.category === 'install-script-eval'));
  });

  it('detects eval(Buffer.from(x, "base64"))', () => {
    const findings = analyzeObfuscation(
      makeContext(`eval(Buffer.from('aGVsbG8=', 'base64').toString())`)
    );
    assert.ok(findings.some((f) => f.category === 'install-script-eval'), 'should detect eval');
    assert.ok(findings.some((f) => f.category === 'install-script-obfuscation'), 'should detect Buffer.from base64');
  });

  it('detects Buffer.from base64 without eval', () => {
    const findings = analyzeObfuscation(
      makeContext(`const data = Buffer.from(payload, 'base64').toString()`)
    );
    assert.ok(findings.some((f) => f.category === 'install-script-obfuscation'));
  });

  it('does not flag normal code', () => {
    const findings = analyzeObfuscation(
      makeContext(`
        const fs = require('fs');
        const path = require('path');
        fs.writeFileSync(path.join(__dirname, 'out.js'), 'hello');
      `)
    );
    assert.equal(findings.length, 0);
  });

  it('detects high-entropy base64 string literal', () => {
    // A 150-char base64 blob with high Shannon entropy
    const blob = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.repeat(3).slice(0, 150);
    const findings = analyzeObfuscation(makeContext(`const x = "${blob}";`));
    assert.ok(findings.some((f) => f.category === 'install-script-obfuscation'));
  });

  it('does not flag normal short strings', () => {
    const findings = analyzeObfuscation(makeContext(`const x = "hello world";`));
    const obfuscation = findings.filter((f) => f.category === 'install-script-obfuscation');
    assert.equal(obfuscation.length, 0);
  });
});
