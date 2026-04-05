import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { analyzePublishAnomaly } from '../../../src/analysis/analyzers/publish-anomaly.js';
function makePackument(versions, name = 'test-pkg') {
    const versionMetas = {};
    for (const v of Object.keys(versions)) {
        versionMetas[v] = {
            name,
            version: v,
            dist: { integrity: 'sha512-abc', tarball: `https://registry.npmjs.org/${name}/-/${name}-${v}.tgz` },
            maintainers: [],
        };
    }
    return {
        name,
        'dist-tags': { latest: Object.keys(versions).at(-1) ?? '1.0.0' },
        versions: versionMetas,
        time: versions,
        maintainers: [],
    };
}
function makeContext(packument, version) {
    return {
        packageName: packument.name,
        version,
        extractedPath: '/tmp/fake',
        allFiles: [],
        installScripts: [],
        packument,
    };
}
describe('analyzePublishAnomaly', () => {
    it('detects burst publish after long gap', () => {
        const now = Date.now();
        const sixMonthsAgo = new Date(now - 180 * 24 * 60 * 60 * 1000).toISOString();
        const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
        const oneHourAgo = new Date(now - 1 * 60 * 60 * 1000).toISOString();
        const justNow = new Date(now).toISOString();
        const packument = makePackument({
            created: sixMonthsAgo,
            '1.0.0': sixMonthsAgo,
            '1.0.1': twoHoursAgo,
            '1.0.2': oneHourAgo,
            '1.0.3': justNow,
        });
        const findings = analyzePublishAnomaly(makeContext(packument, '1.0.3'));
        assert.ok(findings.some((f) => f.category === 'publish-anomaly' && f.level === 'high'));
    });
    it('detects resurrection after 6+ months', () => {
        const now = Date.now();
        const sevenMonthsAgo = new Date(now - 210 * 24 * 60 * 60 * 1000).toISOString();
        const justNow = new Date(now).toISOString();
        const packument = makePackument({
            created: sevenMonthsAgo,
            '1.0.0': sevenMonthsAgo,
            '1.0.1': justNow,
        });
        const findings = analyzePublishAnomaly(makeContext(packument, '1.0.1'));
        assert.ok(findings.some((f) => f.category === 'publish-anomaly' && f.level === 'medium'));
    });
    it('detects major version jump', () => {
        const now = Date.now();
        const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
        const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
        const packument = makePackument({
            created: oneMonthAgo,
            '1.2.3': oneMonthAgo,
            '9.0.0': oneWeekAgo,
        });
        const findings = analyzePublishAnomaly(makeContext(packument, '9.0.0'));
        assert.ok(findings.some((f) => f.category === 'publish-anomaly' && f.level === 'high'));
    });
    it('does not flag normal version cadence', () => {
        const now = Date.now();
        const base = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString();
        const mid = new Date(now - 180 * 24 * 60 * 60 * 1000).toISOString();
        const recent = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
        const packument = makePackument({
            created: base,
            '1.0.0': base,
            '1.1.0': mid,
            '1.2.0': recent,
        });
        const findings = analyzePublishAnomaly(makeContext(packument, '1.2.0'));
        assert.equal(findings.filter((f) => f.category === 'publish-anomaly').length, 0);
    });
    it('returns empty for single-version package', () => {
        const packument = makePackument({ created: new Date().toISOString(), '1.0.0': new Date().toISOString() });
        const findings = analyzePublishAnomaly(makeContext(packument, '1.0.0'));
        assert.equal(findings.length, 0);
    });
});
//# sourceMappingURL=publish-anomaly.test.js.map